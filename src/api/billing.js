import { request, API_BASE_URL, authHeaders } from './request'

// ---- Invoice API (authenticated, billing module) ----

export async function listInvoices() {
  const res = await request('GET', '/api/v1/invoices')
  return res.data || []
}

export async function getInvoice(id) {
  const res = await request('GET', `/api/v1/invoices/${id}`)
  return res.data
}

export async function createInvoice(customerID, currency, billingCycle, periodStart, periodEnd) {
  const body = { customer_id: customerID, currency }
  if (billingCycle) body.billing_cycle = billingCycle
  if (periodStart) body.period_start = periodStart
  if (periodEnd) body.period_end = periodEnd
  const res = await request('POST', '/api/v1/admin/invoices', body)
  return res.data
}

export async function addLineItem(invoiceID, item) {
  const res = await request('POST', `/api/v1/admin/invoices/${invoiceID}/line-items`, item)
  return res.data
}

export async function setTax(invoiceID, amount) {
  const res = await request('PUT', `/api/v1/admin/invoices/${invoiceID}/tax`, { amount })
  return res.data
}

export async function issueInvoice(invoiceID, dueAt) {
  const body = {}
  if (dueAt) body.due_at = dueAt
  const res = await request('POST', `/api/v1/admin/invoices/${invoiceID}/issue`, body)
  return res.data
}

export async function recordPayment(invoiceID, amount) {
  const res = await request('POST', `/api/v1/admin/invoices/${invoiceID}/payments`, { amount })
  return res.data
}

export async function voidInvoice(invoiceID, reason) {
  const res = await request('POST', `/api/v1/admin/invoices/${invoiceID}/void`, { reason })
  return res.data
}

// ---- Money formatting ----

const CURRENCY_SYMBOLS = {
  usd: '$', eur: '€', gbp: '£', jpy: '¥', twd: 'NT$', cny: '¥'
}

export function formatMoney(cents, currency = 'usd') {
  const cur = (currency || 'usd').toLowerCase()
  const symbol = CURRENCY_SYMBOLS[cur] || cur.toUpperCase() + ' '
  // JPY and TWD are zero-decimal currencies
  if (cur === 'jpy') return `${symbol}${cents}`
  return `${symbol}${(cents / 100).toFixed(2)}`
}

// ---- Billing cycle helpers ----

const CYCLE_LABELS = {
  one_time: 'One-time',
  monthly: 'Monthly',
  yearly: 'Yearly'
}

export function billingCycleLabel(cycle) {
  return CYCLE_LABELS[cycle] || cycle
}

// ---- Products API (public, returns enabled/on-sale products) ----

export async function listProducts() {
  const res = await request('GET', '/api/v1/products', null, false)
  return res.data || []
}

export async function getProduct(id) {
  const res = await request('GET', `/api/v1/products/${id}`, null, false)
  return res.data
}

// ---- Region & Node API ----

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
  const res = await request('GET', `/api/v1/admin/nodes${qs}`)
  return res.data || []
}

export async function getNode(id) {
  const res = await request('GET', `/api/v1/admin/nodes/${id}`)
  return res.data
}

// GET /orders/:id — get a single order by ID
export async function getOrder(id) {
  const res = await request('GET', `/api/v1/orders/${id}`)
  return res.data
}

// GET /orders — list current user's orders.
export async function listOrders() {
  const res = await request('GET', '/api/v1/orders')
  return res.data || []
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

export async function fetchInstanceWsTicket() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/ws/instances/ticket`, {
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

// ---- Status helpers ----

const STATUS_LABELS = {
  pending: 'Pending',
  provisioning: 'Provisioning',
  active: 'Active',
  running: 'Running',
  stopped: 'Stopped',
  paused: 'Paused',
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
