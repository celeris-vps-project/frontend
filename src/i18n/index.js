import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN.js'
import en from './locales/en.js'

const STORAGE_KEY = 'celeris-locale'

function getDefaultLocale() {
  // 1. Check localStorage
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && (saved === 'zh-CN' || saved === 'en')) return saved

  // 2. Check browser language
  const browserLang = navigator.language || navigator.userLanguage || ''
  if (browserLang.startsWith('zh')) return 'zh-CN'

  return 'en'
}

const i18n = createI18n({
  legacy: false, // Composition API mode
  locale: getDefaultLocale(),
  fallbackLocale: 'en',
  messages: {
    'zh-CN': zhCN,
    en,
  },
})

// Sync HTML lang attribute on initial load
document.documentElement.setAttribute('lang', i18n.global.locale.value)

export default i18n
export { STORAGE_KEY }
