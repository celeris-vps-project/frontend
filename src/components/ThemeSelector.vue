<script setup>
import { useI18n } from 'vue-i18n'
import { useTheme } from '../composables/useTheme'

const { t } = useI18n()
const { isDark, themeMode, setThemeMode } = useTheme()
</script>

<template>
  <label class="theme-selector" :title="t('nav.theme')">
    <span class="theme-icon" aria-hidden="true">
      <svg v-if="themeMode === 'system'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <line x1="8" y1="20" x2="16" y2="20" />
        <line x1="12" y1="16" x2="12" y2="20" />
      </svg>
      <svg v-else-if="isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    </span>

    <select
      class="theme-select"
      :value="themeMode"
      :aria-label="t('nav.theme')"
      @change="setThemeMode($event.target.value)"
    >
      <option value="light">{{ t('nav.themeLight') }}</option>
      <option value="dark">{{ t('nav.themeDark') }}</option>
      <option value="system">{{ t('nav.themeSystem') }}</option>
    </select>
  </label>
</template>

<style scoped>
.theme-selector {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  padding: 0.65rem 0.85rem;
  border-radius: 12px;
  color: var(--accent);
  cursor: pointer;
  transition: background 0.2s;
}

.theme-selector:hover {
  background: var(--accent-bg);
}

.theme-icon {
  display: inline-flex;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.theme-select {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  appearance: none;
}

.theme-select option {
  background: var(--bg-base);
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .theme-selector {
    justify-content: center;
    padding: 0.65rem;
  }

  .theme-select {
    position: absolute;
    inset: 0;
    width: 100%;
    opacity: 0;
  }
}
</style>
