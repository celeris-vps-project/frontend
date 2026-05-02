import { ref } from 'vue'

const STORAGE_KEY = 'celeris-theme'
const THEME_MODES = ['light', 'dark', 'system']

// Shared reactive state
const isDark = ref(false)
const themeMode = ref('system')
const systemPrefersDark = ref(false)

let initialized = false
let mediaQuery = null

function normalizeThemeMode(mode) {
  return THEME_MODES.includes(mode) ? mode : 'system'
}

function readSavedThemeMode() {
  try {
    return normalizeThemeMode(localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'system'
  }
}

function readSystemPreference() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolveIsDark(mode = themeMode.value) {
  if (mode === 'system') {
    return systemPrefersDark.value
  }
  return mode === 'dark'
}

function applyTheme() {
  if (typeof document === 'undefined') return

  isDark.value = resolveIsDark()
  const appliedTheme = isDark.value ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', appliedTheme)
  document.documentElement.setAttribute('data-theme-mode', themeMode.value)
  document.documentElement.style.colorScheme = appliedTheme
}

function loadTheme() {
  themeMode.value = readSavedThemeMode()
  systemPrefersDark.value = readSystemPreference()
  applyTheme()
}

function bindSystemThemeListener() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return
  }

  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = event => {
    systemPrefersDark.value = event.matches
    if (themeMode.value === 'system') {
      applyTheme()
    }
  }

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleChange)
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(handleChange)
  }
}

function setThemeMode(mode) {
  themeMode.value = normalizeThemeMode(mode)
  try {
    localStorage.setItem(STORAGE_KEY, themeMode.value)
  } catch {
    // Ignore storage failures; the active session can still use the selected theme.
  }
  applyTheme()
}

function toggleTheme() {
  const currentIndex = THEME_MODES.indexOf(themeMode.value)
  const nextMode = THEME_MODES[(currentIndex + 1) % THEME_MODES.length]
  setThemeMode(nextMode)
}

function initTheme() {
  if (initialized) return
  initialized = true
  loadTheme()
  bindSystemThemeListener()
}

// Initialize on first import
initTheme()

export function useTheme() {
  return {
    isDark,
    themeMode,
    setThemeMode,
    toggleTheme
  }
}
