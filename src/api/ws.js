/**
 * WebSocket composable for real-time node state updates.
 *
 * Usage:
 *   const { nodeStates, connected } = useNodeStatusWS()
 *
 * `nodeStates` is a reactive Map<nodeId, statePayload> that is updated
 * every time the server pushes a NodeStateUpdatedEvent over the WebSocket.
 *
 * Before connecting, the composable fetches a short-lived one-time ticket
 * from the REST API (authenticated via JWT + admin role check). The ticket
 * is then passed as a query parameter for the WS upgrade — the actual JWT
 * never appears in the WebSocket URL.
 *
 * The composable auto-reconnects on disconnect with exponential back-off
 * and tears down cleanly on component unmount.
 */
import { ref, reactive, onUnmounted } from 'vue'
import { fetchWsTicket } from './admin'
import { fetchInstanceWsTicket } from './billing'

/** Derive the WS base URL from the HTTP base URL (supports both http and https). */
function wsBaseUrl() {
  const httpBase =
    import.meta.env.VITE_API_BASE_URL || window.location.origin
  return httpBase.replace(/^http/, 'ws')
}

/**
 * Connect to the admin node-status WebSocket.
 * Returns reactive state that is kept up-to-date automatically.
 */
export function useNodeStatusWS() {
  const nodeStates = reactive({})  // { [nodeId]: { status, cpu_usage, ... } }
  const connected = ref(false)

  let ws = null
  let reconnectTimer = null
  let reconnectDelay = 1000       // start at 1 s
  const MAX_DELAY = 30000         // cap at 30 s
  let intentionalClose = false

  function connect() {
    // 1. Obtain a short-lived one-time ticket via authenticated REST call
    fetchWsTicket()
      .then((ticket) => {
        if (!ticket) {
          console.warn('[ws] failed to obtain ticket (not logged in or not admin?)')
          scheduleReconnect()
          return
        }

        const url = `${wsBaseUrl()}/api/v1/admin/ws/nodes?ticket=${encodeURIComponent(ticket)}`
        ws = new WebSocket(url)

        ws.onopen = () => {
          connected.value = true
          reconnectDelay = 1000 // reset back-off on success
          console.log('[ws] node status connected')
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.node_id) {
              // Merge update into the reactive map
              nodeStates[data.node_id] = data
            }
          } catch (e) {
            console.warn('[ws] failed to parse message', e)
          }
        }

        ws.onclose = () => {
          connected.value = false
          ws = null
          if (!intentionalClose) {
            console.log(`[ws] disconnected, reconnecting in ${reconnectDelay}ms`)
            scheduleReconnect()
          }
        }

        ws.onerror = (err) => {
          console.warn('[ws] error', err)
          ws?.close()
        }
      })
      .catch((err) => {
        console.warn('[ws] ticket fetch failed', err)
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

  // Auto-connect on composable creation
  connect()

  // Auto-disconnect when the component is unmounted
  onUnmounted(disconnect)

  return { nodeStates, connected, disconnect }
}

/**
 * Connect to the customer instance-status WebSocket.
 * Returns a reactive map keyed by instance ID.
 */
export function useInstanceStatusWS() {
  const instanceStates = reactive({})
  const connected = ref(false)

  let ws = null
  let reconnectTimer = null
  let reconnectDelay = 1000
  const MAX_DELAY = 30000
  let intentionalClose = false

  function connect() {
    fetchInstanceWsTicket()
      .then((ticket) => {
        if (!ticket) {
          console.warn('[instance-ws] failed to obtain ticket')
          scheduleReconnect()
          return
        }

        const url = `${wsBaseUrl()}/api/v1/ws/instances?ticket=${encodeURIComponent(ticket)}`
        ws = new WebSocket(url)

        ws.onopen = () => {
          connected.value = true
          reconnectDelay = 1000
          console.log('[instance-ws] connected')
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.id) {
              instanceStates[data.id] = data
            }
          } catch (e) {
            console.warn('[instance-ws] failed to parse message', e)
          }
        }

        ws.onclose = () => {
          connected.value = false
          ws = null
          if (!intentionalClose) {
            console.log(`[instance-ws] disconnected, reconnecting in ${reconnectDelay}ms`)
            scheduleReconnect()
          }
        }

        ws.onerror = (err) => {
          console.warn('[instance-ws] error', err)
          ws?.close()
        }
      })
      .catch((err) => {
        console.warn('[instance-ws] ticket fetch failed', err)
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

  connect()
  onUnmounted(disconnect)

  return { instanceStates, connected, disconnect }
}

