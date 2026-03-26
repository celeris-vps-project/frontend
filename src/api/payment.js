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
 * Initiate a USDT payment for an order on a specific network.
 * POST /api/v1/orders/:id/pay
 *
 * @param {string} orderId - the order to pay
 * @param {string} network - blockchain network (arbitrum, solana, trc20, bsc, polygon)
 * @returns {PayResponse} - includes crypto details (wallet, QR, expiry)
 */
export async function initiatePayment(orderId, network) {
  const body = {}
  if (network) body.network = network
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
