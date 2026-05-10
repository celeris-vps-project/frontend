<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import RFB from '@novnc/novnc'
import AppLayout from '../components/AppLayout.vue'
import StatusBadge from '../components/StatusBadge.vue'
import {
  getInstance,
  getInstanceTrafficUsage,
  createConsoleSession,
  startInstance,
  stopInstance,
  reinstallInstance,
  suspendInstance,
  unsuspendInstance,
  terminateInstance,
  formatDateTime
} from '../api/billing.js'
import { useInstanceStatusWS, instanceConsoleWsUrl } from '../api/ws'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const instance = ref(null)
const trafficUsage = ref(null)
const loading = ref(true)
const trafficLoading = ref(false)
const error = ref('')
const trafficError = ref('')
const actionLoading = ref('')
const actionError = ref('')
const actionSuccess = ref('')
const showReinstallConfirm = ref(false)
const showTerminateConfirm = ref(false)
const consoleLoading = ref(false)
const consoleConnected = ref(false)
const consoleError = ref('')
const consoleMessages = ref([])
const consoleContainer = ref(null)
let consoleRfb = null

const { instanceStates, connected } = useInstanceStatusWS()

onMounted(fetchInstance)
onUnmounted(closeConsole)

async function fetchInstance() {
  loading.value = true
  error.value = ''
  trafficError.value = ''
  try {
    instance.value = await getInstance(route.params.id)
    await refreshTrafficUsage()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const liveInstance = computed(() => {
  if (!instance.value) return null
  const ws = instanceStates[instance.value.id]
  return ws ? { ...instance.value, ...ws } : instance.value
})

function controlStatus(inst) {
  return inst?.control_status || inst?.status
}

function isControlActive(inst) {
  const control = controlStatus(inst)
  if (['provisioning', 'suspended', 'terminated'].includes(control)) return false
  if (control === 'active') return true
  return ['running', 'stopped', 'paused', 'active'].includes(inst?.status)
}

async function doAction(actionFn, actionKey) {
  actionLoading.value = actionKey
  actionError.value = ''
  actionSuccess.value = ''
  try {
    instance.value = await actionFn(route.params.id)
    actionSuccess.value = t(`instanceDetail.${actionKey}Submitted`)
    showReinstallConfirm.value = false
    showTerminateConfirm.value = false
  } catch (err) {
    actionError.value = err.message
  } finally {
    actionLoading.value = ''
  }
}

const canStart = computed(() => {
  return hasRuntimeState(liveInstance.value) && isControlActive(liveInstance.value) && liveInstance.value.status === 'stopped'
})

const canStop = computed(() => hasRuntimeState(liveInstance.value) && liveInstance.value?.status === 'running' && isControlActive(liveInstance.value))
const canSuspend = computed(() => liveInstance.value && isControlActive(liveInstance.value) && liveInstance.value.status !== 'provisioning')
const canUnsuspend = computed(() => controlStatus(liveInstance.value) === 'suspended')
const canReinstall = computed(() => liveInstance.value && isControlActive(liveInstance.value) && Boolean(liveInstance.value.node_id))
const canTerminate = computed(() => liveInstance.value && controlStatus(liveInstance.value) !== 'terminated')
const canOpenConsole = computed(() => hasRuntimeState(liveInstance.value) && liveInstance.value?.status === 'running' && isControlActive(liveInstance.value))
const runtimeGateLabel = computed(() => hasRuntimeState(liveInstance.value) ? '' : t('instanceDetail.runtimeUnavailable'))

function hasRuntimeState(inst) {
  return Boolean(inst?.runtime_reported)
}

const timelineRows = computed(() => {
  if (!liveInstance.value) return []
  return [
    { key: 'created', label: t('instanceDetail.created'), value: liveInstance.value.created_at, tone: 'created' },
    { key: 'started', label: t('instanceDetail.started'), value: liveInstance.value.started_at, tone: 'running' },
    { key: 'stopped', label: t('instanceDetail.stoppedAt'), value: liveInstance.value.stopped_at, tone: 'stopped' },
    { key: 'suspended', label: t('instanceDetail.suspendedAt'), value: liveInstance.value.suspended_at, tone: 'suspended' },
    { key: 'terminated', label: t('instanceDetail.terminatedAt'), value: liveInstance.value.terminated_at, tone: 'terminated' },
  ].filter((row) => Boolean(row.value))
})

const trafficDailyRows = computed(() => trafficUsage.value?.daily || [])

function specLabel(inst) {
  if (!inst) return ''
  const mem = inst.memory_mb >= 1024 ? `${inst.memory_mb / 1024}GB` : `${inst.memory_mb}MB`
  return `${inst.cpu} vCPU / ${mem} RAM / ${inst.disk_gb}GB SSD`
}

function networkModeLabel(inst) {
  if (!inst) return t('common.unknown')
  return inst.network_mode === 'nat' ? t('instanceDetail.natSharedIp') : t('instanceDetail.dedicatedIp')
}

function normalizePorts(values) {
  return [...new Set((values || []).map(Number).filter((port) => Number.isInteger(port) && port > 0))]
    .sort((a, b) => a - b)
}

function natPortMappings(inst) {
  if (!inst) return []
  if (Array.isArray(inst.nat_port_mappings) && inst.nat_port_mappings.length > 0) {
    return inst.nat_port_mappings
      .map((mapping) => ({
        host_port: Number(mapping.host_port),
        guest_port: Number(mapping.guest_port),
        protocol: mapping.protocol || 'tcp'
      }))
      .filter((mapping) => Number.isInteger(mapping.host_port) && mapping.host_port > 0)
  }
  const ports = normalizePorts(Array.isArray(inst.nat_ports) && inst.nat_ports.length > 0 ? inst.nat_ports : [])
  if (ports.length > 0) {
    return ports.map((port, index) => ({
      host_port: port,
      guest_port: index === 0 ? 22 : port,
      protocol: 'tcp'
    }))
  }
  if (inst.nat_port) {
    return [{ host_port: Number(inst.nat_port), guest_port: 22, protocol: 'tcp' }]
  }
  return []
}

function natPorts(inst) {
  return normalizePorts(natPortMappings(inst).map((mapping) => mapping.host_port))
}

function formatPortRange(ports) {
  if (!ports.length) return ''
  const ranges = []
  let start = ports[0]
  let prev = ports[0]
  const pushRange = () => ranges.push(start === prev ? String(start) : `${start}-${prev}`)
  for (let i = 1; i < ports.length; i++) {
    if (ports[i] === prev + 1) {
      prev = ports[i]
      continue
    }
    pushRange()
    start = ports[i]
    prev = ports[i]
  }
  pushRange()
  return ranges.join(', ')
}

function natAccessLabel(inst) {
  const ports = natPorts(inst)
  if (!ports.length) return ''
  const label = formatPortRange(ports)
  if (inst.host_ip) return `${inst.host_ip}:${label}`
  return `NAT :${label}`
}

function natSshPort(inst) {
  const mappings = natPortMappings(inst)
  return mappings.find((mapping) => mapping.guest_port === 22)?.host_port || mappings[0]?.host_port || 0
}

function primaryAccess(inst) {
  if (!inst) return t('instanceDetail.waitingForNetwork')
  if (inst.network_mode === 'nat') {
    const label = natAccessLabel(inst)
    if (label) return label
    if (inst.host_ip) return inst.host_ip
    return t('instanceDetail.waitingForNetwork')
  }
  if (inst.ipv4) return inst.ipv4
  if (inst.ipv6) return inst.ipv6
  return t('instanceDetail.waitingForNetwork')
}

function sshCommand(inst) {
  if (!inst) return ''
  const sshPort = natSshPort(inst)
  if (inst.network_mode === 'nat' && sshPort) {
    if (!inst.host_ip) return ''
    return `ssh root@${inst.host_ip} -p ${sshPort}`
  }
  if (!inst.ipv4) return ''
  return `ssh root@${inst.ipv4}`
}

function statusHeadline(status) {
  const key = ['running', 'stopped', 'paused', 'active', 'suspended', 'terminated', 'provisioning'].includes(status) ? status : 'active'
  return t(`instanceDetail.statusHeadline.${key}`)
}

function statusCopy(inst) {
  if (!inst) return ''
  const key = ['running', 'stopped', 'paused', 'active', 'suspended', 'terminated', 'provisioning'].includes(inst.status) ? inst.status : 'active'
  return t(`instanceDetail.statusCopy.${key}`)
}

function suspendReasonLabel(inst) {
  if (controlStatus(inst) !== 'suspended' || !inst?.suspend_reason) return ''
  const key = `instanceDetail.suspendReasons.${inst.suspend_reason}`
  const label = t(key)
  return label === key ? inst.suspend_reason : label
}

function shiftIsoDate(dateStr, days) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatTrafficPeriod(usage) {
  if (!usage?.period_start || !usage?.period_end) return '—'
  const start = usage.period_start.slice(0, 10)
  const end = shiftIsoDate(usage.period_end, -1)
  return `${start} ~ ${end}`
}

function formatTrafficDate(dateStr) {
  if (!dateStr) return '—'
  return dateStr.slice(0, 10)
}

function formatBytes(value) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let size = Number(value || 0)
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  const precision = size >= 10 || unit === 0 ? 0 : 1
  return `${size.toFixed(precision)} ${units[unit]}`
}

function trafficLimitLabel(usage) {
  if (!usage?.period_max) return t('instanceDetail.trafficUnlimited')
  return `${formatBytes(usage.period_max)} (${usage.bandwidth_gb} GB)`
}

function trafficPercentLabel(usage) {
  if (!usage?.period_max) return t('instanceDetail.trafficUnlimited')
  const percent = Number(usage.usage_percent || 0)
  if (!Number.isFinite(percent)) return '0%'
  return `${percent >= 10 ? percent.toFixed(0) : percent.toFixed(1)}%`
}

function trafficMeterStyle(usage) {
  if (!usage?.period_max) return { width: '0%' }
  const percent = Math.max(0, Math.min(Number(usage.usage_percent || 0), 100))
  return { width: `${percent}%` }
}

async function syncInstanceIfTrafficLimited(usage) {
  if (!usage?.over_limit) return
  try {
    instance.value = await getInstance(route.params.id)
  } catch {
    // Traffic usage remains useful even if the follow-up status refresh fails.
  }
}

function refreshTrafficUsage() {
  trafficLoading.value = true
  trafficError.value = ''
  return getInstanceTrafficUsage(route.params.id)
    .then(async (usage) => {
      trafficUsage.value = usage
      await syncInstanceIfTrafficLimited(usage)
    })
    .catch((err) => {
      trafficError.value = err.message
    })
    .finally(() => {
      trafficLoading.value = false
    })
}

async function openConsole() {
  if (!canOpenConsole.value || consoleLoading.value) return
  closeConsole()
  consoleLoading.value = true
  consoleError.value = ''
  consoleMessages.value = []
  try {
    const session = await createConsoleSession(route.params.id)
    await nextTick()
    const wsUrl = instanceConsoleWsUrl(session.ticket)
    consoleRfb = new RFB(consoleContainer.value, wsUrl, {
      credentials: { password: '' }
    })
    consoleRfb.scaleViewport = true
    consoleRfb.resizeSession = true
    consoleRfb.viewOnly = false
    consoleRfb.addEventListener('connect', () => {
      consoleConnected.value = true
      consoleMessages.value.push(t('instanceDetail.consoleConnected'))
    })
    consoleRfb.addEventListener('disconnect', () => {
      consoleConnected.value = false
      consoleRfb = null
      consoleMessages.value.push(t('instanceDetail.consoleDisconnected'))
    })
    consoleRfb.addEventListener('credentialsrequired', () => {
      consoleError.value = t('instanceDetail.consoleAuthRequired')
    })
  } catch (err) {
    consoleError.value = err.message
  } finally {
    consoleLoading.value = false
  }
}

function closeConsole() {
  if (consoleRfb) {
    consoleRfb.disconnect()
    consoleRfb = null
  }
  consoleConnected.value = false
}
</script>

<template>
  <AppLayout>
    <div class="detail-page">
      <button class="back-btn" @click="router.push('/instances')">{{ t('instanceDetail.backToList') }}</button>

      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>{{ t('instanceDetail.loadingInstance') }}</span>
      </div>

      <div v-else-if="error" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn small-btn" @click="fetchInstance">{{ t('common.retry') }}</button>
      </div>

      <template v-else-if="liveInstance">
        <div class="detail-header">
          <div>
            <div class="detail-title-row">
              <h1 class="page-title">{{ liveInstance.hostname }}</h1>
              <StatusBadge :status="liveInstance.status" />
            </div>
            <p class="page-subtitle mono">#{{ liveInstance.id.slice(0, 8) }}</p>
          </div>

          <div class="header-meta">
            <span class="meta-plan">{{ liveInstance.plan }}</span>
            <span class="ws-pill" :class="{ offline: !connected }">
              <span class="ws-pill-dot"></span>
              {{ connected ? t('instanceDetail.wsConnected') : t('instanceDetail.wsReconnecting') }}
            </span>
          </div>
        </div>

        <div v-if="actionError" class="notification notification-error glass-card" @click="actionError = ''">
          {{ actionError }}
        </div>
        <div v-if="actionSuccess" class="notification notification-success glass-card" @click="actionSuccess = ''">
          {{ actionSuccess }}
        </div>

        <section class="status-hero glass-card">
          <div class="status-copy">
            <span class="eyebrow">{{ t('instanceDetail.realtimeStatus') }}</span>
            <h2>{{ statusHeadline(liveInstance.status) }}</h2>
            <p>{{ statusCopy(liveInstance) }}</p>
            <p v-if="suspendReasonLabel(liveInstance)" class="suspend-reason">{{ suspendReasonLabel(liveInstance) }}</p>
          </div>

          <div class="status-grid">
            <div class="status-card">
              <span class="status-label">{{ t('instanceDetail.currentState') }}</span>
              <div class="status-value-row">
                <StatusBadge :status="liveInstance.status" />
              </div>
            </div>
            <div class="status-card">
              <span class="status-label">{{ t('instanceDetail.primaryAccess') }}</span>
              <span class="status-value mono">{{ primaryAccess(liveInstance) }}</span>
            </div>
            <div class="status-card">
              <span class="status-label">{{ t('instanceDetail.networkMode') }}</span>
              <span class="status-value">{{ networkModeLabel(liveInstance) }}</span>
            </div>
            <div class="status-card">
              <span class="status-label">{{ t('instanceDetail.realtimeChannel') }}</span>
              <span class="status-value">{{ connected ? t('instanceDetail.liveUpdatesEnabled') : t('instanceDetail.retryingWs') }}</span>
            </div>
          </div>
        </section>

        <div v-if="liveInstance.status === 'provisioning'" class="provisioning-banner glass-card">
          <div class="spinner-sm"></div>
          <div class="provisioning-text">
            <strong>{{ t('instanceDetail.provisioningRunning') }}</strong>
            <p>{{ t('instanceDetail.provisioningCopy') }}</p>
          </div>
        </div>

        <div class="detail-grid">
          <div class="detail-main">
            <section class="config-section glass-card">
              <h2>{{ t('instanceDetail.configuration') }}</h2>
              <div class="config-grid">
                <div class="config-item">
                  <div class="config-icon-wrap">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="4" width="18" height="6" rx="1"></rect>
                      <rect x="3" y="14" width="18" height="6" rx="1"></rect>
                    </svg>
                  </div>
                  <div class="config-detail">
                    <span class="config-label">{{ t('instanceDetail.plan') }}</span>
                    <span class="config-value">{{ liveInstance.plan }}</span>
                  </div>
                </div>
                <div class="config-item">
                  <div class="config-icon-wrap">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 20V10"></path>
                      <path d="M18 20V4"></path>
                      <path d="M6 20v-4"></path>
                    </svg>
                  </div>
                  <div class="config-detail">
                    <span class="config-label">{{ t('instanceDetail.specs') }}</span>
                    <span class="config-value">{{ specLabel(liveInstance) }}</span>
                  </div>
                </div>
                <div class="config-item">
                  <div class="config-icon-wrap">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 7h16"></path>
                      <path d="M7 4v16"></path>
                      <path d="M17 4v16"></path>
                    </svg>
                  </div>
                  <div class="config-detail">
                    <span class="config-label">{{ t('instanceDetail.hostname') }}</span>
                    <span class="config-value mono">{{ liveInstance.hostname }}</span>
                  </div>
                </div>
              </div>
            </section>

            <section class="config-section glass-card">
              <h2>{{ t('instanceDetail.network') }}</h2>
              <div class="config-grid">
                <div class="config-item">
                  <div class="config-icon-wrap success">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="9"></circle>
                      <path d="M3 12h18"></path>
                      <path d="M12 3a14 14 0 0 1 0 18"></path>
                      <path d="M12 3a14 14 0 0 0 0 18"></path>
                    </svg>
                  </div>
                  <div class="config-detail">
                    <span class="config-label">{{ liveInstance.network_mode === 'nat' ? t('instanceDetail.guestIPv4') : t('instanceDetail.ipv4') }}</span>
                    <span class="config-value mono">{{ liveInstance.ipv4 || t('instanceDetail.waitingAssignment') }}</span>
                  </div>
                </div>
                <div class="config-item">
                  <div class="config-icon-wrap info">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="9"></circle>
                      <path d="M3 12h18"></path>
                      <path d="M12 3a14 14 0 0 1 0 18"></path>
                      <path d="M12 3a14 14 0 0 0 0 18"></path>
                    </svg>
                  </div>
                  <div class="config-detail">
                    <span class="config-label">{{ t('instanceDetail.ipv6') }}</span>
                    <span class="config-value mono">{{ liveInstance.ipv6 || t('instanceDetail.waitingAssignment') }}</span>
                  </div>
                </div>
                <div class="config-item">
                  <div class="config-icon-wrap nat">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M9 5l7 7-7 7"></path>
                    </svg>
                  </div>
                  <div class="config-detail">
                    <span class="config-label">{{ t('instanceDetail.mode') }}</span>
                    <span class="config-value">{{ networkModeLabel(liveInstance) }}</span>
                  </div>
                </div>
                <div v-if="liveInstance.network_mode === 'nat' && natPorts(liveInstance).length" class="config-item">
                  <div class="config-icon-wrap nat">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                      <path d="M9 9h6v6H9z"></path>
                    </svg>
                  </div>
                  <div class="config-detail">
                    <span class="config-label">{{ t('instanceDetail.natPorts') }}</span>
                    <span class="config-value mono">:{{ formatPortRange(natPorts(liveInstance)) }}</span>
                  </div>
                </div>
                <div v-if="liveInstance.network_mode === 'nat' && liveInstance.host_ip" class="config-item">
                  <div class="config-icon-wrap info">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 12h16"></path>
                      <path d="M12 4v16"></path>
                    </svg>
                  </div>
                  <div class="config-detail">
                    <span class="config-label">{{ t('instanceDetail.hostIp') }}</span>
                    <span class="config-value mono">{{ liveInstance.host_ip }}</span>
                  </div>
                </div>
                <div v-if="liveInstance.initial_password" class="config-item">
                  <div class="config-icon-wrap credential">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="10" rx="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <div class="config-detail">
                    <span class="config-label">{{ t('instanceDetail.initialPassword') }}</span>
                    <span class="config-value mono secret-value">{{ liveInstance.initial_password }}</span>
                  </div>
                </div>
              </div>

              <div v-if="sshCommand(liveInstance)" class="ssh-command-box">
                <span class="ssh-label">{{ t('instanceDetail.sshCommand') }}</span>
                <code class="ssh-cmd">{{ sshCommand(liveInstance) }}</code>
              </div>
            </section>

            <section class="config-section glass-card">
              <div class="section-header-row">
                <h2>{{ t('instanceDetail.trafficUsage') }}</h2>
                <button class="text-btn" :disabled="trafficLoading" @click="refreshTrafficUsage">
                  {{ trafficLoading ? t('common.loading') : t('common.retry') }}
                </button>
              </div>

              <div v-if="trafficLoading" class="traffic-loading">
                <div class="spinner-sm"></div>
                <span>{{ t('instanceDetail.loadingTraffic') }}</span>
              </div>

              <div v-else-if="trafficError" class="traffic-error">
                <p>{{ trafficError }}</p>
              </div>

              <template v-else>
                <div class="traffic-summary-grid">
                  <div class="traffic-metric">
                    <span class="traffic-label">{{ t('instanceDetail.trafficTotal') }}</span>
                    <span class="traffic-value">{{ formatBytes(trafficUsage?.usage) }}</span>
                  </div>
                  <div class="traffic-metric">
                    <span class="traffic-label">{{ t('instanceDetail.trafficRx') }}</span>
                    <span class="traffic-value">{{ formatBytes(trafficUsage?.rx) }}</span>
                  </div>
                  <div class="traffic-metric">
                    <span class="traffic-label">{{ t('instanceDetail.trafficTx') }}</span>
                    <span class="traffic-value">{{ formatBytes(trafficUsage?.tx) }}</span>
                  </div>
                  <div class="traffic-metric">
                    <span class="traffic-label">{{ t('instanceDetail.trafficPeriod') }}</span>
                    <span class="traffic-value mono">{{ formatTrafficPeriod(trafficUsage) }}</span>
                  </div>
                  <div class="traffic-metric">
                    <span class="traffic-label">{{ t('instanceDetail.trafficQuota') }}</span>
                    <span class="traffic-value">{{ trafficLimitLabel(trafficUsage) }}</span>
                  </div>
                  <div class="traffic-metric" :class="{ danger: trafficUsage?.over_limit }">
                    <span class="traffic-label">{{ t('instanceDetail.trafficPercent') }}</span>
                    <span class="traffic-value">{{ trafficPercentLabel(trafficUsage) }}</span>
                  </div>
                </div>

                <div v-if="trafficUsage?.period_max" class="traffic-meter" :class="{ danger: trafficUsage?.over_limit }">
                  <div class="traffic-meter-bar">
                    <span :style="trafficMeterStyle(trafficUsage)"></span>
                  </div>
                  <div class="traffic-meter-meta">
                    <span>{{ formatBytes(trafficUsage?.usage) }}</span>
                    <span>{{ formatBytes(trafficUsage?.period_max) }}</span>
                  </div>
                </div>

                <div v-if="trafficDailyRows.length" class="traffic-daily-list">
                  <div v-for="row in trafficDailyRows" :key="row.date" class="traffic-daily-row">
                    <span class="traffic-day">{{ formatTrafficDate(row.date) }}</span>
                    <span class="traffic-day-value mono">{{ formatBytes(row.usage) }}</span>
                    <span class="traffic-day-meta mono">{{ formatBytes(row.rx) }} / {{ formatBytes(row.tx) }}</span>
                  </div>
                </div>
                <p v-else class="traffic-empty">{{ t('instanceDetail.trafficNoData') }}</p>
              </template>
            </section>

            <section class="config-section glass-card">
              <h2>{{ t('instanceDetail.timeline') }}</h2>
              <div class="timeline">
                <div v-for="row in timelineRows" :key="row.key" class="timeline-item">
                  <div class="tl-dot" :class="row.tone"></div>
                  <div class="tl-row">
                    <span class="tl-label">{{ row.label }}</span>
                    <span class="tl-value">{{ formatDateTime(row.value) }}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div class="detail-sidebar">
            <section class="actions-card glass-card">
              <h3>{{ t('instanceDetail.powerControl') }}</h3>
              <p v-if="runtimeGateLabel" class="action-note">{{ runtimeGateLabel }}</p>
              <div class="power-btns">
                <button
                  v-if="!hasRuntimeState(liveInstance) && isControlActive(liveInstance) && liveInstance.status !== 'running'"
                  class="action-btn success-btn"
                  disabled
                >
                  {{ t('instanceDetail.start') }}
                </button>
                <button
                  v-if="!hasRuntimeState(liveInstance) && isControlActive(liveInstance) && liveInstance.status !== 'stopped'"
                  class="action-btn warning-btn"
                  disabled
                >
                  {{ t('instanceDetail.stop') }}
                </button>
                <button
                  v-if="canStart && hasRuntimeState(liveInstance)"
                  class="action-btn success-btn"
                  :disabled="actionLoading !== ''"
                  @click="doAction(startInstance, 'start')"
                >
                  {{ actionLoading === 'start' ? t('instanceDetail.starting') : t('instanceDetail.start') }}
                </button>
                <button
                  v-if="canStop && hasRuntimeState(liveInstance)"
                  class="action-btn warning-btn"
                  :disabled="actionLoading !== ''"
                  @click="doAction(stopInstance, 'stop')"
                >
                  {{ actionLoading === 'stop' ? t('instanceDetail.stopping') : t('instanceDetail.stop') }}
                </button>
                <button
                  v-if="canSuspend"
                  class="action-btn secondary-btn"
                  :disabled="actionLoading !== ''"
                  @click="doAction(suspendInstance, 'suspend')"
                >
                  {{ actionLoading === 'suspend' ? t('instanceDetail.suspending') : t('instanceDetail.suspend') }}
                </button>
                <button
                  v-if="canUnsuspend"
                  class="action-btn success-btn"
                  :disabled="actionLoading !== ''"
                  @click="doAction(unsuspendInstance, 'unsuspend')"
                >
                  {{ actionLoading === 'unsuspend' ? t('instanceDetail.unsuspending') : t('instanceDetail.unsuspend') }}
                </button>
              </div>

              <div v-if="canReinstall" class="reinstall-section">
                <button class="action-btn warning-btn" @click="showReinstallConfirm = !showReinstallConfirm">
                  {{ t('instanceDetail.reinstallSystem') }}
                </button>
                <div v-if="showReinstallConfirm" class="confirm-box">
                  <p class="confirm-text">{{ t('instanceDetail.reinstallWarning') }}</p>
                  <button
                    class="action-btn danger-btn small-btn"
                    :disabled="actionLoading !== ''"
                    @click="doAction(reinstallInstance, 'reinstall')"
                  >
                    {{ actionLoading === 'reinstall' ? t('instanceDetail.reinstalling') : t('instanceDetail.confirmReinstall') }}
                  </button>
                </div>
              </div>

              <div v-if="canTerminate" class="terminate-section">
                <button class="action-btn danger-btn" @click="showTerminateConfirm = !showTerminateConfirm">
                  {{ t('instanceDetail.terminateInstance') }}
                </button>
                <div v-if="showTerminateConfirm" class="confirm-box">
                  <p class="confirm-text">{{ t('instanceDetail.terminateWarning') }}</p>
                  <button
                    class="action-btn danger-btn small-btn"
                    :disabled="actionLoading !== ''"
                    @click="doAction(terminateInstance, 'terminate')"
                  >
                    {{ actionLoading === 'terminate' ? t('instanceDetail.terminating') : t('instanceDetail.confirmTerminate') }}
                  </button>
                </div>
              </div>
            </section>

            <section class="actions-card glass-card">
              <h3>{{ t('instanceDetail.console') }}</h3>
              <p class="action-note">{{ t('instanceDetail.consoleHint') }}</p>
              <div class="power-btns">
                <button
                  class="action-btn secondary-btn"
                  :disabled="!canOpenConsole || consoleLoading || consoleConnected"
                  @click="openConsole"
                >
                  {{ consoleLoading ? t('instanceDetail.consoleConnecting') : t('instanceDetail.openConsole') }}
                </button>
                <button
                  class="action-btn danger-btn"
                  :disabled="!consoleConnected"
                  @click="closeConsole"
                >
                  {{ t('instanceDetail.closeConsole') }}
                </button>
              </div>
              <p v-if="!canOpenConsole" class="action-note">{{ t('instanceDetail.consoleUnavailable') }}</p>
              <p v-if="consoleError" class="console-error">{{ consoleError }}</p>
              <div class="console-frame">
                <div ref="consoleContainer" class="console-canvas"></div>
                <div class="console-status" :class="{ connected: consoleConnected }">
                  {{ consoleConnected ? t('instanceDetail.consoleConnected') : t('instanceDetail.consoleIdle') }}
                </div>
                <div class="console-log">
                  <p v-for="(msg, index) in consoleMessages.slice(-4)" :key="index">{{ msg }}</p>
                </div>
              </div>
            </section>

            <section class="info-card glass-card">
              <h3>{{ t('instanceDetail.details') }}</h3>
              <dl class="detail-list">
                <div class="dl-row">
                  <dt>{{ t('instanceDetail.instanceId') }}</dt>
                  <dd class="mono">{{ liveInstance.id }}</dd>
                </div>
                <div class="dl-row">
                  <dt>{{ t('instanceDetail.orderId') }}</dt>
                  <dd class="mono">{{ liveInstance.order_id }}</dd>
                </div>
                <div class="dl-row">
                  <dt>{{ t('instanceDetail.nodeId') }}</dt>
                  <dd class="mono">{{ liveInstance.node_id || t('instanceDetail.pendingAssignment') }}</dd>
                </div>
                <div class="dl-row">
                  <dt>{{ t('instanceDetail.createdAt') }}</dt>
                  <dd>{{ formatDateTime(liveInstance.created_at) }}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<style scoped>
.detail-page {
  max-width: 1100px;
  margin: 0 auto;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  margin-bottom: 1.25rem;
  transition: color 0.2s;
}

.back-btn:hover {
  color: var(--accent);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.detail-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.page-title {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 700;
  color: var(--text-primary);
}

.page-subtitle {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

.mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.meta-plan {
  font-size: 0.88rem;
  padding: 0.3rem 0.8rem;
  border-radius: 8px;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--accent);
  font-weight: 600;
}

.ws-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(34, 197, 94, 0.18);
  background: rgba(34, 197, 94, 0.08);
  color: var(--success);
  font-size: 0.78rem;
  font-weight: 600;
}

.ws-pill.offline {
  color: var(--warning);
  background: var(--warning-bg);
  border-color: var(--warning-border);
}

.ws-pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.notification {
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: 12px;
  font-size: 0.85rem;
  cursor: pointer;
}

.notification-error {
  border-left: 3px solid var(--danger);
  color: var(--danger);
}

.notification-success {
  border-left: 3px solid var(--success);
  color: var(--success);
}

.status-hero {
  padding: 1.35rem;
  margin-bottom: 1.25rem;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 1rem;
}

.status-copy {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.eyebrow {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--accent);
  font-weight: 700;
}

.status-copy h2 {
  margin: 0;
  font-size: 1.35rem;
  color: var(--text-primary);
}

.status-copy p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.status-copy .suspend-reason {
  color: var(--warning);
  font-weight: 600;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.status-card {
  padding: 0.9rem 1rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.status-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.status-value-row {
  display: flex;
  align-items: center;
}

.status-value {
  font-size: 0.92rem;
  color: var(--text-primary);
  font-weight: 600;
  line-height: 1.5;
}

.provisioning-banner {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 1rem 1.1rem;
  margin-bottom: 1.25rem;
  border-left: 3px solid var(--warning);
}

.spinner-sm {
  width: 22px;
  height: 22px;
  border: 3px solid var(--border-default);
  border-top-color: var(--warning);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.provisioning-text strong {
  display: block;
  font-size: 0.92rem;
  color: var(--warning);
  margin-bottom: 0.2rem;
}

.provisioning-text p {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-muted);
  line-height: 1.55;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.5rem;
  align-items: start;
}

.detail-main,
.detail-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.config-section,
.actions-card,
.info-card {
  padding: 1.35rem;
}

.config-section h2,
.actions-card h3,
.info-card h3 {
  margin: 0 0 1rem;
  font-size: 1rem;
  color: var(--text-primary);
}

.action-note {
  margin: -0.35rem 0 0.75rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.section-header-row h2 {
  margin: 0;
}

.text-btn {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.text-btn:disabled {
  opacity: 0.65;
  cursor: default;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem;
  background: var(--bg-code);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
}

.config-icon-wrap {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--accent-bg);
  color: var(--accent);
  border: 1px solid var(--accent-border);
}

.config-icon-wrap.success {
  background: var(--success-bg);
  color: var(--success);
  border-color: var(--success-border);
}

.config-icon-wrap.info {
  background: var(--info-bg);
  color: var(--info);
  border-color: var(--info-border);
}

.config-icon-wrap.nat {
  background: rgba(168, 85, 247, 0.08);
  color: #a855f7;
  border-color: rgba(168, 85, 247, 0.2);
}

.config-icon-wrap.credential {
  background: rgba(245, 158, 11, 0.08);
  color: var(--warning);
  border-color: var(--warning-border);
}

.config-detail {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}

.config-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.config-value {
  font-size: 0.88rem;
  color: var(--text-primary);
  font-weight: 500;
}

.secret-value {
  user-select: all;
  word-break: break-all;
}

.ssh-command-box {
  margin-top: 1rem;
  padding: 0.85rem 1rem;
  background: var(--bg-code);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.ssh-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ssh-cmd {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.85rem;
  color: var(--success);
  font-weight: 500;
  user-select: all;
  cursor: text;
  word-break: break-all;
}

.traffic-loading,
.traffic-error,
.traffic-empty {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0;
  color: var(--text-muted);
}

.traffic-error {
  color: var(--danger);
}

.traffic-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.traffic-metric {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  padding: 0.85rem;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-code);
}

.traffic-metric.danger {
  border-color: var(--danger-border);
  background: var(--danger-bg);
}

.traffic-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.traffic-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.traffic-metric.danger .traffic-value {
  color: var(--danger);
}

.traffic-meter {
  margin-top: 1rem;
}

.traffic-meter-bar {
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--border-subtle);
}

.traffic-meter-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.25s ease;
}

.traffic-meter.danger .traffic-meter-bar span {
  background: var(--danger);
}

.traffic-meter-meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.45rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.traffic-daily-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-top: 1rem;
  max-height: 360px;
  overflow: auto;
  padding-right: 0.25rem;
}

.traffic-daily-row {
  display: grid;
  grid-template-columns: minmax(72px, 96px) minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.75rem;
  align-items: center;
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  background: var(--bg-code);
  border: 1px solid var(--border-subtle);
}

.traffic-day,
.traffic-day-value,
.traffic-day-meta {
  font-size: 0.82rem;
}

.traffic-day {
  color: var(--text-primary);
  font-weight: 600;
}

.traffic-day-value {
  color: var(--accent);
  text-align: right;
  font-weight: 600;
}

.traffic-day-meta {
  color: var(--text-muted);
  text-align: right;
}

.timeline {
  display: flex;
  flex-direction: column;
  position: relative;
  padding-left: 1.5rem;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--divider);
}

