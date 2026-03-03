<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { listInstances, formatDate } from '../api/billing.js'

const router = useRouter()
const instances = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  await fetchInstances()
})

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

const stats = computed(() => {
  const all = instances.value
  const runningCount = all.filter(i => i.status === 'running').length
  const pendingCount = all.filter(i => i.status === 'pending').length
  const stoppedCount = all.filter(i => i.status === 'stopped').length
  const suspendedCount = all.filter(i => i.status === 'suspended').length
  return { runningCount, pendingCount, stoppedCount, suspendedCount, total: all.length }
})

const recentInstances = computed(() => {
  return [...instances.value]
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .slice(0, 5)
})

function goToInstance(id) {
  router.push(`/instances/${id}`)
}

function specLabel(inst) {
  const mem = inst.memory_mb >= 1024 ? `${inst.memory_mb / 1024}GB` : `${inst.memory_mb}MB`
  return `${inst.cpu}c / ${mem}`
}
</script>

<template>
  <AppLayout>
    <div class="dashboard">
      <header class="page-header">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">VPS Instances Overview</p>
      </header>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card glass-card">
          <div class="stat-icon revenue-icon">▶</div>
          <div class="stat-content">
            <span class="stat-label">Running</span>
            <span class="stat-value">{{ stats.runningCount }}</span>
          </div>
        </div>

        <div class="stat-card glass-card">
          <div class="stat-icon outstanding-icon">⧖</div>
          <div class="stat-content">
            <span class="stat-label">Pending</span>
            <span class="stat-value">{{ stats.pendingCount }}</span>
          </div>
        </div>

        <div class="stat-card glass-card">
          <div class="stat-icon paid-icon">■</div>
          <div class="stat-content">
            <span class="stat-label">Stopped</span>
            <span class="stat-value">{{ stats.stoppedCount }}</span>
          </div>
        </div>

        <div class="stat-card glass-card">
          <div class="stat-icon draft-icon">⚠</div>
          <div class="stat-content">
            <span class="stat-label">Suspended</span>
            <span class="stat-value">{{ stats.suspendedCount }}</span>
          </div>
        </div>
      </div>

      <!-- Recent Instances -->
      <section class="recent-section glass-card">
        <div class="section-header">
          <h2>Recent Instances</h2>
          <router-link to="/instances" class="view-all-link">View All →</router-link>
        </div>

        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <span>Loading instances...</span>
        </div>

        <div v-else-if="error" class="error-state">
          <span>{{ error }}</span>
          <button class="retry-btn" @click="fetchInstances">Retry</button>
        </div>

        <div v-else-if="recentInstances.length === 0" class="empty-state">
          <p>No instances yet.</p>
          <router-link to="/instances/new" class="action-btn primary-btn">
            Deploy Your First Instance
          </router-link>
        </div>

        <table v-else class="orders-table">
          <thead>
            <tr>
              <th>Hostname</th>
              <th>Plan</th>
              <th>Specs</th>
              <th>Status</th>
              <th>IP</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="inst in recentInstances"
              :key="inst.id"
              class="order-row"
              @click="goToInstance(inst.id)"
            >
              <td class="hostname">{{ inst.hostname }}</td>
              <td>{{ inst.plan }}</td>
              <td class="specs">{{ specLabel(inst) }}</td>
              <td><StatusBadge :status="inst.status" /></td>
              <td class="ip-cell">{{ inst.ipv4 || '—' }}</td>
              <td>{{ formatDate(inst.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Quick Actions -->
      <section class="quick-actions">
        <router-link to="/instances/new" class="quick-action-card glass-card">
          <span class="qa-icon">✦</span>
          <span class="qa-label">New Instance</span>
          <span class="qa-desc">Deploy a new VPS instance</span>
        </router-link>
        <router-link to="/instances" class="quick-action-card glass-card">
          <span class="qa-icon">◈</span>
          <span class="qa-label">All Instances</span>
          <span class="qa-desc">View and manage instances</span>
        </router-link>
      </section>
    </div>
  </AppLayout>
</template>

<style scoped>
.dashboard {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

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

/* Stats */
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
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  flex-shrink: 0;
}

.revenue-icon {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.outstanding-icon {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.2);
}

.draft-icon {
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.paid-icon {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.stat-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1.35rem;
  font-weight: 700;
  color: #fff;
}

/* Recent orders section */
.recent-section {
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.section-header h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: #fff;
}

.view-all-link {
  color: #a78bfa;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  transition: color 0.2s;
}

.view-all-link:hover {
  color: #c4b5fd;
}

/* Table */
.orders-table {
  width: 100%;
  border-collapse: collapse;
}

.orders-table th {
  text-align: left;
  padding: 0.65rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.orders-table td {
  padding: 0.8rem 0.75rem;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.order-row {
  cursor: pointer;
  transition: background 0.2s;
}

.order-row:hover {
  background: rgba(255, 255, 255, 0.04);
}

.order-id {
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #a78bfa;
  font-weight: 500;
}

.hostname {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
}

.specs {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.55);
}

.ip-cell {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
  color: rgba(74, 222, 128, 0.8);
}

/* Empty / Loading / Error */
.loading-state,
.empty-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 0;
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

.retry-btn {
  padding: 0.4rem 1rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}

.retry-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Quick Actions */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

.quick-action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem;
  text-decoration: none;
  text-align: center;
  transition: all 0.25s;
  cursor: pointer;
}

.quick-action-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.08);
}

.qa-icon {
  font-size: 1.75rem;
  color: #a78bfa;
}

.qa-label {
  font-weight: 600;
  color: #fff;
  font-size: 1rem;
}

.qa-desc {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.825rem;
}
</style>
