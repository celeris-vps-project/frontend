<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/AdminLayout.vue'
import NodeStatusBadge from '../../components/NodeStatusBadge.vue'
import { listHostNodes, formatPercent } from '../../api/admin'

const router = useRouter()
const nodes = ref([])
const loading = ref(true)
const error = ref('')

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

const stats = computed(() => {
  const all = nodes.value
  const online = all.filter(n => n.status === 'online').length
  const offline = all.filter(n => n.status === 'offline').length
  const totalVMs = all.reduce((sum, n) => sum + (n.vm_count || 0), 0)
  const avgCPU = all.length ? all.reduce((s, n) => s + (n.cpu_usage || 0), 0) / all.length : 0
  return { online, offline, total: all.length, totalVMs, avgCPU }
})

function goToNode(id) {
  router.push(`/admin/nodes/${id}`)
}
</script>

<template>
  <AdminLayout>
    <div class="admin-overview">
      <header class="page-header">
        <h1 class="page-title">Admin Overview</h1>
        <p class="page-subtitle">Infrastructure at a glance</p>
      </header>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card glass-card">
          <div class="stat-icon online-icon">⬢</div>
          <div class="stat-content">
            <span class="stat-label">Online Nodes</span>
            <span class="stat-value">{{ stats.online }}</span>
          </div>
        </div>

        <div class="stat-card glass-card">
          <div class="stat-icon offline-icon">⬡</div>
          <div class="stat-content">
            <span class="stat-label">Offline Nodes</span>
            <span class="stat-value">{{ stats.offline }}</span>
          </div>
        </div>

        <div class="stat-card glass-card">
          <div class="stat-icon vm-icon">◈</div>
          <div class="stat-content">
            <span class="stat-label">Total VMs</span>
            <span class="stat-value">{{ stats.totalVMs }}</span>
          </div>
        </div>

        <div class="stat-card glass-card">
          <div class="stat-icon cpu-icon">⚡</div>
          <div class="stat-content">
            <span class="stat-label">Avg CPU</span>
            <span class="stat-value">{{ formatPercent(stats.avgCPU) }}</span>
          </div>
        </div>
      </div>

      <!-- Node List -->
      <section class="nodes-section glass-card">
        <div class="section-header">
          <h2>Host Nodes</h2>
          <router-link to="/admin/nodes" class="view-all-link">View All →</router-link>
        </div>

        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <span>Loading nodes...</span>
        </div>

        <div v-else-if="error" class="error-state">
          <span>{{ error }}</span>
          <button class="retry-btn" @click="fetchNodes">Retry</button>
        </div>

        <div v-else-if="nodes.length === 0" class="empty-state">
          <p>No host nodes registered yet.</p>
          <router-link to="/admin/nodes/new" class="action-btn primary-btn small-btn">
            Add First Node
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
              v-for="node in nodes"
              :key="node.id"
              class="node-row"
              @click="goToNode(node.id)"
            >
              <td class="code-cell">{{ node.code }}</td>
              <td>{{ node.name }}</td>
              <td>{{ node.location }}</td>
              <td><NodeStatusBadge :status="node.status" /></td>
              <td>{{ formatPercent(node.cpu_usage) }}</td>
              <td>{{ formatPercent(node.mem_usage) }}</td>
              <td>{{ formatPercent(node.disk_usage) }}</td>
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
  background: linear-gradient(135deg, #fff, rgba(255, 255, 255, 0.7));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-subtitle {
  margin: 0.25rem 0 0;
  color: rgba(255, 255, 255, 0.5);
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

.online-icon { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
.offline-icon { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.vm-icon { background: rgba(99, 102, 241, 0.15); color: #818cf8; }
.cpu-icon { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }

.stat-content { display: flex; flex-direction: column; }
.stat-label { font-size: 0.8rem; color: rgba(255, 255, 255, 0.5); font-weight: 500; }
.stat-value { font-size: 1.5rem; font-weight: 700; color: #fff; }

.nodes-section { padding: 1.5rem; }
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.section-header h2 { margin: 0; font-size: 1.15rem; color: #fff; }
.view-all-link {
  color: rgba(167, 139, 250, 0.8);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
}
.view-all-link:hover { color: #a78bfa; }

.loading-state, .error-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  color: rgba(255, 255, 255, 0.5);
}

.spinner {
  width: 24px; height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.1);
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
  color: rgba(255, 255, 255, 0.4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.nodes-table td {
  padding: 0.75rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.node-row { cursor: pointer; transition: background 0.15s; }
.node-row:hover { background: rgba(255, 255, 255, 0.03); }
.code-cell { font-family: monospace; color: #a78bfa; font-weight: 600; }
</style>