.timeline-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0;
  position: relative;
}

.tl-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  position: absolute;
  left: -1.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: var(--text-muted);
}

.tl-dot.created {
  background: #60a5fa;
}

.tl-dot.running {
  background: var(--success);
}

.tl-dot.stopped {
  background: var(--info);
}

.tl-dot.suspended {
  background: var(--warning);
}

.tl-dot.terminated {
  background: var(--danger);
}

.tl-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 1rem;
}

.tl-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.tl-value {
  font-size: 0.85rem;
  color: var(--text-primary);
  font-weight: 500;
  text-align: right;
}

.power-btns {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.console-frame {
  margin-top: 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  overflow: hidden;
  background: #111318;
}

.console-canvas {
  min-height: 320px;
  aspect-ratio: 16 / 10;
  background: #090b0f;
}

.console-status {
  padding: 0.55rem 0.75rem;
  font-size: 0.78rem;
  color: var(--text-muted);
  border-top: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.02);
}

.console-status.connected {
  color: var(--success);
}

.console-log {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.65rem 0.75rem;
  font-size: 0.76rem;
  color: var(--text-muted);
  border-top: 1px solid var(--border-subtle);
}

.console-log p {
  margin: 0;
}

.console-error {
  margin: 0.5rem 0 0;
  color: var(--danger);
  font-size: 0.8rem;
}

.reinstall-section,
.terminate-section {
  border-top: 1px solid var(--divider);
  padding-top: 0.85rem;
  margin-top: 0.85rem;
}

.confirm-box {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 10px;
}

.confirm-text {
  font-size: 0.8rem;
  color: var(--danger);
  margin: 0 0 0.5rem;
}

.detail-list {
  margin: 0;
}

.dl-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--border-subtle);
}

.dl-row:last-child {
  border-bottom: none;
}

.dl-row dt {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.dl-row dd {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-primary);
  text-align: right;
  max-width: 62%;
  word-break: break-all;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-muted);
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border-default);
  border-top-color: var(--spinner-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .status-hero,
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .status-grid {
    grid-template-columns: 1fr;
  }

  .config-grid {
    grid-template-columns: 1fr;
  }

  .traffic-summary-grid {
    grid-template-columns: 1fr;
  }

  .traffic-daily-row {
    grid-template-columns: 1fr;
    gap: 0.2rem;
    align-items: start;
  }

  .traffic-day-value,
  .traffic-day-meta {
    text-align: left;
  }
}
</style>
