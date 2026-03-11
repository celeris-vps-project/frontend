import { request } from './request'

// ---- Products API (public, returns enabled/on-sale products) ----

export async function listProducts() {
  const res = await request('GET', '/api/v1/products', null, false)
  return res.data || []
}

export async function getProduct(id) {
  const res = await request('GET', `/api/v1/products/${id}`, null, false)
  return res.data
}

// ---- Region & Node API (public, no JWT) ----

export async function listRegions() {
  const res = await request('GET', '/api/v1/regions', null, false)
  return res.data || []
}

// ---- Product Lines API (public, no JWT) ----
// Product lines are resource pools enriched with region info and product stats.
// Replaces the old groups API for customer-facing catalog browsing.

export async function listProductLines() {
  const res = await request('GET', '/api/v1/product-lines', null, false)
  return res.data || []
}

export async function listNodes(location) {
  const qs = location ? `?location=${encodeURIComponent(location)}` : ''
  const res = await request('GET', `/api/v1/nodes${qs}`, null, false)
  return res.data || []
}

export async function getNode(id) {
  const res = await request('GET', `/api/v1/nodes/${id}`, null, false)
  return res.data
}

// ---- Order API (used internally for instance purchase flow) ----

export async function createOrder({ productID, currency, priceAmount, hostname, plan, region, os, cpu, memoryMB, diskGB }) {
  const res = await request('POST', '/api/v1/orders', {
    product_id: productID,
    currency,
    price_amount: priceAmount,
    hostname, plan, region, os,
    cpu, memory_mb: memoryMB, disk_gb: diskGB
  })
  return res.data
}

// GET /orders/:id — get a single order by ID
export async function getOrder(id) {
  const res = await request('GET', `/api/v1/orders/${id}`)
  return res.data
}

// POST /orders/:id/pay — initiate payment for a pending order
export async function payOrder(id) {
  const res = await request('POST', `/api/v1/orders/${id}/pay`)
  return res.data
}

// ---- Instance API (matches backend /api/v1/instances) ----

// POST /instances — purchase a new instance (customer_id from JWT)
export async function purchaseInstance({ orderID, region, hostname, plan, os, cpu, memoryMB, diskGB }) {
  const res = await request('POST', '/api/v1/instances', {
    order_id: orderID,
    region,
    hostname,
    plan,
    os,
    cpu,
    memory_mb: memoryMB,
    disk_gb: diskGB
  })
  return res.data
}

// GET /instances — list current user's instances (JWT)
export async function listInstances() {
  const res = await request('GET', '/api/v1/instances')
  return res.data || []
}

// GET /instances/:id
export async function getInstance(id) {
  const res = await request('GET', `/api/v1/instances/${id}`)
  return res.data
}

// POST /instances/:id/start
export async function startInstance(id) {
  const res = await request('POST', `/api/v1/instances/${id}/start`)
  return res.data
}

// POST /instances/:id/stop
export async function stopInstance(id) {
  const res = await request('POST', `/api/v1/instances/${id}/stop`)
  return res.data
}

// POST /instances/:id/suspend
export async function suspendInstance(id) {
  const res = await request('POST', `/api/v1/instances/${id}/suspend`)
  return res.data
}

// POST /instances/:id/unsuspend
export async function unsuspendInstance(id) {
  const res = await request('POST', `/api/v1/instances/${id}/unsuspend`)
  return res.data
}

// POST /instances/:id/terminate
export async function terminateInstance(id) {
  const res = await request('POST', `/api/v1/instances/${id}/terminate`)
  return res.data
}

// ---- Status helpers ----

const STATUS_LABELS = {
  pending: 'Pending',
  running: 'Running',
  stopped: 'Stopped',
  suspended: 'Suspended',
  terminated: 'Terminated'
}

export function instanceStatusLabel(status) {
  return STATUS_LABELS[status] || status
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
