/**
 * Admin API — talks to /api/v1/admin/* endpoints (requires admin JWT).
 */
import { getToken } from './auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888'

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

async function request(method, path, body = null) {
  const opts = { method, headers: authHeaders() }
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

export async function createHostNode({ code, location, name, secret }) {
  const res = await request('POST', '/api/v1/admin/host-nodes', { code, location, name, secret })
  return res.data
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

// ---- Products (admin) ----

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

export async function adjustProductStock(id, totalSlots) {
  const res = await request('PUT', `/api/v1/admin/products/${id}/stock`, { total_slots: totalSlots })
  return res.data
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
