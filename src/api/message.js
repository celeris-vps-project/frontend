const MESSAGE_API_BASE_URL = import.meta.env.VITE_MESSAGE_API_BASE_URL || 'http://localhost:8090'

async function request(method, path, body = null) {
  const response = await fetch(`${MESSAGE_API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || '请求消息服务失败')
  }

  return data
}

export async function pingMessageService() {
  try {
    const data = await request('GET', '/api/admin/health')
    return data?.status === 'UP'
  } catch {
    return false
  }
}

export async function listMessageRecords(filters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.trim() !== '') {
      params.set(key, value)
    }
  })
  const qs = params.toString() ? `?${params.toString()}` : ''
  return await request('GET', `/api/admin/messages${qs}`)
}

export async function getMessageRecord(id) {
  return await request('GET', `/api/admin/messages/${id}`)
}

export async function replayMessage(id) {
  return await request('POST', `/api/admin/messages/${id}/replay`)
}
