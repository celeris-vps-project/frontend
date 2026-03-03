const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888'
import { getToken } from './auth'

function authHeaders() {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

function getErrorMessage(data, fallback) {
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (typeof data.error === 'string') return data.error
  if (typeof data.message === 'string') return data.message
  return fallback
}

async function request(method, path, body = null, auth = true) {
  const headers = auth ? authHeaders() : { 'Content-Type': 'application/json' }
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)

  const response = await fetch(`${API_BASE_URL}${path}`, opts)

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

// ---- Location & Node API (public, no JWT) ----

export async function listLocations() {
  const res = await request('GET', '/api/v1/locations', null, false)
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

export async function createOrder({ currency, priceAmount, hostname, plan, region, os, cpu, memoryMB, diskGB }) {
  const res = await request('POST', '/api/v1/orders', {
    currency,
    price_amount: priceAmount,
    hostname, plan, region, os,
    cpu, memory_mb: memoryMB, disk_gb: diskGB
  })
  return res.data
}

// ---- Instance API (matches backend /api/v1/instances) ----

// POST /instances — purchase a new instance (customer_id from JWT)
export async function purchaseInstance({ orderID, nodeID, hostname, plan, os, cpu, memoryMB, diskGB }) {
  const res = await request('POST', '/api/v1/instances', {
    order_id: orderID,
    node_id: nodeID,
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
