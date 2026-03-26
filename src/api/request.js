/**
 * Shared HTTP request helper.
 * Handles JSON serialisation, auth headers, 401 → /login redirect,
 * automatic toast notifications for POST results & errors,
 * request timeout, retry on network failure, and global loading state.
 */
import { getToken, clearToken } from './auth'
import router from '../router'
import { useToast } from '../composables/useToast'
import { useApiStatus } from '../composables/useApiStatus'
import { translateError } from '../utils/errorHelper'

export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888'

/** Default request timeout in milliseconds */
const REQUEST_TIMEOUT = 15_000

/** Max retries for network errors (fetch itself fails, not HTTP errors) */
const MAX_RETRIES = 5

/** Delay between retries in ms (incremental: 1s, 2s, 3s, 4s, 5s) */
const RETRY_DELAY = 1000

export function authHeaders() {
    const token = getToken()
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
}

/**
 * Fetch with timeout support using AbortController.
 */
function fetchWithTimeout(url, opts, timeoutMs) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    return fetch(url, { ...opts, signal: controller.signal }).finally(() => {
        clearTimeout(timer)
    })
}

/**
 * Wait for a given number of milliseconds.
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Perform an HTTP request with timeout, retry, and global loading state.
 *
 * @param {'GET'|'POST'|'PUT'|'DELETE'} method
 * @param {string} path   - e.g. '/api/v1/admin/products'
 * @param {object|null} body
 * @param {boolean} auth  - whether to attach the Bearer token (default true)
 * @returns {Promise<any>} parsed JSON body
 */
export async function request(method, path, body = null, auth = true) {
    const toast = useToast()
    const apiStatus = useApiStatus()
    const headers = auth ? authHeaders() : { 'Content-Type': 'application/json' }
    const opts = { method, headers }
    if (body) opts.body = JSON.stringify(body)

    const url = `${API_BASE_URL}${path}`

    // Track loading state
    apiStatus.start()

    let lastError = null
    let response = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            response = await fetchWithTimeout(url, opts, REQUEST_TIMEOUT)

            // If we get a response, backend is reachable
            apiStatus.setOnline()
            break
        } catch (err) {
            lastError = err

            // AbortError = timeout, TypeError = network failure
            const isTimeout = err.name === 'AbortError'
            const isNetworkError = err instanceof TypeError || isTimeout

            if (isNetworkError) {
                apiStatus.setOffline()

                if (attempt < MAX_RETRIES) {
                    // Wait before retry
                    await delay(RETRY_DELAY * (attempt + 1))
                    continue
                }

                // All retries exhausted — tell user to refresh
                apiStatus.end()
                const errMsg = translateError({ code: 'RETRIES_EXHAUSTED' })
                toast.error(errMsg, { duration: 0 })  // duration 0 = persistent until dismissed
                throw new Error(errMsg)
            }

            // Non-network error, don't retry
            apiStatus.end()
            throw err
        }
    }

    // If response is still null (shouldn't happen, but safety check)
    if (!response) {
        apiStatus.end()
        const errMsg = translateError({ code: 'NETWORK_ERROR' })
        toast.warning(errMsg, { duration: 8000 })
        throw new Error(errMsg)
    }

    // 401 Unauthorized → toast warning, clear credentials and redirect to login
    if (response.status === 401) {
        apiStatus.end()
        console.warn('[request] 401 on', method, path)
        const errMsg = translateError({ code: 'UNAUTHORIZED' })
        toast.warning(errMsg)
        clearToken()
        if (router.currentRoute.value.path !== '/login') {
            router.replace('/login')
        }
        throw new Error('Unauthorized')
    }

    let data = null
    try {
        data = await response.json()
    } catch {
        data = null
    }

    if (!response.ok) {
        apiStatus.end()
        // Backend now returns { code: "ERROR_CODE", error: "debug message" }
        // Use translateError to look up i18n translation by code, falling back to error text
        const code = data?.code || ''
        const message = data?.error || data?.message || ''
        const errMsg = translateError({ code, message })
        toast.error(errMsg)
        throw new Error(errMsg)
    }

    // POST success → show toast with backend message or default
    if (method === 'POST') {
        const msg = (data && data.message) || '操作成功'
        toast.success(msg)
    }

    apiStatus.end()
    return data
}
