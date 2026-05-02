<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import StatusBadge from '../components/StatusBadge.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { listInstances, formatDate } from '../api/billing.js'
import { useInstanceStatusWS } from '../api/ws'

const { t } = useI18n()
const router = useRouter()
const instances = ref([])
const loading = ref(true)
const error = ref('')
const filterStatus = ref('all')
const searchQuery = ref('')

const { instanceStates, connected } = useInstanceStatusWS()

onMounted(fetchInstances)

async function fetchInstances() {
  loading.value = true
  error.value = ''
  try {
    instances.value = await listInstances()
  } catch (err) {
    error.value = err.message
    instances.value = []
  } finally {
    loading.value = false
  }
}

const mergedInstances = computed(() => {
  return instances.value.map((inst) => {
    const ws = instanceStates[inst.id]
    return ws ? { ...inst, ...ws } : inst
  })
})

const filteredInstances = computed(() => {
  let results = mergedInstances.value
  if (filterStatus.value !== 'all') {
    results = results.filter((inst) => inst.status === filterStatus.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    results = results.filter((inst) =>
      inst.id.toLowerCase().includes(q) ||
      inst.hostname.toLowerCase().includes(q) ||
      inst.plan.toLowerCase().includes(q) ||
      (inst.ipv4 && inst.ipv4.includes(q)) ||
      natPorts(inst).some((port) => String(port).includes(q))
    )
  }
  return results
})

const statusCounts = computed(() => {
  const counts = { all: mergedInstances.value.length, pending: 0, running: 0, stopped: 0, suspended: 0, terminated: 0 }
  mergedInstances.value.forEach((inst) => {
    if (counts[inst.status] !== undefined) counts[inst.status] += 1
  })
  return counts
})

const fleetStats = computed(() => {
  const all = mergedInstances.value
  const running = all.filter((inst) => inst.status === 'running').length
  const pending = all.filter((inst) => inst.status === 'pending').length
  const networkReady = all.filter((inst) => inst.ipv4 || inst.ipv6 || hasNatPorts(inst)).length
  return {
    total: all.length,
    running,
    pending,
    networkReady,
  }
})

const filterTabs = computed(() => [
  { key: 'all', label: t('instances.all') },
  { key: 'running', label: t('instances.running') },
  { key: 'stopped', label: t('instances.stopped') },
  { key: 'pending', label: t('instances.pending') },
  { key: 'suspended', label: t('instances.suspended') },
  { key: 'terminated', label: t('instances.terminated') }
])

function specLabel(inst) {
  const mem = inst.memory_mb >= 1024 ? `${inst.memory_mb / 1024}GB` : `${inst.memory_mb}MB`
  return `${inst.cpu} vCPU / ${mem} RAM / ${inst.disk_gb}GB SSD`
}

function natPorts(inst) {
  const values = Array.isArray(inst?.nat_ports) && inst.nat_ports.length > 0
    ? inst.nat_ports
    : (inst?.nat_port ? [inst.nat_port] : [])
  return [...new Set(values.map(Number).filter((port) => Number.isInteger(port) && port > 0))]
    .sort((a, b) => a - b)
}

function hasNatPorts(inst) {
  return natPorts(inst).length > 0
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

function natEntryLabel(inst) {
  const ports = natPorts(inst)
  if (!ports.length) return ''
  const label = formatPortRange(ports)
  return inst.host_ip ? `${inst.host_ip}:${label}` : `NAT :${label}`
}

function goToInstance(id) {
  router.push(`/instances/${id}`)
}

function hasLiveState(id) {
  return Boolean(instanceStates[id])
}
</script>

<template>
  <AppLayout>
    <div class="instances-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">{{ t('instances.title') }}</h1>
          <p class="page-subtitle">{{ t('instances.subtitle') }}</p>
        </div>
        <div class="header-actions">
          <div class="sync-pill" :class="{ offline: !connected }">
            <span class="sync-dot"></span>
            <span>{{ connected ? t('instances.websocketLive') : t('instances.liveSyncReconnecting') }}</span>
          </div>
          <router-link to="/instances/new" class="action-btn primary-btn small-btn">
            {{ t('instances.newInstance') }}
          </router-link>
        </div>
      </header>

      <div class="stats-grid">
        <div class="stat-card glass-card">
          <div class="stat-icon total-icon"></div>
          <div class="stat-content">
            <span class="stat-label">{{ t('instances.totalVps') }}</span>
            <span class="stat-value">{{ fleetStats.total }}</span>
          </div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon running-icon"></div>
          <div class="stat-content">
            <span class="stat-label">{{ t('instances.running') }}</span>
            <span class="stat-value">{{ fleetStats.running }}</span>
          </div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon pending-icon"></div>
          <div class="stat-content">
            <span class="stat-label">{{ t('instances.pending') }}</span>
            <span class="stat-value">{{ fleetStats.pending }}</span>
          </div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon network-icon"></div>
          <div class="stat-content">
            <span class="stat-label">{{ t('instances.networkReady') }}</span>
            <span class="stat-value">{{ fleetStats.networkReady }}</span>
          </div>
        </div>
      </div>

      <div class="filters glass-card">
        <div class="filter-tabs">
          <button
            v-for="tab in filterTabs"
            :key="tab.key"
            class="filter-tab"
            :class="{ active: filterStatus === tab.key }"
            @click="filterStatus = tab.key"
          >
            {{ tab.label }}
            <span class="count-badge">{{ statusCounts[tab.key] }}</span>
          </button>
        </div>
        <div class="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.4;">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('instances.searchPlaceholder')"
            class="search-input"
          />
        </div>
      </div>

      <SkeletonLoader v-if="loading" variant="cards" :rows="4" />

      <div v-else-if="error" class="empty-state glass-card">
        <p>{{ t('instances.noMatch') }}</p>
      </div>

      <div v-else-if="filteredInstances.length === 0" class="empty-state glass-card">
        <p>{{ t('instances.noMatch') }}</p>
        <router-link v-if="instances.length === 0" to="/instances/new" class="action-btn primary-btn small-btn">
          {{ t('instances.deployFirst') }}
        </router-link>
      </div>

      <div v-else class="instance-list">
        <div
          v-for="inst in filteredInstances"
          :key="inst.id"
          class="instance-card glass-card"
          @click="goToInstance(inst.id)"
        >
          <div class="instance-card-top">
            <div class="instance-id-col">
              <div class="instance-hostname-row">
                <span class="instance-hostname">{{ inst.hostname }}</span>
                <span v-if="hasLiveState(inst.id)" class="live-chip">{{ t('instances.live') }}</span>
              </div>
              <span class="instance-hash">#{{ inst.id.slice(0, 8) }}</span>
            </div>
            <StatusBadge :status="inst.status" />
          </div>

          <div class="instance-card-body">
            <div class="instance-specs">
              <span class="spec-tag plan-tag">{{ inst.plan }}</span>
              <span class="spec-tag">{{ specLabel(inst) }}</span>
              <span class="spec-tag">{{ inst.os }}</span>
            </div>

            <div v-if="inst.ipv4 || inst.ipv6 || hasNatPorts(inst)" class="instance-ip">
              <span v-if="inst.ipv4" class="ip-tag" :class="{ 'guest-tag': inst.network_mode === 'nat' }">{{ inst.ipv4 }}</span>
              <span v-if="hasNatPorts(inst)" class="ip-tag nat-tag">{{ natEntryLabel(inst) }}</span>
              <span v-if="inst.ipv6" class="ip-tag ipv6">{{ inst.ipv6 }}</span>
            </div>

            <div v-if="inst.status === 'pending'" class="provisioning-hint">
              <span class="provisioning-dot"></span>
              <span>{{ t('instances.provisioningInProgress') }}</span>
            </div>
          </div>

          <div class="instance-card-bottom">
            <span class="created-date">{{ t('instances.createdOn', { date: formatDate(inst.created_at) }) }}</span>
            <span v-if="inst.started_at" class="running-since">{{ t('instances.runningSince', { date: formatDate(inst.started_at) }) }}</span>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.instances-page {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
}

.page-subtitle {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.sync-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  border: 1px solid rgba(34, 197, 94, 0.18);
  background: rgba(34, 197, 94, 0.08);
  color: var(--success);
  font-size: 0.78rem;
  font-weight: 600;
}

.sync-pill.offline {
  color: var(--warning);
  border-color: var(--warning-border);
  background: var(--warning-bg);
}

.sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 6px color-mix(in srgb, currentColor 15%, transparent);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem 1.2rem;
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  position: relative;
  overflow: hidden;
}

.stat-icon::after {
  content: '';
  position: absolute;
  inset: 10px;
  border-radius: 999px;
}

.total-icon {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.18);
}

