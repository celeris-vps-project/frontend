/**
 * USDT Crypto Payment API — communicates with the payment module.
 *
 * Supports multi-network USDT payments with QR code scanning.
 * Networks: Arbitrum, Solana, TRC-20 (TRON), BSC, Polygon.
 */
import { request, API_BASE_URL, authHeaders } from './request'

/**
 * Get supported payment networks.
 * GET /api/v1/payment/networks (public, no auth)
 *
 * @returns {{ data: NetworkInfo[], currency: string }}
 */
export async function getPaymentNetworks() {
  const res = await request('GET', '/api/v1/payment/networks', null, false)
  return res.data || []
}

/**
 * Get enabled payment providers (for user checkout selection).
 * GET /api/v1/payment/providers (public, no auth)
 *
 * @returns {Array<{ id: string, type: string, name: string, networks?: string[] }>}
 */
export async function getPaymentProviders() {
  const res = await request('GET', '/api/v1/payment/providers', null, false)
  return res.data || []
}

/**
 * Initiate a payment for an order.
 * POST /api/v1/orders/:id/pay
 *
 * Supports two modes:
 *   1. Crypto (USDT): pass `network` to select a blockchain network
 *   2. Dynamic provider: pass `providerId` to route to a specific payment provider
 *
 * @param {string} orderId    - the order to pay
 * @param {string} [network]  - blockchain network (arbitrum, solana, trc20, bsc, polygon)
 * @param {string} [providerId] - payment provider ID for dynamic routing
 * @param {string} [couponCode] - optional activation/coupon code
 * @param {string} [payType] - optional EPay v1 channel (alipay, wxpay, etc.)
 * @returns {PayResponse} - includes payment_url, crypto details, etc.
 */
export async function initiatePayment(orderId, network, providerId, couponCode, payType) {
  const body = {}
  if (network) body.network = network
  if (providerId) body.provider_id = providerId
  if (couponCode) body.coupon_code = couponCode.trim()
  if (payType) body.pay_type = payType
  body.currency = 'USDT'
  const res = await request('POST', `/api/v1/orders/${orderId}/pay`, body)
  return res.data
}

/**
 * Get charge details for a pending crypto payment.
 * GET /api/v1/payment/charges/:id
 *
 * @param {string} chargeId
 * @returns {CryptoChargeDetail}
 */
export async function getChargeDetail(chargeId) {
  const res = await request('GET', `/api/v1/payment/charges/${chargeId}`)
  return res.data
}

export function streamPaymentStatus(orderId, { onStatus, onError } = {}) {
  const controller = new AbortController()

  ;(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/orders/${orderId}/payments/status/stream`, {
        method: 'GET',
        headers: authHeaders(),
        signal: controller.signal,
      })
      if (!res.ok) {
        throw new Error(`Payment status stream failed (${res.status})`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const event of events) {
          if (!event.trim() || event.startsWith(':')) continue
          const dataLine = event.split('\n').find((line) => line.startsWith('data: '))
          if (!dataLine) continue
          try {
            onStatus?.(JSON.parse(dataLine.slice(6)))
          } catch {
            // Ignore malformed stream fragments; polling remains as fallback.
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      onError?.(err)
    }
  })()

  return {
    close() {
      controller.abort()
    }
  }
}
