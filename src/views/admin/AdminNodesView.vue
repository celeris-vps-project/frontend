<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminLayout from '../../components/AdminLayout.vue'
import NodeStatusBadge from '../../components/NodeStatusBadge.vue'
import { listHostNodes, formatPercent, formatDateTime } from '../../api/admin'
import { useNodeStatusWS } from '../../api/ws'

const { t } = useI18n()
const router = useRouter()
const nodes = ref([])
const loading = ref(true)
const error = ref('')
const filterStatus = ref('all')
const searchQuery = ref('')

// Real-time WebSocket updates
const { nodeStates, connected } = useNodeStatusWS()

onMounted(fetchNodes)

async function fetchNodes() {
  loading.value = true
  error.value = ''
  try {
    nodes.value = await listHostNodes()
  } catch (err) {
    error.value = err.message
    nodes.value = []
  } finally {
    loading.value = false
  }
}

// Merge WebSocket state updates into the node list reactively
const mergedNodes = computed(() => {
  return nodes.value.map(n => {
    const ws = nodeStates[n.id]
    if (!ws) return n
    return {
      ...n,
      status: ws.status ?? n.status,
      cpu_usage: ws.cpu_usage ?? n.cpu_usage,
      mem_usage: ws.mem_usage ?? n.mem_usage,
      disk_usage: ws.disk_usage ?? n.disk_usage,
      vm_count: ws.vm_count ?? n.vm_count,
      ip: ws.ip || n.ip,
      agent_ver: ws.agent_ver || n.agent_ver,
      last_seen_at: ws.last_seen_at || n.last_seen_at,
    }
  })
})

