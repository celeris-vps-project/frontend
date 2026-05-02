/**
 * Unified Checkout API — communicates with the adaptive checkout module.
 *
 * This replaces the flash-sale API for real product purchases.
 * The adaptive dispatcher automatically returns:
 *   - 200: purchase completed synchronously (normal load)
 *   - 202: order queued for async processing (high load)
 *
 * When a 202 is returned, the frontend subscribes to real-time status
 * updates via Server-Sent Events (SSE) instead of polling. This avoids
 * the ironic problem of polling creating MORE load when the system is
 * already under high load.
 *
 * SSE vs Polling comparison (500 async orders):
 *   Polling:  500 clients × 1 req/s = 500 additional QPS (counterproductive)
 *   SSE:      500 long-lived connections, ~2 pushes each = ~1000 total messages
 */
import { request, API_BASE_URL, authHeaders } from './request'

/**
 * Checkout (purchase) a product via the unified adaptive endpoint.
 * POST /api/v1/checkout
 *
 * @param {string} productId - the product to purchase
 * @param {string} hostname  - desired VPS hostname
 * @param {string} os        - operating system (e.g. 'ubuntu-22.04')
 * @returns {{ http_status, order_id, message, queue_pos }}
 *   - http_status=200 → purchase successful (sync)
 *   - http_status=202 → queued for processing (subscribe to SSE stream)
 */
export async function checkout(productId, hostname, os) {
    const res = await fetch(`${API_BASE_URL}/api/v1/checkout`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
            product_id: productId,
            hostname,
            os: os || 'ubuntu-22.04'
        })
    })
    // Don't throw on 202 — it's a valid "accepted" response
    const data = await res.json().catch(() => null)
    if (!res.ok && res.status !== 202) {
        throw new Error(data?.error || `Checkout failed (${res.status})`)
    }
    return data
}

/**
 * Subscribe to real-time order status updates via Server-Sent Events (SSE).
 *
 * Uses fetch() + ReadableStream instead of EventSource because the endpoint
 * is behind JWT auth middleware, and EventSource doesn't support custom headers.
 * fetch() lets us send the Authorization header while still consuming the
 * SSE stream in real-time.
 *
 * The stream automatically closes when the order reaches a terminal state
 * (completed/failed) or after a 60s server-side timeout.
 *
 * @param {string} orderId - the async order ID from the 202 response
 * @param {Object} callbacks
 * @param {function} callbacks.onStatus   - called on each status update ({ order_id, status, message, queue_pos })
 * @param {function} callbacks.onComplete - called when order reaches terminal state (completed/failed)
 * @param {function} callbacks.onError    - called on stream error
 * @returns {{ close: function }} - call close() to abort the stream (e.g. on component unmount)
 *
 * @example
 *   const stream = streamOrderStatus(orderId, {
 *     onStatus(status) {
 *       console.log('Queue position:', status.queue_pos, 'Status:', status.status)
 *     },
 *     onComplete(status) {
 *       if (status.status === 'completed') router.push(`/orders/${status.order_id}/checkout`)
 *     },
 *     onError(err) {
 *       console.error('Stream error:', err)
 *     }
 *   })
 *
 *   // On component unmount:
 *   onUnmounted(() => stream.close())
 */
export function streamOrderStatus(orderId, { onStatus, onComplete, onError } = {}) {
    const controller = new AbortController()

    // Launch the SSE stream in the background
    ;(async () => {
        try {
            const res = await fetch(
                `${API_BASE_URL}/api/v1/checkout/orders/${orderId}/stream`,
                {
                    method: 'GET',
                    headers: authHeaders(),
                    signal: controller.signal,
                }
            )

            if (!res.ok) {
                const errData = await res.json().catch(() => null)
                throw new Error(errData?.error || `SSE stream failed (${res.status})`)
            }

            // Parse the SSE stream using ReadableStream + TextDecoder
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })

                // SSE events are separated by double newlines
                const events = buffer.split('\n\n')
                // Keep the last (possibly incomplete) chunk in the buffer
                buffer = events.pop() || ''

                for (const event of events) {
                    if (!event.trim()) continue

                    // Parse SSE fields
                    const lines = event.split('\n')
                    let eventName = 'message'
                    let data = ''

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            data += line.slice(6)
                        } else if (line.startsWith('event: ')) {
                            eventName = line.slice(7)
                        } else if (line.startsWith(':')) {
                            // SSE comment (heartbeat) — ignore
                            continue
                        }
                    }

                    if (!data) continue

                    // Handle timeout event
                    if (eventName === 'timeout') {
                        onError?.(new Error('SSE stream timeout'))
                        return
                    }

                    // Parse status JSON
                    try {
                        const status = JSON.parse(data)
                        onStatus?.(status)

                        // Terminal states
                        if (status.status === 'completed' || status.status === 'failed') {
                            onComplete?.(status)
                            return
                        }
                    } catch (parseErr) {
                        console.warn('[checkout-sse] failed to parse SSE data:', data, parseErr)
                    }
                }
            }
        } catch (err) {
            // AbortError is expected when close() is called
            if (err.name === 'AbortError') return
            onError?.(err)
        }
    })()

    // Return a handle that allows the caller to abort the stream
    return {
        close() {
            controller.abort()
        }
    }
}

/**
 * Poll order status (for async 202 orders).
 * GET /api/v1/checkout/orders/:id
 *
 * @deprecated Prefer streamOrderStatus() (SSE) over polling.
 *   Polling creates additional QPS load on the server — exactly what we're
 *   trying to avoid by switching to async mode. This endpoint is kept as
 *   a fallback for environments where SSE/streaming is not available.
 */
export async function getCheckoutOrderStatus(orderId) {
    return request('GET', `/api/v1/checkout/orders/${orderId}`)
}

/**
 * Get QPS monitoring stats for the checkout endpoint.
 * GET /api/v1/checkout/stats
 */
export async function getCheckoutStats() {
    return request('GET', '/api/v1/checkout/stats')
}

/**
 * Update QPS threshold (admin).
 * PUT /api/v1/admin/checkout/threshold
 */
export async function setCheckoutThreshold(threshold) {
    return request('PUT', '/api/v1/admin/checkout/threshold', { threshold })
}
