import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { STORAGE_KEY } from '../i18n/index.js'

export function useLocale() {
  const { locale } = useI18n()

  const currentLocale = computed(() => locale.value)
  const isZhCN = computed(() => locale.value === 'zh-CN')
  const isEn = computed(() => locale.value === 'en')

  function setLocale(lang) {
    locale.value = lang
    localStorage.setItem(STORAGE_KEY, lang)
    document.documentElement.setAttribute('lang', lang)
  }

  function toggleLocale() {
    setLocale(locale.value === 'zh-CN' ? 'en' : 'zh-CN')
  }

  const localeLabel = computed(() => locale.value === 'zh-CN' ? 'English' : '中文')

  return {
    currentLocale,
    isZhCN,
    isEn,
    setLocale,
    toggleLocale,
    localeLabel,
  }
}
