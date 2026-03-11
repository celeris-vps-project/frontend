/**
 * Shared HTTP request helper.
 * Handles JSON serialisation, auth headers, and 401 → /login redirect.
 */
import { getToken, clearToken } from './auth'
import router from '../router'

export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888'

export function authHeaders() {
    const token = getToken()
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
}

export function getErrorMessage(data, fallback) {
    if (!data) return fallback
    if (typeof data === 'string') return data
    if (typeof data.error === 'string') return data.error
    if (typeof data.message === 'string') return data.message
    return fallback
}

/**
 * Perform an HTTP request.
 *
 * @param {'GET'|'POST'|'PUT'|'DELETE'} method
 * @param {string} path   - e.g. '/api/v1/admin/products'
 * @param {object|null} body
 * @param {boolean} auth  - whether to attach the Bearer token (default true)
 * @returns {Promise<any>} parsed JSON body
 */
export async function request(method, path, body = null, auth = true) {
    const headers = auth ? authHeaders() : { 'Content-Type': 'application/json' }
    const opts = { method, headers }
    if (body) opts.body = JSON.stringify(body)

    const response = await fetch(`${API_BASE_URL}${path}`, opts)

    // 401 Unauthorized → clear credentials and redirect to login
    if (response.status === 401) {
        console.warn('[request] 401 on', method, path)
        clearToken()
        // Use Vue Router (soft navigation) instead of window.location.href
        // to avoid hard page reloads that race with freshly-saved tokens.
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
        throw new Error(getErrorMessage(data, 'Request failed'))
    }

    return data
}
