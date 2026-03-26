import { ref, watch } from 'vue'

const STORAGE_KEY = 'celeris-theme'

// Shared reactive state
const isDark = ref(false)

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

function loadTheme() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved !== null) {
    isDark.value = saved === 'dark'
  } else {
    // Default to light mode (NapCat style)
    isDark.value = false
  }
  applyTheme(isDark.value)
}

function toggleTheme() {
  isDark.value = !isDark.value
  localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
  applyTheme(isDark.value)
}

// Initialize on first import
loadTheme()

export function useTheme() {
  return {
    isDark,
    toggleTheme
  }
}
