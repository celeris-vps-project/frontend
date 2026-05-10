<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import RFB from '@novnc/novnc'
import { createConsoleSession, getInstance } from '../api/billing.js'
import { instanceConsoleWsUrl } from '../api/ws'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const instance = ref(null)
const loading = ref(true)
const reconnecting = ref(false)
const connected = ref(false)
const error = ref('')
const consoleContainer = ref(null)
const reconnectAttempt = ref(0)
let rfb = null
let reconnectTimer = null
let closedByUser = false
let connectGeneration = 0

const MAX_RECONNECT_ATTEMPTS = 10
const INITIAL_RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 10000

const queryVmName = computed(() => (
  typeof route.query.vmname === 'string' ? route.query.vmname : ''
))
const title = computed(() => instance.value?.hostname || queryVmName.value || t('instanceDetail.console'))
const statusLabel = computed(() => {
  if (reconnecting.value) return t('instanceDetail.consoleReconnecting')
  if (loading.value) return t('instanceDetail.consoleConnecting')
  if (connected.value) return t('instanceDetail.consoleConnected')
  if (error.value) return t('instanceDetail.consoleFailed')
  return t('instanceDetail.consoleDisconnected')
})
const overlayLabel = computed(() => (
  reconnecting.value ? t('instanceDetail.consoleReconnecting') : t('instanceDetail.consoleConnecting')
))

onMounted(() => connectConsole({ resetAttempts: true }))
onUnmounted(() => {
  closedByUser = true
  clearReconnectTimer()
  disconnectConsole()
})

async function connectConsole({ resetAttempts = false, fromReconnect = false } = {}) {
  const generation = ++connectGeneration
  if (resetAttempts) {
    reconnectAttempt.value = 0
  }
  clearReconnectTimer()
  disconnectConsole()
  loading.value = true
  reconnecting.value = fromReconnect
  error.value = ''
  try {
    instance.value = await getInstance(route.params.id)
    const session = await createConsoleSession(route.params.id)
    const vncPassword = session.vnc_ticket
    if (!vncPassword) {
      throw new Error('missing console VNC ticket')
    }

    await nextTick()
    if (closedByUser || generation !== connectGeneration) return
    const nextRfb = new RFB(consoleContainer.value, instanceConsoleWsUrl(session.ticket), {
      credentials: { password: vncPassword }
    })
    rfb = nextRfb
    nextRfb.scaleViewport = true
    nextRfb.resizeSession = route.query.resize !== 'off'
    nextRfb.viewOnly = false
    nextRfb.clipViewport = false
    nextRfb.focusOnClick = true
    nextRfb.addEventListener('connect', () => {
      if (rfb !== nextRfb) return
      connected.value = true
      loading.value = false
      reconnecting.value = false
      error.value = ''
      reconnectAttempt.value = 0
    })
    nextRfb.addEventListener('disconnect', () => {
      if (rfb !== nextRfb) return
      connected.value = false
      rfb = null
      loading.value = false
      if (!closedByUser) {
        scheduleReconnect()
      }
    })
    nextRfb.addEventListener('credentialsrequired', () => {
      if (rfb !== nextRfb) return
      error.value = t('instanceDetail.consoleAuthRequired')
      disconnectConsole()
    })
  } catch (err) {
    if (closedByUser || generation !== connectGeneration) return
    error.value = err.message
    if (fromReconnect) {
      scheduleReconnect()
    }
  } finally {
    if (generation === connectGeneration) {
      loading.value = false
    }
  }
}

function disconnectConsole() {
  if (rfb) {
    rfb.disconnect()
    rfb = null
  }
  connected.value = false
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function scheduleReconnect() {
  if (closedByUser) return
  if (reconnectAttempt.value >= MAX_RECONNECT_ATTEMPTS) {
    reconnecting.value = false
    error.value = t('instanceDetail.consoleReconnectFailed')
    return
  }

  reconnectAttempt.value += 1
  const delay = Math.min(
    INITIAL_RECONNECT_DELAY * (2 ** (reconnectAttempt.value - 1)),
    MAX_RECONNECT_DELAY
  )
  error.value = ''
  reconnecting.value = true
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectConsole({ fromReconnect: true })
  }, delay)
}

function retryConsole() {
  closedByUser = false
  connectConsole({ resetAttempts: true })
}

function closeWindow() {
  closedByUser = true
  clearReconnectTimer()
  disconnectConsole()
  window.close()
  if (!window.closed) {
    router.push({ name: 'instance-detail', params: { id: route.params.id } })
  }
}
</script>

<template>
  <div class="console-window">
    <header class="console-toolbar">
      <div class="console-title">
        <span>{{ title }}</span>
        <small>#{{ String(route.params.id).slice(0, 8) }}</small>
      </div>
      <div class="console-actions">
        <span class="console-state" :class="{ connected, failed: Boolean(error) }">
          <span class="state-dot"></span>
          {{ statusLabel }}
        </span>
        <button v-if="error" class="toolbar-btn" @click="retryConsole">{{ t('common.retry') }}</button>
        <button class="toolbar-btn" @click="closeWindow">{{ t('common.back') }}</button>
      </div>
    </header>

    <main class="console-main">
      <div ref="consoleContainer" class="console-surface"></div>

      <div v-if="loading || reconnecting" class="console-overlay">
        <div class="spinner"></div>
        <span>{{ overlayLabel }}</span>
      </div>

      <div v-else-if="error" class="console-overlay error-overlay">
        <strong>{{ t('instanceDetail.consoleFailed') }}</strong>
        <p>{{ error }}</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.console-window {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #07090d;
  color: #e5e7eb;
}

.console-toolbar {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 0.9rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: #111318;
}

.console-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.console-title span {
  font-weight: 700;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.console-title small {
  color: rgba(229, 231, 235, 0.55);
  font-size: 0.75rem;
}

.console-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.console-state {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 34px;
  padding: 0 0.65rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(229, 231, 235, 0.72);
  font-size: 0.82rem;
  white-space: nowrap;
}

.console-state.connected {
  color: #4ade80;
}

.console-state.failed {
  color: #f87171;
}

.state-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
}

.toolbar-btn {
  min-height: 34px;
  padding: 0 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: #f8fafc;
  font-weight: 600;
  cursor: pointer;
}

.toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.console-main {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #090b0f;
}

.console-surface {
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 56px);
  outline: none;
}

.console-surface :deep(canvas) {
  outline: none;
}

.console-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  padding: 1.5rem;
  background: rgba(7, 9, 13, 0.84);
  color: rgba(248, 250, 252, 0.84);
  text-align: center;
}

.error-overlay strong {
  color: #fca5a5;
}

.error-overlay p {
  max-width: min(680px, 90vw);
  margin: 0;
  color: rgba(248, 250, 252, 0.74);
  overflow-wrap: anywhere;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.16);
  border-top-color: #93c5fd;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .console-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .console-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