.total-icon::after {
  background: #60a5fa;
}

.running-icon {
  background: rgba(34, 197, 94, 0.08);
  border-color: rgba(34, 197, 94, 0.18);
}

.running-icon::after {
  background: #22c55e;
}

.pending-icon {
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.18);
}

.pending-icon::after {
  background: #f59e0b;
}

.network-icon {
  background: rgba(14, 165, 233, 0.08);
  border-color: rgba(14, 165, 233, 0.18);
}

.network-icon::after {
  background: #0ea5e9;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 1.45rem;
  font-weight: 700;
  color: var(--text-primary);
}

.filters {
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.filter-tabs {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.filter-tab {
  padding: 0.4rem 0.8rem;
  border: 1px solid transparent;
  border-radius: 10px;
  background: none;
  color: var(--text-muted);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.filter-tab:hover {
  background: var(--sidebar-hover-bg);
  color: var(--text-primary);
}

.filter-tab.active {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent-border);
}

.count-badge {
  font-size: 0.68rem;
  background: var(--bg-code);
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  font-weight: 600;
}

.filter-tab.active .count-badge {
  background: var(--accent-bg-hover);
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  padding: 0.4rem 0.75rem;
}

.search-input {
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.85rem;
  width: 200px;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.instance-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.instance-card {
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.25s;
  position: relative;
  overflow: hidden;
}

.instance-card:hover {
  transform: translateY(-1px);
  background: var(--bg-card-hover);
  box-shadow: var(--glass-shadow);
}

.instance-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  gap: 1rem;
}

.instance-id-col {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.instance-hostname-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.instance-hostname {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.instance-hash {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.75rem;
  color: var(--accent);
}

.live-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--success);
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.18);
}

.instance-card-body {
  margin-bottom: 0.75rem;
}

.instance-specs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.spec-tag {
  font-size: 0.72rem;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  background: var(--bg-code);
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
}

.plan-tag {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--accent);
  font-weight: 600;
}

.instance-ip {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.ip-tag {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  background: var(--success-bg);
  border: 1px solid var(--success-border);
  color: var(--success);
}

.ip-tag.ipv6 {
  color: var(--info);
  background: var(--info-bg);
  border-color: var(--info-border);
}

.ip-tag.guest-tag {
  color: var(--text-muted);
  background: var(--surface-hover);
  border-color: var(--border-color);
}

.ip-tag.nat-tag {
  color: #a855f7;
  background: rgba(168, 85, 247, 0.08);
  border-color: rgba(168, 85, 247, 0.2);
}

.provisioning-hint {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  color: var(--warning);
  margin-top: 0.45rem;
}

.provisioning-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--warning);
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.7);
  }
}

.instance-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.created-date {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.running-since {
  font-size: 0.78rem;
  color: var(--success);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 1.5rem;
  color: var(--text-muted);
}

@media (max-width: 720px) {
  .search-input {
    width: 150px;
  }
}
</style>
