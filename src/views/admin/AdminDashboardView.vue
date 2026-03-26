<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminLayout from '../../components/AdminLayout.vue'
import NodeStatusBadge from '../../components/NodeStatusBadge.vue'
import { listHostNodes, formatPercent } from '../../api/admin'
import { useNodeStatusWS } from '../../api/ws'

const { t } = useI18n()
const router = useRouter()
const nodes = ref([])
const loading = ref(true)
const error = ref('')

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

const stats = computed(() => {
  const all = mergedNodes.value
  const online = all.filter(n => n.status === 'online').length
  const offline = all.filter(n => n.status === 'offline').length
  const totalVMs = all.reduce((sum, n) => sum + (n.vm_count || 0), 0)
  const avgCPU = all.length ? all.reduce((s, n) => s + (n.cpu_usage || 0), 0) / all.length : 0
  return { online, offline, total: all.length, totalVMs, avgCPU }
})

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
</script>

<template>
  <AdminLayout>
    <div class="admin-overview">
      <header class="page-header">
        <h1 class="page-title">{{ t('admin.overview') }}</h1>
        <p class="page-subtitle">{{ t('admin.overviewSubtitle') }}</p>
      </header>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card glass-card">
          <div class="stat-icon online-icon">⬢</div>
          <div class="stat-content">
            <span class="stat-label">{{ t('admin.onlineNodes') }}</span>
            <span class="stat-value">{{ stats.online }}</span>
          </div>
        </div>

        <div class="stat-card glass-card">
          <div class="stat-icon offline-icon">⬡</div>
          <div class="stat-content">
            <span class="stat-label">{{ t('admin.offlineNodes') }}</span>
            <span class="stat-value">{{ stats.offline }}</span>
          </div>
        </div>

        <div class="stat-card glass-card">
          <div class="stat-icon vm-icon">◈</div>
          <div class="stat-content">
            <span class="stat-label">{{ t('admin.totalVMs') }}</span>
            <span class="stat-value">{{ stats.totalVMs }}</span>
          </div>
        </div>

        <div class="stat-card glass-card">
          <div class="stat-icon cpu-icon">⚡</div>
          <div class="stat-content">
            <span class="stat-label">{{ t('admin.avgCPU') }}</span>
            <span class="stat-value">{{ formatPercent(stats.avgCPU) }}</span>
          </div>
        </div>
      </div>

      <!-- Node List -->
      <section class="nodes-section glass-card">
        <div class="section-header">
          <h2>{{ t('admin.hostNodes') }}</h2>
          <router-link to="/admin/nodes" class="view-all-link">{{ t('admin.viewAll') }}</router-link>
        </div>

        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <span>{{ t('admin.loadingNodes') }}</span>
        </div>

        <div v-else-if="error" class="error-state">
          <span>{{ error }}</span>
          <button class="retry-btn" @click="fetchNodes">{{ t('common.retry') }}</button>
        </div>

        <div v-else-if="mergedNodes.length === 0" class="empty-state">
          <p>{{ t('admin.noNodes') }}</p>
          <router-link to="/admin/nodes/new" class="action-btn primary-btn small-btn">
            {{ t('admin.addFirstNode') }}
          </router-link>
        </div>

        <table v-else class="nodes-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Location</th>
              <th>Status</th>
              <th>CPU</th>
              <th>Memory</th>
              <th>Disk</th>
              <th>VMs</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="node in mergedNodes"
              :key="node.id"
              class="node-row"
              @click="goToNode(node.id)"
            >
              <td class="code-cell">{{ node.code }}</td>
              <td>{{ node.name }}</td>
              <td>{{ node.location }}</td>
              <td><NodeStatusBadge :status="node.status" /></td>
              <td class="usage-cell">
                <div class="table-bar-track">
                  <div class="table-bar-fill" :style="{ width: `${node.cpu_usage || 0}%`, background: usageColor(node.cpu_usage) }">
                    <span v-if="node.cpu_usage >= 15" class="table-bar-text">{{ formatPercent(node.cpu_usage) }}</span>
                  </div>
                  <span v-if="!node.cpu_usage || node.cpu_usage < 15" class="table-bar-text-out">{{ formatPercent(node.cpu_usage) }}</span>
                </div>
              </td>
              <td class="usage-cell">
                <div class="table-bar-track">
                  <div class="table-bar-fill" :style="{ width: `${node.mem_usage || 0}%`, background: usageColor(node.mem_usage) }">
                    <span v-if="node.mem_usage >= 15" class="table-bar-text">{{ formatPercent(node.mem_usage) }}</span>
                  </div>
                  <span v-if="!node.mem_usage || node.mem_usage < 15" class="table-bar-text-out">{{ formatPercent(node.mem_usage) }}</span>
                </div>
              </td>
              <td class="usage-cell">
                <div class="table-bar-track">
                  <div class="table-bar-fill" :style="{ width: `${node.disk_usage || 0}%`, background: usageColor(node.disk_usage) }">
                    <span v-if="node.disk_usage >= 15" class="table-bar-text">{{ formatPercent(node.disk_usage) }}</span>
                  </div>
                  <span v-if="!node.disk_usage || node.disk_usage < 15" class="table-bar-text-out">{{ formatPercent(node.disk_usage) }}</span>
                </div>
              </td>
              <td>{{ node.vm_count }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </AdminLayout>
</template>

<style scoped>
.admin-overview {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header { margin-bottom: 2rem; }

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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 1.3rem;
}

.online-icon { background: var(--success-bg); color: var(--success); }
.offline-icon { background: var(--danger-bg); color: var(--danger); }
.vm-icon { background: var(--accent-bg); color: var(--accent); }
.cpu-icon { background: var(--warning-bg); color: var(--warning); }

.stat-content { display: flex; flex-direction: column; }
.stat-label { font-size: 0.8rem; color: var(--text-secondary); font-weight: 500; }
.stat-value { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }

.nodes-section { padding: 1.5rem; }
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.section-header h2 { margin: 0; font-size: 1.15rem; color: var(--text-primary); }
.view-all-link {
  color: var(--accent);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
}
.view-all-link:hover { color: var(--accent); }

.loading-state, .error-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  color: var(--text-secondary);
}

.spinner {
  width: 24px; height: 24px;
  border: 2px solid var(--border-default);
  border-top: 2px solid #a78bfa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.nodes-table {
  width: 100%;
  border-collapse: collapse;
}
.nodes-table th {
  text-align: left;
  padding: 0.6rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--divider);
}
.nodes-table td {
  padding: 0.75rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  border-bottom: 1px solid var(--divider);
}
.node-row { cursor: pointer; transition: background 0.15s; }
.node-row:hover { background: var(--bg-card); }
.code-cell { font-family: monospace; color: var(--accent); font-weight: 600; }

/* ─── Table Progress Bars ─── */
.usage-cell {
  min-width: 100px;
}

.table-bar-track {
  position: relative;
  width: 100%;
  height: 22px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  overflow: hidden;
}

.table-bar-fill {
  height: 100%;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  min-width: 0;
  transition: width 0.5s ease, background 0.5s ease;
}

.table-bar-text {
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  font-family: 'SF Mono', 'Cascadia Code', monospace;
}

.table-bar-text-out {
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
</style>
