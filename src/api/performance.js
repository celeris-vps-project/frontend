/**
 * Performance monitoring API — real-time endpoint metrics via WebSocket.
 *
 * Provides a Vue composable (usePerformanceWS) that connects to the
 * admin performance WebSocket and maintains reactive state with live
 * snapshots of top-N endpoint QPS, latency, and mitigation data.
 */
import { ref, reactive, onUnmounted } from 'vue'
import { request, API_BASE_URL, authHeaders } from './request'

/** Derive WS base URL from HTTP base URL. */
function wsBaseUrl() {
  const httpBase = import.meta.env.VITE_API_BASE_URL || ''
  return httpBase.replace(/^http/, 'ws')
}

/**
 * Fetch a short-lived one-time ticket for the performance WebSocket.
 *
 * Uses fetch directly (bypasses global 401 interceptor) because the WS
 * ticket is non-critical — a failure should NOT clear auth or redirect.
 */
export async function fetchPerfTicket() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/ws/perf-ticket`, {
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

/** Update the server-side broadcast interval (seconds). */
export async function setPerformanceInterval(interval) {
  return request('PUT', '/api/v1/admin/performance/interval', { interval })
}

/** Fetch a single performance snapshot (REST fallback). */
export async function getPerformanceSnapshot() {
  return request('GET', '/api/v1/admin/performance/snapshot')
}

/**
 * Vue composable — connects to the performance WebSocket.
 *
 * Returns reactive state:
 *   - snapshot: latest PerformanceSnapshot
 *   - history:  array of past snapshots (for charting)
 *   - connected: boolean
 *   - sendInterval(sec): change server push interval via WS
 */
export function usePerformanceWS(maxHistory = 120) {
  const snapshot = ref(null)
  const history = reactive([])
  const connected = ref(false)

  let ws = null
  let reconnectTimer = null
  let reconnectDelay = 1000
  const MAX_DELAY = 30000
  let intentionalClose = false

  function connect() {
    fetchPerfTicket()
      .then((ticket) => {
        if (!ticket) {
          console.warn('[perf-ws] failed to obtain ticket')
          scheduleReconnect()
          return
        }

        const url = `${wsBaseUrl()}/api/v1/admin/ws/performance?ticket=${encodeURIComponent(ticket)}`
        ws = new WebSocket(url)

        ws.onopen = () => {
          connected.value = true
          reconnectDelay = 1000
          console.log('[perf-ws] connected')
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'performance_snapshot') {
              snapshot.value = data
              history.push({
                timestamp: new Date(data.timestamp),
                totalQPS: data.total_qps,
                mitigatedPct: data.mitigated_pct,
                endpoints: (data.top_endpoints || []).map(e => ({
                  key: `${e.method} ${e.path}`,
                  qps: e.qps,
                  avgLatency: e.avg_latency_ms,
                  totalReqs: e.total_reqs,
                  mitigated: e.mitigated
                }))
              })
              if (history.length > maxHistory) {
                history.splice(0, history.length - maxHistory)
              }
            }
          } catch (e) {
            console.warn('[perf-ws] parse error', e)
          }
        }

        ws.onclose = () => {
          connected.value = false
          ws = null
          if (!intentionalClose) {
            console.log(`[perf-ws] disconnected, reconnecting in ${reconnectDelay}ms`)
            scheduleReconnect()
          }
        }

        ws.onerror = (err) => {
          console.warn('[perf-ws] error', err)
          ws?.close()
        }
      })
      .catch((err) => {
        console.warn('[perf-ws] ticket fetch failed', err)
        scheduleReconnect()
      })
  }

  function scheduleReconnect() {
    if (reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY)
      connect()
    }, reconnectDelay)
  }

  function disconnect() {
    intentionalClose = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      ws.close()
      ws = null
    }
    connected.value = false
  }

  /** Send a command to change the server push interval via WebSocket. */
  function sendInterval(sec) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'set_interval', interval: sec }))
    }
  }

  connect()
  onUnmounted(disconnect)

  return { snapshot, history, connected, disconnect, sendInterval }
}
