import { reactive, computed } from 'vue'

/**
 * Global API status tracker.
 *
 * Tracks the number of in-flight requests and backend connectivity.
 * Used by TopProgressBar and request.js.
 *
 * Usage:
 *   const api = useApiStatus()
 *   api.start()        // call when a request begins
 *   api.end()          // call when a request ends (success or fail)
 *   api.setOffline()   // mark backend as unreachable
 *   api.setOnline()    // mark backend as reachable again
 *   api.isLoading      // computed: true when ≥ 1 request in flight
 *   api.isOffline      // computed: true when backend is unreachable
 */
const state = reactive({
  activeRequests: 0,
  offline: false,
})

export function useApiStatus() {
  function start() {
    state.activeRequests++
  }

  function end() {
    state.activeRequests = Math.max(0, state.activeRequests - 1)
  }

  function setOffline() {
    state.offline = true
  }

  function setOnline() {
    state.offline = false
  }

  const isLoading = computed(() => state.activeRequests > 0)
  const isOffline = computed(() => state.offline)
  const activeRequests = computed(() => state.activeRequests)

  return { start, end, setOffline, setOnline, isLoading, isOffline, activeRequests }
}
