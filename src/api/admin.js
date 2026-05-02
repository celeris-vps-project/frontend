/**
 * Admin API — talks to /api/v1/admin/* endpoints (requires admin JWT).
 */
import { request, API_BASE_URL, authHeaders } from './request'

// ---- Current user ----

export async function fetchMe() {
  return await request('GET', '/api/v1/me')
}

// ---- Host Nodes ----

export async function listHostNodes(location) {
  const qs = location ? `?location=${encodeURIComponent(location)}` : ''
  const res = await request('GET', `/api/v1/admin/host-nodes${qs}`)
  return res.data || []
}

export async function getHostNode(id) {
  const res = await request('GET', `/api/v1/admin/host-nodes/${id}`)
  return res.data
}

export async function createHostNode({
  code,
  location,
  name,
  total_slots,
  nat_port_start,
  nat_port_end,
  nat_bridge,
  token_ttl_minutes,
  token_description
}) {
  const res = await request('POST', '/api/v1/admin/host-nodes', {
    code,
    location,
    name,
    total_slots,
    nat_port_start,
    nat_port_end,
    nat_bridge,
    token_ttl_minutes,
    token_description
  })
  return { node: res.data, bootstrap_token: res.bootstrap_token }
}

export async function enableHostNode(id) {
  const res = await request('POST', `/api/v1/admin/host-nodes/${id}/enable`)
  return res.data
}

export async function disableHostNode(id) {
  const res = await request('POST', `/api/v1/admin/host-nodes/${id}/disable`)
  return res.data
}

export async function revokeNodeToken(id) {
  return await request('POST', `/api/v1/admin/host-nodes/${id}/revoke-token`)
}

export async function createNodeBootstrapToken(nodeId, { ttl_minutes, description }) {
  const res = await request('POST', '/api/v1/admin/bootstrap-tokens', { node_id: nodeId, ttl_minutes, description })
  return res.data
}

// ---- Bootstrap Tokens ----

export async function listBootstrapTokens() {
  const res = await request('GET', '/api/v1/admin/bootstrap-tokens')
  return res.data || []
}

export async function createBootstrapToken({ ttl_minutes, description }) {
  const res = await request('POST', '/api/v1/admin/bootstrap-tokens', { ttl_minutes, description })
  return res.data
}

export async function revokeBootstrapToken(id) {
  return await request('DELETE', `/api/v1/admin/bootstrap-tokens/${id}`)
}

// ---- IP Addresses ----

export async function listIPs(nodeID) {
  const res = await request('GET', `/api/v1/admin/host-nodes/${nodeID}/ips`)
  return res.data || []
}

export async function addIP(nodeID, { address, version }) {
  const res = await request('POST', `/api/v1/admin/host-nodes/${nodeID}/ips`, { address, version })
  return res.data
}

// ---- Tasks ----

export async function enqueueTask(nodeID, { type, spec }) {
  const res = await request('POST', `/api/v1/admin/host-nodes/${nodeID}/tasks`, { type, spec })
  return res.data
}

// ---- Regions ----

export async function listRegions() {
  const res = await request('GET', '/api/v1/regions')
  return res.data || []
}

export async function listAllRegions() {
  const res = await request('GET', '/api/v1/admin/regions')
  return res.data || []
}

// ---- Resource Pools ----

export async function listResourcePools() {
  const res = await request('GET', '/api/v1/admin/resource-pools')
  return res.data || []
}

export async function getResourcePool(id) {
  const res = await request('GET', `/api/v1/admin/resource-pools/${id}`)
  return res.data
}

export async function createResourcePool({ name, region_id }) {
  const res = await request('POST', '/api/v1/admin/resource-pools', { name, region_id })
  return res.data
}

export async function updateResourcePool(id, { name, region_id }) {
  const res = await request('PUT', `/api/v1/admin/resource-pools/${id}`, { name, region_id })
  return res.data
}

export async function activateResourcePool(id) {
  const res = await request('POST', `/api/v1/admin/resource-pools/${id}/activate`)
  return res.data
}

export async function deactivateResourcePool(id) {
  const res = await request('POST', `/api/v1/admin/resource-pools/${id}/deactivate`)
  return res.data
}

export async function assignNodeToPool(poolId, nodeId) {
  const res = await request('POST', `/api/v1/admin/resource-pools/${poolId}/nodes`, { node_id: nodeId })
  return res
}

export async function removeNodeFromPool(poolId, nodeId) {
  const res = await request('DELETE', `/api/v1/admin/resource-pools/${poolId}/nodes/${nodeId}`)
  return res
}

// ---- Products (admin) ----

// ---- WebSocket Ticket ----

/**
 * Fetch a short-lived, one-time ticket for WebSocket authentication.
 * The JWT is sent via the normal Authorization header; the backend validates
 * the admin role and returns a ticket string.
 *
 * Uses fetch directly (bypasses global 401 interceptor in request.js) because
 * the WS ticket is non-critical — a failure here should NOT clear auth state
 * or trigger a login redirect.
 */
export async function fetchWsTicket() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/ws/ticket`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!response.ok) return null
    const data = await response.json()
    return data.ticket ?? null
  } catch {
    return null
  }
}

// ---- Products (admin management) ----

export async function listAllProducts() {
  const res = await request('GET', '/api/v1/admin/products')
  return res.data || []
}

export async function createProduct(payload) {
  const res = await request('POST', '/api/v1/admin/products', payload)
  return res.data
}

export async function enableProduct(id) {
  const res = await request('POST', `/api/v1/admin/products/${id}/enable`)
  return res.data
}

export async function disableProduct(id) {
  const res = await request('POST', `/api/v1/admin/products/${id}/disable`)
  return res.data
}

export async function updateProductPrice(id, price) {
  const res = await request('PUT', `/api/v1/admin/products/${id}/price`, price)
  return res.data
}

export async function updateProductNetworkMode(id, networkMode) {
  const res = await request('PUT', `/api/v1/admin/products/${id}/network`, { network_mode: networkMode })
  return res.data
}

export async function adjustProductStock(id, totalSlots) {
  const res = await request('PUT', `/api/v1/admin/products/${id}/stock`, { total_slots: totalSlots })
  return res.data
}

// ---- Payment Providers (admin management) ----

export async function listPaymentProviders() {
  const res = await request('GET', '/api/v1/admin/payment-providers')
  return res.data || []
}

export async function getPaymentProvider(id) {
  const res = await request('GET', `/api/v1/admin/payment-providers/${id}`)
  return res.data
}

export async function getProviderTypes() {
  const res = await request('GET', '/api/v1/admin/payment-providers/types')
  return res.data || []
}

export async function createPaymentProvider({ type, name, sort_order, config }) {
  const res = await request('POST', '/api/v1/admin/payment-providers', { type, name, sort_order, config })
  return res.data
}

export async function updatePaymentProvider(id, { name, sort_order, config }) {
  const res = await request('PUT', `/api/v1/admin/payment-providers/${id}`, { name, sort_order, config })
  return res.data
}

export async function enablePaymentProvider(id) {
  return await request('POST', `/api/v1/admin/payment-providers/${id}/enable`)
}

export async function disablePaymentProvider(id) {
  return await request('POST', `/api/v1/admin/payment-providers/${id}/disable`)
}

export async function deletePaymentProvider(id) {
  return await request('DELETE', `/api/v1/admin/payment-providers/${id}`)
}

// ---- Format helpers ----

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatPercent(val) {
  if (val == null) return '—'
  return `${val.toFixed(1)}%`
}
