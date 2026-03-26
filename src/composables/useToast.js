import { reactive } from 'vue'

const state = reactive({
  toasts: [],
  nextId: 1,
})

/**
 * Global toast notification system.
 *
 * Usage:
 *   const toast = useToast()
 *   toast.success('Done!')
 *   toast.error('Oops', { duration: 8000 })
 *   toast.info('Heads up')
 *   toast.warning('Careful!')
 */
export function useToast() {
  function show(message, options = {}) {
    const id = state.nextId++
    const toast = {
      id,
      message,
      type: options.type || 'info',
      duration: options.duration ?? 5000,
      paused: false,
      createdAt: Date.now(),
    }
    state.toasts.push(toast)
    return id
  }

  function dismiss(id) {
    const idx = state.toasts.findIndex((t) => t.id === id)
    if (idx !== -1) state.toasts.splice(idx, 1)
  }

  function success(message, options = {}) {
    return show(message, { ...options, type: 'success' })
  }

  function error(message, options = {}) {
    return show(message, { ...options, type: 'error' })
  }

  function warning(message, options = {}) {
    return show(message, { ...options, type: 'warning' })
  }

  function info(message, options = {}) {
    return show(message, { ...options, type: 'info' })
  }

  return { toasts: state.toasts, show, dismiss, success, error, warning, info }
}
