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
  formatDate,
  formatDateTime
} from '../api/billing.js'

const route = useRoute()
const router = useRouter()
const instance = ref(null)
const loading = ref(true)
const error = ref('')
const actionLoading = ref('')
const actionError = ref('')
const actionSuccess = ref('')

// Terminate confirmation
const showTerminateConfirm = ref(false)

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

async function doAction(actionFn, label) {
  actionLoading.value = label
  actionError.value = ''
  actionSuccess.value = ''
  try {
    instance.value = await actionFn(route.params.id)
    actionSuccess.value = `${label} successful`
    showTerminateConfirm.value = false
  } catch (err) {
    actionError.value = err.message
  } finally {
    actionLoading.value = ''
  }
}

const canStart = computed(() => instance.value && (instance.value.status === 'pending' || instance.value.status === 'stopped'))
const canStop = computed(() => instance.value && instance.value.status === 'running')
const canSuspend = computed(() => instance.value && instance.value.status !== 'terminated' && instance.value.status !== 'suspended')
const canUnsuspend = computed(() => instance.value && instance.value.status === 'suspended')
const canTerminate = computed(() => instance.value && instance.value.status !== 'terminated')

function specLabel(inst) {
  if (!inst) return ''
  const mem = inst.memory_mb >= 1024 ? `${inst.memory_mb / 1024}GB` : `${inst.memory_mb}MB`
  return `${inst.cpu} vCPU / ${mem} RAM / ${inst.disk_gb}GB SSD`
}
</script>

