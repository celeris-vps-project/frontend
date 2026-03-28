const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function getErrorMessage(data, fallback) {
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (typeof data.error === 'string') return data.error
  if (typeof data.message === 'string') return data.message
  return fallback
}

async function request(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

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

export async function login(email, password) {
  const data = await request('/api/v1/auth/login', { email, password })
  return {
    token: data.token,
    role: data.role || 'user',
    message: data.message || 'Login successful'
  }
}

export async function register(email, password) {
  const data = await request('/api/v1/auth/register', { email, password })
  return {
    token: data.token,
    role: data.role || 'user',
    message: data.message || 'Register successful'
  }
}

export function saveToken(token) {
  if (!token) return
  localStorage.setItem('auth_token', token)
}

export function saveRole(role) {
  if (!role) return
  localStorage.setItem('auth_role', role)
}

export function getToken() {
  return localStorage.getItem('auth_token')
}

export function getRole() {
  return localStorage.getItem('auth_role') || 'user'
}

export function isAdmin() {
  return getRole() === 'admin'
}

export function clearToken() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_role')
}

/**
 * Change the current user's password.
 * Uses the shared request helper for auth headers, toast, retry, etc.
 */
export async function changePassword(oldPassword, newPassword) {
  // Import dynamically to avoid circular dependency
  const { request } = await import('./request.js')
  return request('PUT', '/api/v1/me/password', {
    old_password: oldPassword,
    new_password: newPassword,
  })
}

/**
 * Fetch current user profile (GET /api/v1/me).
 */
export async function fetchMe() {
  const { request } = await import('./request.js')
  return request('GET', '/api/v1/me')
}
