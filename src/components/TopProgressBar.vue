<template>
  <Teleport to="body">
    <Transition name="progress-bar">
      <div v-if="isLoading" class="top-progress-bar">
        <div class="progress-track">
          <div class="progress-fill"></div>
        </div>
      </div>
    </Transition>

    <!-- Offline banner -->
    <Transition name="offline-banner">
      <div v-if="isOffline" class="offline-banner">
        <div class="offline-content">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
            <line x1="12" y1="20" x2="12.01" y2="20"/>
          </svg>
          <span class="offline-text">{{ t('apiStatus.offline') }}</span>
          <span class="offline-dot"></span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useApiStatus } from '../composables/useApiStatus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { isLoading, isOffline } = useApiStatus()
</script>

<style scoped>
/* ── Top Progress Bar ── */
.top-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 99999;
  height: 3px;
  pointer-events: none;
}

.progress-track {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

.progress-fill {
  height: 100%;
  width: 100%;
  background: var(--accent-gradient);
  border-radius: 0 2px 2px 0;
  animation: progress-indeterminate 1.8s cubic-bezier(0.65, 0, 0.35, 1) infinite;
  box-shadow: 0 0 10px var(--accent), 0 0 4px var(--accent);
}

@keyframes progress-indeterminate {
  0% {
    transform: translateX(-100%) scaleX(0.3);
  }
  40% {
    transform: translateX(-20%) scaleX(0.6);
  }
  60% {
    transform: translateX(20%) scaleX(0.4);
  }
  100% {
    transform: translateX(100%) scaleX(0.3);
  }
}

/* Progress bar transition */
.progress-bar-enter-active {
  transition: opacity 0.15s ease;
}

.progress-bar-leave-active {
  transition: opacity 0.4s ease 0.1s;
}

.progress-bar-enter-from,
.progress-bar-leave-to {
  opacity: 0;
}

/* ── Offline Banner ── */
.offline-banner {
  position: fixed;
  top: 3px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99998;
  pointer-events: auto;
}

.offline-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 0 0 12px 12px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--warning);

  /* Glassmorphism */
  background: rgba(245, 158, 11, 0.08);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--warning-border);
  border-top: none;
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.1);
}

[data-theme="dark"] .offline-content {
  background: rgba(251, 191, 36, 0.1);
  box-shadow: 0 4px 16px rgba(251, 191, 36, 0.08);
}

.offline-content svg {
  flex-shrink: 0;
  opacity: 0.9;
}

.offline-text {
  white-space: nowrap;
}

.offline-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--warning);
  animation: offline-pulse 1.5s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes offline-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

/* Offline banner transition */
.offline-banner-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.offline-banner-leave-active {
  transition: all 0.25s ease-in;
}

.offline-banner-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-100%);
}

.offline-banner-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-100%);
}
</style>