<template>
  <AppLayout>
    <div class="detail-page">
      <!-- Back -->
      <button class="back-btn" @click="router.push('/instances')">
        ← Back to Instances
      </button>

      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>Loading instance...</span>
      </div>

      <div v-else-if="error" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn" @click="fetchInstance">Retry</button>
      </div>

      <template v-else-if="instance">
        <!-- Header -->
        <div class="detail-header">
          <div>
            <div class="detail-title-row">
              <h1 class="page-title">{{ instance.hostname }}</h1>
              <StatusBadge :status="instance.status" />
            </div>
            <p class="page-subtitle mono">#{{ instance.id.slice(0, 8) }}</p>
          </div>
          <div class="header-meta">
            <span class="meta-plan">{{ instance.plan }}</span>
          </div>
        </div>

        <!-- Notification -->
        <div v-if="actionError" class="notification notification-error glass-card" @click="actionError = ''">
          {{ actionError }}
        </div>
        <div v-if="actionSuccess" class="notification notification-success glass-card" @click="actionSuccess = ''">
          {{ actionSuccess }}
        </div>

        <div class="detail-grid">
          <!-- Left: Instance Info -->
          <div class="detail-main">
            <!-- Configuration -->
            <div class="config-section glass-card">
              <h2>Configuration</h2>
              <div class="config-grid">
                <div class="config-item">
                  <span class="config-icon">⬡</span>
                  <div class="config-detail">
                    <span class="config-label">Plan</span>
                    <span class="config-value">{{ instance.plan }}</span>
                  </div>
                </div>
                <div class="config-item">
                  <span class="config-icon">⚙</span>
                  <div class="config-detail">
                    <span class="config-label">Specifications</span>
                    <span class="config-value">{{ specLabel(instance) }}</span>
                  </div>
                </div>
                <div class="config-item">
                  <span class="config-icon">⊞</span>
                  <div class="config-detail">
                    <span class="config-label">Operating System</span>
                    <span class="config-value">{{ instance.os }}</span>
                  </div>
                </div>
                <div class="config-item">
                  <span class="config-icon">⌘</span>
                  <div class="config-detail">
                    <span class="config-label">Hostname</span>
                    <span class="config-value mono">{{ instance.hostname }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Network -->
            <div class="network-section glass-card">
              <h2>Network</h2>
              <div class="config-grid">
                <div class="config-item">
                  <span class="config-icon">◎</span>
                  <div class="config-detail">
                    <span class="config-label">IPv4 Address</span>
                    <span class="config-value mono">{{ instance.ipv4 || 'Not assigned' }}</span>
                  </div>
                </div>
                <div class="config-item">
                  <span class="config-icon">◎</span>
                  <div class="config-detail">
                    <span class="config-label">IPv6 Address</span>
                    <span class="config-value mono">{{ instance.ipv6 || 'Not assigned' }}</span>
                  </div>
                </div>
                <div class="config-item">
                  <span class="config-icon">⬡</span>
                  <div class="config-detail">
                    <span class="config-label">Node</span>
                    <span class="config-value mono">{{ instance.node_id.slice(0, 8) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Timeline -->
            <div class="dates-section glass-card">
              <h2>Timeline</h2>
              <div class="timeline">
                <div class="timeline-item">
                  <div class="timeline-dot dot-default"></div>
                  <div class="timeline-content">
                    <span class="tl-label">Created</span>
                    <span class="tl-value">{{ formatDateTime(instance.created_at) }}</span>
                  </div>
                </div>
                <div v-if="instance.started_at" class="timeline-item">
                  <div class="timeline-dot dot-running"></div>
                  <div class="timeline-content">
                    <span class="tl-label">Started</span>
                    <span class="tl-value">{{ formatDateTime(instance.started_at) }}</span>
                  </div>
                </div>
                <div v-if="instance.stopped_at" class="timeline-item">
                  <div class="timeline-dot dot-stopped"></div>
                  <div class="timeline-content">
                    <span class="tl-label">Stopped</span>
                    <span class="tl-value">{{ formatDateTime(instance.stopped_at) }}</span>
                  </div>
                </div>
                <div v-if="instance.suspended_at" class="timeline-item">
                  <div class="timeline-dot dot-suspended"></div>
                  <div class="timeline-content">
                    <span class="tl-label">Suspended</span>
                    <span class="tl-value">{{ formatDateTime(instance.suspended_at) }}</span>
                  </div>
                </div>
                <div v-if="instance.terminated_at" class="timeline-item">
                  <div class="timeline-dot dot-terminated"></div>
                  <div class="timeline-content">
                    <span class="tl-label">Terminated</span>
                    <span class="tl-value">{{ formatDateTime(instance.terminated_at) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Actions + Info Sidebar -->
          <div class="detail-sidebar">
            <div class="actions-card glass-card">
              <h3>Power Controls</h3>

              <div class="power-btns">
                <button
                  v-if="canStart"
                  class="action-btn success-btn"
                  :disabled="actionLoading !== ''"
                  @click="doAction(startInstance, 'Start')"
                >
                  {{ actionLoading === 'Start' ? 'Starting...' : '▶ Start' }}
                </button>

                <button
                  v-if="canStop"
                  class="action-btn warning-btn"
                  :disabled="actionLoading !== ''"
                  @click="doAction(stopInstance, 'Stop')"
                >
                  {{ actionLoading === 'Stop' ? 'Stopping...' : '■ Stop' }}
                </button>

                <button
                  v-if="canUnsuspend"
                  class="action-btn success-btn"
                  :disabled="actionLoading !== ''"
                  @click="doAction(unsuspendInstance, 'Unsuspend')"
                >
                  {{ actionLoading === 'Unsuspend' ? 'Unsuspending...' : '↻ Unsuspend' }}
                </button>
              </div>

              <!-- Terminate -->
              <div v-if="canTerminate" class="terminate-section">
                <button
                  class="action-btn danger-btn"
                  @click="showTerminateConfirm = !showTerminateConfirm"
                >
                  ⚠ Terminate
                </button>
                <div v-if="showTerminateConfirm" class="confirm-box">
                  <p class="confirm-text">This action is irreversible. The instance will be permanently destroyed.</p>
                  <button
                    class="action-btn danger-btn small-btn"
                    :disabled="actionLoading !== ''"
                    @click="doAction(terminateInstance, 'Terminate')"
                  >
                    {{ actionLoading === 'Terminate' ? 'Terminating...' : 'Confirm Terminate' }}
                  </button>
                </div>
              </div>

              <!-- Status notes -->
              <p v-if="instance.status === 'running'" class="status-note running-note">
                ✓ Instance is running.
              </p>
              <p v-if="instance.status === 'stopped'" class="status-note stopped-note">
                ■ Instance is stopped. Start it to resume.
              </p>
              <p v-if="instance.status === 'pending'" class="status-note pending-note">
                ⧖ Instance is being provisioned.
              </p>
              <p v-if="instance.status === 'suspended'" class="status-note warn-note">
                ⚠ Instance is suspended. Contact support or unsuspend.
              </p>
              <p v-if="instance.status === 'terminated'" class="status-note">
                This instance has been terminated.
              </p>
            </div>

            <!-- Info Card -->
            <div class="info-card glass-card">
              <h3>Details</h3>
              <dl class="detail-list">
                <div class="dl-row">
                  <dt>Instance ID</dt>
                  <dd class="mono">{{ instance.id }}</dd>
                </div>
                <div class="dl-row">
                  <dt>Order ID</dt>
                  <dd class="mono">{{ instance.order_id.slice(0, 12) }}…</dd>
                </div>
                <div class="dl-row">
                  <dt>Node ID</dt>
                  <dd class="mono">{{ instance.node_id.slice(0, 12) }}…</dd>
                </div>
                <div class="dl-row">
                  <dt>Status</dt>
                  <dd><StatusBadge :status="instance.status" /></dd>
                </div>
              </dl>
            </div>
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
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  margin-bottom: 1.25rem;
  transition: color 0.2s;
}

.back-btn:hover {
  color: #a78bfa;
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
}

.page-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  background: linear-gradient(135deg, #fff, rgba(255, 255, 255, 0.7));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-subtitle {
  margin: 0.25rem 0 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
}

.mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.header-meta {
  display: flex;
  align-items: center;
}

.meta-plan {
  font-size: 0.9rem;
  padding: 0.35rem 0.85rem;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: #a78bfa;
  font-weight: 600;
}

/* Notification */
.notification {
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: 10px;
  font-size: 0.875rem;
  cursor: pointer;
}

.notification-error {
  border-left: 3px solid #f87171;
  color: #fca5a5;
}

.notification-success {
  border-left: 3px solid #4ade80;
  color: #86efac;
}

/* Grid */
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 900px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

/* Config sections */
.config-section,
.network-section,
.dates-section {
  padding: 1.5rem;
  margin-bottom: 1.25rem;
}

.config-section h2,
.network-section h2,
.dates-section h2 {
  margin: 0 0 1.25rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
}

.config-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}

.config-icon {
  font-size: 1.25rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 10px;
  color: #a78bfa;
  flex-shrink: 0;
}

.config-detail {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.config-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.config-value {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
}

/* Timeline */
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
  background: rgba(255, 255, 255, 0.08);
}

.timeline-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  position: relative;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  position: absolute;
  left: -1.5rem;
  top: 50%;
  transform: translate(0, -50%);
}

.dot-default { background: rgba(148, 163, 184, 0.5); }
.dot-running { background: rgba(34, 197, 94, 0.7); }
.dot-stopped { background: rgba(59, 130, 246, 0.7); }
.dot-suspended { background: rgba(251, 146, 60, 0.7); }
.dot-terminated { background: rgba(239, 68, 68, 0.7); }

.timeline-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.tl-label {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
}

.tl-value {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

/* Right sidebar */
.detail-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.actions-card {
  padding: 1.25rem;
}

.actions-card h3 {
  margin: 0 0 1rem;
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
}

.power-btns {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.terminate-section {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 0.75rem;
  margin-top: 0.25rem;
}

.confirm-box {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 8px;
}

.confirm-text {
  font-size: 0.8rem;
  color: rgba(252, 165, 165, 0.8);
  margin: 0 0 0.5rem;
}

.status-note {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.875rem;
  margin: 0.5rem 0 0;
}

.running-note {
  color: rgba(74, 222, 128, 0.8);
}

.stopped-note {
  color: rgba(96, 165, 250, 0.8);
}

.pending-note {
  color: rgba(251, 191, 36, 0.8);
}

.warn-note {
  color: rgba(251, 146, 60, 0.8);
}

.info-card {
  padding: 1.25rem;
}

.info-card h3 {
  margin: 0 0 1rem;
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
}

.detail-list {
  margin: 0;
}

.dl-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.dl-row:last-child {
  border-bottom: none;
}

.dl-row dt {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
}

.dl-row dd {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  text-align: right;
  max-width: 60%;
  word-break: break-all;
}

/* Loading / Error */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 1.5rem;
  color: rgba(255, 255, 255, 0.5);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