const filteredNodes = computed(() => {
  let results = mergedNodes.value
  if (filterStatus.value !== 'all') {
    results = results.filter(n => n.status === filterStatus.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    results = results.filter(n =>
      n.code.toLowerCase().includes(q) ||
      n.name.toLowerCase().includes(q) ||
      n.location.toLowerCase().includes(q) ||
      (n.ip && n.ip.includes(q))
    )
  }
  return results
})

const statusCounts = computed(() => {
  const counts = { all: mergedNodes.value.length, online: 0, offline: 0 }
  mergedNodes.value.forEach(n => {
    if (counts[n.status] !== undefined) counts[n.status]++
  })
  return counts
})

const filterTabs = computed(() => [
  { key: 'all', label: t('adminNodes.all') },
  { key: 'online', label: t('adminNodes.online') },
  { key: 'offline', label: t('adminNodes.offline') }
])

function goToNode(id) {
  router.push(`/admin/nodes/${id}`)
}

// Dynamic color based on usage percentage
function usageColor(val) {
  if (val == null) return '#4b5563'
  if (val < 50) return '#22c55e'
  if (val < 80) return '#f59e0b'
  return '#ef4444'
}

function formatNatPortRange(node) {
  if (!node?.nat_port_start || !node?.nat_port_end) return ''
  return `${node.nat_port_start}-${node.nat_port_end}`
}
</script>

<template>
  <AdminLayout>
    <div class="nodes-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">{{ t('adminNodes.title') }}</h1>
          <p class="page-subtitle">{{ t('adminNodes.subtitle') }}</p>
        </div>
        <router-link to="/admin/nodes/new" class="action-btn primary-btn small-btn">
          {{ t('adminNodes.addNode') }}
        </router-link>
      </header>

      <!-- Filters -->
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
          <span class="search-icon">⌕</span>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('adminNodes.searchPlaceholder')"
            class="search-input"
          />
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>{{ t('adminNodes.loadingNodes') }}</span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn small-btn" @click="fetchNodes">{{ t('common.retry') }}</button>
      </div>

      <!-- Empty -->
      <div v-else-if="filteredNodes.length === 0" class="empty-state glass-card">
        <div class="empty-icon">⬡</div>
        <p>{{ t('adminNodes.noMatch') }}</p>
        <router-link v-if="nodes.length === 0" to="/admin/nodes/new" class="action-btn primary-btn small-btn">
          {{ t('adminNodes.registerFirst') }}
        </router-link>
      </div>

      <!-- Node Cards -->
      <div v-else class="node-list">
        <div
          v-for="node in filteredNodes"
          :key="node.id"
          class="node-card glass-card"
          @click="goToNode(node.id)"
        >
          <div class="node-card-top">
            <div class="node-id-col">
              <span class="node-code">{{ node.code }}</span>
              <span class="node-name">{{ node.name }}</span>
            </div>
            <NodeStatusBadge :status="node.status" />
          </div>

          <div class="node-card-body">
            <div class="node-meta">
              <span class="meta-tag location-tag">📍 {{ node.location }}</span>
              <span v-if="node.ip" class="meta-tag ip-tag">{{ node.ip }}</span>
              <span v-if="formatNatPortRange(node)" class="meta-tag nat-tag">{{ t('adminNodes.natPortRange') }} {{ formatNatPortRange(node) }}</span>
              <span v-if="node.agent_ver" class="meta-tag ver-tag">{{ node.agent_ver }}</span>
            </div>

            <div class="usage-bars">
              <div class="usage-col">
                <span class="usage-header">{{ t('adminNodes.cpu') || 'CPU' }}</span>
                <div class="progress-bar-track">
                  <div
                    class="progress-bar-fill"
                    :style="{
                      width: `${node.cpu_usage || 0}%`,
                      background: usageColor(node.cpu_usage)
                    }"
                  >
                    <span class="progress-bar-text">{{ formatPercent(node.cpu_usage) }}</span>
                  </div>
                  <span v-if="!node.cpu_usage || node.cpu_usage < 15" class="progress-bar-text-outside">{{ formatPercent(node.cpu_usage) }}</span>
                </div>
              </div>
              <div class="usage-col">
                <span class="usage-header">{{ t('adminNodes.memory') || 'MEM' }}</span>
                <div class="progress-bar-track">
                  <div
                    class="progress-bar-fill"
                    :style="{
                      width: `${node.mem_usage || 0}%`,
                      background: usageColor(node.mem_usage)
                    }"
                  >
                    <span class="progress-bar-text">{{ formatPercent(node.mem_usage) }}</span>
                  </div>
                  <span v-if="!node.mem_usage || node.mem_usage < 15" class="progress-bar-text-outside">{{ formatPercent(node.mem_usage) }}</span>
                </div>
              </div>
              <div class="usage-col">
                <span class="usage-header">{{ t('adminNodes.disk') || 'DISK' }}</span>
                <div class="progress-bar-track">
                  <div
                    class="progress-bar-fill"
                    :style="{
                      width: `${node.disk_usage || 0}%`,
                      background: usageColor(node.disk_usage)
                    }"
                  >
                    <span class="progress-bar-text">{{ formatPercent(node.disk_usage) }}</span>
                  </div>
                  <span v-if="!node.disk_usage || node.disk_usage < 15" class="progress-bar-text-outside">{{ formatPercent(node.disk_usage) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="node-card-bottom">
            <span class="vm-count">{{ t('adminNodes.vms', { count: node.vm_count }) }}</span>
            <span v-if="node.last_seen_at" class="last-seen">{{ t('adminNodes.lastSeen', { time: formatDateTime(node.last_seen_at) }) }}</span>
          </div>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.nodes-page {
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
  font-size: 2rem;
  font-weight: 700;
  background: none;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-subtitle {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

/* Filters */
.filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-tabs {
  display: flex;
  gap: 0.25rem;
}

.filter-tab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  font-size: 0.825rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tab:hover {
  color: var(--text-primary);
  background: var(--bg-card);
}

.filter-tab.active {
  color: var(--danger);
  background: var(--danger-bg);
  border-color: var(--danger-border);
}

.count-badge {
  background: var(--bg-input);
  padding: 0.1rem 0.45rem;
  border-radius: 6px;
  font-size: 0.7rem;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
}

.search-icon { color: var(--text-muted); font-size: 0.9rem; }

.search-input {
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.85rem;
  width: 200px;
}
.search-input::placeholder { color: var(--text-muted); }

/* Loading / Error / Empty */
.loading-state, .error-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-secondary);
}

.empty-icon { font-size: 2.5rem; opacity: 0.3; }

.spinner {
  width: 24px; height: 24px;
  border: 2px solid var(--border-default);
  border-top: 2px solid #f87171;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Node Cards */
.node-list {
  display: grid;
  gap: 1rem;
}

.node-card {
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.2s;
}
.node-card:hover {
  border-color: var(--text-muted);
  transform: translateY(-1px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

.node-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.node-id-col { display: flex; flex-direction: column; gap: 0.15rem; }
.node-code {
  font-family: monospace;
  font-weight: 700;
  color: var(--danger);
  font-size: 1rem;
}
.node-name {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.node-card-body { margin-bottom: 0.75rem; }

.node-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.meta-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
}

.ip-tag { font-family: monospace; }

/* ─── Progress Bar Usage ─── */
.usage-bars {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.usage-col {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.usage-header {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.progress-bar-track {
  position: relative;
  width: 100%;
  height: 22px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  min-width: 0;
  transition: width 0.5s ease, background 0.5s ease;
  position: relative;
}

.progress-bar-text {
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  font-family: 'SF Mono', 'Cascadia Code', monospace;
}

.progress-bar-text-outside {
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
  white-space: nowrap;
  font-family: 'SF Mono', 'Cascadia Code', monospace;
}

.node-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.vm-count { font-weight: 600; color: var(--text-secondary); }
</style>
