/**
 * Unified Checkout API — communicates with the adaptive checkout module.
 *
 * This replaces the flash-sale API for real product purchases.
 * The adaptive dispatcher automatically returns:
 *   - 200: purchase completed synchronously (normal load)
 *   - 202: order queued for async processing (high load)
 *
 * The frontend handles both responses transparently — no need for
 * separate flash-sale and normal checkout pages.
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
 *   - http_status=202 → queued for processing (async, poll status)
 */
export async function checkout(productId, hostname, os) {
    const res = await fetch(`${API_BASE_URL}/api/v1/checkout`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
            product_id: productId,
            hostname: hostname || 'vps-' + productId,
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
 * Poll order status (for async 202 orders).
 * GET /api/v1/checkout/orders/:id
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
