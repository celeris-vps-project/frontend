import { computed, onBeforeUnmount, ref } from 'vue'

export function useCooldown(seconds = 60) {
  const remaining = ref(0)
  let timerID = null

  const coolingDown = computed(() => remaining.value > 0)

  function clearTimer() {
    if (timerID !== null) {
      clearInterval(timerID)
      timerID = null
    }
  }

  function startCooldown(duration = seconds) {
    clearTimer()
    remaining.value = duration
    timerID = setInterval(() => {
      remaining.value -= 1
      if (remaining.value <= 0) {
        remaining.value = 0
        clearTimer()
      }
    }, 1000)
  }

  onBeforeUnmount(clearTimer)

  return {
    remaining,
    coolingDown,
    startCooldown
  }
}
