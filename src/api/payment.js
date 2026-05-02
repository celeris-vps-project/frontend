/**
 * USDT Crypto Payment API — communicates with the payment module.
 *
 * Supports multi-network USDT payments with QR code scanning.
 * Networks: Arbitrum, Solana, TRC-20 (TRON), BSC, Polygon.
 */
import { request } from './request'

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
 * @returns {PayResponse} - includes payment_url, crypto details, etc.
 */
export async function initiatePayment(orderId, network, providerId, couponCode) {
  const body = {}
  if (network) body.network = network
  if (providerId) body.provider_id = providerId
  if (couponCode) body.coupon_code = couponCode.trim()
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
