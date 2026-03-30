<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import StatusBadge from '../components/StatusBadge.vue'
import {
  getInstance,
  startInstance,
  stopInstance,
  suspendInstance,
  unsuspendInstance,
  terminateInstance,
  formatDateTime
} from '../api/billing.js'
import { useInstanceStatusWS } from '../api/ws'

const route = useRoute()
const router = useRouter()
const instance = ref(null)
const loading = ref(true)
const error = ref('')
const actionLoading = ref('')
const actionError = ref('')
const actionSuccess = ref('')
const showTerminateConfirm = ref(false)

const { instanceStates, connected } = useInstanceStatusWS()

onMounted(fetchInstance)

async function fetchInstance() {
  loading.value = true
  error.value = ''
  try {
    instance.value = await getInstance(route.params.id)
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

async function doAction(actionFn, label) {
  actionLoading.value = label
  actionError.value = ''
  actionSuccess.value = ''
  try {
    instance.value = await actionFn(route.params.id)
    actionSuccess.value = `${label} request submitted`
    showTerminateConfirm.value = false
  } catch (err) {
    actionError.value = err.message
  } finally {
    actionLoading.value = ''
  }
}

const canStart = computed(() => {
  return liveInstance.value && ['pending', 'stopped'].includes(liveInstance.value.status)
})

const canStop = computed(() => liveInstance.value?.status === 'running')
const canSuspend = computed(() => liveInstance.value?.status === 'running')
const canUnsuspend = computed(() => liveInstance.value?.status === 'suspended')
const canTerminate = computed(() => liveInstance.value && liveInstance.value.status !== 'terminated')

const timelineRows = computed(() => {
  if (!liveInstance.value) return []
  return [
    { key: 'created', label: 'Created', value: liveInstance.value.created_at, tone: 'created' },
    { key: 'started', label: 'Started', value: liveInstance.value.started_at, tone: 'running' },
    { key: 'stopped', label: 'Stopped', value: liveInstance.value.stopped_at, tone: 'stopped' },
    { key: 'suspended', label: 'Suspended', value: liveInstance.value.suspended_at, tone: 'suspended' },
    { key: 'terminated', label: 'Terminated', value: liveInstance.value.terminated_at, tone: 'terminated' },
  ].filter((row) => Boolean(row.value))
})

function specLabel(inst) {
  if (!inst) return ''
  const mem = inst.memory_mb >= 1024 ? `${inst.memory_mb / 1024}GB` : `${inst.memory_mb}MB`
  return `${inst.cpu} vCPU / ${mem} RAM / ${inst.disk_gb}GB SSD`
}

function networkModeLabel(inst) {
  if (!inst) return 'Unknown'
  return inst.network_mode === 'nat' ? 'NAT Shared IP' : 'Dedicated IP'
}

function primaryAccess(inst) {
  if (!inst) return 'Waiting for network'
  if (inst.ipv4) {
    return inst.network_mode === 'nat' && inst.nat_port ? `${inst.ipv4}:${inst.nat_port}` : inst.ipv4
  }
  if (inst.ipv6) return inst.ipv6
  if (inst.nat_port) return `NAT :${inst.nat_port}`
  return 'Waiting for network'
}

function sshCommand(inst) {
  if (!inst?.ipv4) return ''
  if (inst.network_mode === 'nat' && inst.nat_port) {
    return `ssh root@${inst.ipv4} -p ${inst.nat_port}`
  }
  return `ssh root@${inst.ipv4}`
}

function statusHeadline(status) {
  switch (status) {
    case 'running':
      return 'Instance is online'
    case 'stopped':
      return 'Instance is powered off'
    case 'suspended':
      return 'Instance is suspended'
    case 'terminated':
      return 'Instance has been terminated'
    default:
      return 'Provisioning in progress'
  }
}

function statusCopy(inst) {
  if (!inst) return ''
  switch (inst.status) {
    case 'running':
      return 'The VM is running and can be reached with the current network details below.'
    case 'stopped':
      return 'You can start the VM again at any time from the control panel.'
    case 'suspended':
      return 'Resources are paused until the instance is resumed.'
    case 'terminated':
      return 'This VPS is no longer available for start, stop, or suspend actions.'
    default:
      return 'The platform is still allocating resources and waiting for the node to confirm boot.'
  }
}
</script>

<template>
  <AppLayout>
    <div class="detail-page">
      <button class="back-btn" @click="router.push('/instances')">Back to instances</button>

      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>Loading instance...</span>
      </div>

      <div v-else-if="error" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn small-btn" @click="fetchInstance">Retry</button>
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
              {{ connected ? 'WS Connected' : 'WS Reconnecting' }}
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
            <span class="eyebrow">Realtime VPS Status</span>
            <h2>{{ statusHeadline(liveInstance.status) }}</h2>
            <p>{{ statusCopy(liveInstance) }}</p>
          </div>

          <div class="status-grid">
            <div class="status-card">
              <span class="status-label">Current State</span>
              <div class="status-value-row">
                <StatusBadge :status="liveInstance.status" />
              </div>
            </div>
            <div class="status-card">
              <span class="status-label">Primary Access</span>
              <span class="status-value mono">{{ primaryAccess(liveInstance) }}</span>
            </div>
            <div class="status-card">
              <span class="status-label">Network Mode</span>
              <span class="status-value">{{ networkModeLabel(liveInstance) }}</span>
            </div>
            <div class="status-card">
              <span class="status-label">Realtime Channel</span>
              <span class="status-value">{{ connected ? 'Live updates enabled' : 'Retrying WebSocket connection' }}</span>
            </div>
          </div>
        </section>

        <div v-if="liveInstance.status === 'pending'" class="provisioning-banner glass-card">
          <div class="spinner-sm"></div>
          <div class="provisioning-text">
            <strong>Provisioning is still running</strong>
            <p>The page listens for WebSocket updates and will refresh the VPS status as soon as the node reports back.</p>
          </div>
        </div>

        <div class="detail-grid">
          <div class="detail-main">
            <section class="config-section glass-card">
              <h2>Configuration</h2>
              <div class="config-grid">
                <div class="config-item">
                  <div class="config-icon-wrap">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="4" width="18" height="6" rx="1"></rect>
                      <rect x="3" y="14" width="18" height="6" rx="1"></rect>
                    </svg>
                  </div>
                  <div class="config-detail">
                    <span class="config-label">Plan</span>
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
                    <span class="config-label">Spec</span>
                    <span class="config-value">{{ specLabel(liveInstance) }}</span>
                  </div>
                </div>
                <div class="config-item">
                  <div class="config-icon-wrap">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 2v20"></path>
                      <path d="M2 5h20"></path>
                      <path d="M2 19h20"></path>
                    </svg>
                  </div>
                  <div class="config-detail">
                    <span class="config-label">OS</span>
                    <span class="config-value">{{ liveInstance.os }}</span>
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
                    <span class="config-label">Hostname</span>
                    <span class="config-value mono">{{ liveInstance.hostname }}</span>
                  </div>
                </div>
              </div>
            </section>

            <section class="config-section glass-card">
              <h2>Network</h2>
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
                    <span class="config-label">IPv4</span>
                    <span class="config-value mono">{{ liveInstance.ipv4 || 'Waiting for assignment' }}</span>
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
                    <span class="config-label">IPv6</span>
                    <span class="config-value mono">{{ liveInstance.ipv6 || 'Waiting for assignment' }}</span>
                  </div>
                </div>
                <div class="config-item">
                  <div class="config-icon-wrap nat">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M9 5l7 7-7 7"></path>
                    </svg>
                  </div>
                  <div class="config-detail">
                    <span class="config-label">Mode</span>
                    <span class="config-value">{{ networkModeLabel(liveInstance) }}</span>
                  </div>
                </div>
                <div v-if="liveInstance.network_mode === 'nat' && liveInstance.nat_port" class="config-item">
                  <div class="config-icon-wrap nat">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                      <path d="M9 9h6v6H9z"></path>
                    </svg>
                  </div>
                  <div class="config-detail">
                    <span class="config-label">NAT SSH Port</span>
                    <span class="config-value mono">:{{ liveInstance.nat_port }}</span>
                  </div>
                </div>
              </div>

              <div v-if="sshCommand(liveInstance)" class="ssh-command-box">
                <span class="ssh-label">SSH Command</span>
                <code class="ssh-cmd">{{ sshCommand(liveInstance) }}</code>
              </div>
            </section>

            <section class="config-section glass-card">
              <h2>Timeline</h2>
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
              <h3>Power Controls</h3>
              <div class="power-btns">
                <button
                  v-if="canStart"
                  class="action-btn success-btn"
                  :disabled="actionLoading !== ''"
                  @click="doAction(startInstance, 'Start')"
                >
                  {{ actionLoading === 'Start' ? 'Starting...' : 'Start Instance' }}
                </button>
                <button
                  v-if="canStop"
                  class="action-btn warning-btn"
                  :disabled="actionLoading !== ''"
                  @click="doAction(stopInstance, 'Stop')"
                >
                  {{ actionLoading === 'Stop' ? 'Stopping...' : 'Stop Instance' }}
                </button>
                <button
                  v-if="canSuspend"
                  class="action-btn secondary-btn"
                  :disabled="actionLoading !== ''"
                  @click="doAction(suspendInstance, 'Suspend')"
                >
                  {{ actionLoading === 'Suspend' ? 'Suspending...' : 'Suspend Instance' }}
                </button>
                <button
                  v-if="canUnsuspend"
                  class="action-btn success-btn"
                  :disabled="actionLoading !== ''"
                  @click="doAction(unsuspendInstance, 'Unsuspend')"
                >
                  {{ actionLoading === 'Unsuspend' ? 'Resuming...' : 'Resume Instance' }}
                </button>
              </div>

              <div v-if="canTerminate" class="terminate-section">
                <button class="action-btn danger-btn" @click="showTerminateConfirm = !showTerminateConfirm">
                  Terminate Instance
                </button>
                <div v-if="showTerminateConfirm" class="confirm-box">
                  <p class="confirm-text">This operation is permanent and cannot be undone.</p>
                  <button
                    class="action-btn danger-btn small-btn"
                    :disabled="actionLoading !== ''"
                    @click="doAction(terminateInstance, 'Terminate')"
                  >
                    {{ actionLoading === 'Terminate' ? 'Terminating...' : 'Confirm Termination' }}
                  </button>
                </div>
              </div>
            </section>

            <section class="info-card glass-card">
              <h3>Details</h3>
              <dl class="detail-list">
                <div class="dl-row">
                  <dt>Instance ID</dt>
                  <dd class="mono">{{ liveInstance.id }}</dd>
                </div>
                <div class="dl-row">
                  <dt>Order ID</dt>
                  <dd class="mono">{{ liveInstance.order_id }}</dd>
                </div>
                <div class="dl-row">
                  <dt>Node ID</dt>
                  <dd class="mono">{{ liveInstance.node_id || 'Pending assignment' }}</dd>
                </div>
                <div class="dl-row">
                  <dt>Created At</dt>
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
}
</style>
