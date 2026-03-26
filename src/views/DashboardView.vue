<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import StatusBadge from '../components/StatusBadge.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { listInstances, formatDate } from '../api/billing.js'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
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
        <h1 class="page-title">{{ t('dashboard.title') }}</h1>
        <p class="page-subtitle">{{ t('dashboard.subtitle') }}</p>
      </header>

      <!-- Stats Grid — Skeleton when loading -->
      <SkeletonLoader v-if="loading" variant="stats" style="margin-bottom: 2rem" />
      <div v-else class="stats-grid">
        <div class="stat-card glass-card">
          <div class="stat-icon" style="background: var(--success-bg); color: var(--success); border: 1px solid var(--success-border);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">{{ t('dashboard.running') }}</span>
            <span class="stat-value">{{ stats.runningCount }}</span>
          </div>
        </div>

        <div class="stat-card glass-card">
          <div class="stat-icon" style="background: var(--warning-bg); color: var(--warning); border: 1px solid var(--warning-border);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">{{ t('dashboard.pending') }}</span>
            <span class="stat-value">{{ stats.pendingCount }}</span>
          </div>
        </div>

        <div class="stat-card glass-card">
          <div class="stat-icon" style="background: var(--info-bg); color: var(--info); border: 1px solid var(--info-border);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="12" height="16" rx="1"/></svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">{{ t('dashboard.stopped') }}</span>
            <span class="stat-value">{{ stats.stoppedCount }}</span>
          </div>
        </div>

        <div class="stat-card glass-card">
          <div class="stat-icon" style="background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger-border);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">{{ t('dashboard.suspended') }}</span>
            <span class="stat-value">{{ stats.suspendedCount }}</span>
          </div>
        </div>
      </div>

      <!-- Recent Instances -->
      <section class="recent-section glass-card">
        <div class="section-header">
          <h2>{{ t('dashboard.recentInstances') }}</h2>
          <router-link to="/instances" class="view-all-link">{{ t('common.viewAll') }}</router-link>
        </div>

        <SkeletonLoader v-if="loading" variant="table" :rows="5" />

        <div v-else-if="error" class="error-state">
          <span>{{ error }}</span>
        </div>

        <div v-else-if="recentInstances.length === 0" class="empty-state">
          <p>{{ t('dashboard.noInstances') }}</p>
          <router-link to="/instances/new" class="action-btn primary-btn small-btn">
            {{ t('dashboard.deployFirst') }}
          </router-link>
        </div>

        <table v-else class="data-table">
          <thead>
            <tr>
              <th>{{ t('dashboard.hostname') }}</th>
              <th>{{ t('dashboard.plan') }}</th>
              <th>{{ t('dashboard.specs') }}</th>
              <th>{{ t('dashboard.status') }}</th>
              <th>{{ t('dashboard.ip') }}</th>
              <th>{{ t('dashboard.createdAt') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="inst in recentInstances"
              :key="inst.id"
              class="table-row"
              @click="goToInstance(inst.id)"
            >
              <td class="cell-mono fw-600">{{ inst.hostname }}</td>
              <td>{{ inst.plan }}</td>
              <td class="cell-muted">{{ specLabel(inst) }}</td>
              <td><StatusBadge :status="inst.status" /></td>
              <td class="cell-mono cell-success">{{ inst.ipv4 || '—' }}</td>
              <td class="cell-muted">{{ formatDate(inst.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Quick Actions -->
      <section class="quick-actions">
        <router-link to="/instances/new" class="quick-action-card glass-card">
          <span class="qa-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </span>
          <span class="qa-label">{{ t('dashboard.newInstance') }}</span>
          <span class="qa-desc">{{ t('dashboard.deployNewVPS') }}</span>
        </router-link>
        <router-link to="/instances" class="quick-action-card glass-card">
          <span class="qa-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </span>
          <span class="qa-label">{{ t('dashboard.allInstances') }}</span>
          <span class="qa-desc">{{ t('dashboard.viewAndManage') }}</span>
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

.page-header { margin-bottom: 2rem; }

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

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-content { display: flex; flex-direction: column; gap: 0.1rem; }

.stat-label {
  font-size: 0.78rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

/* Recent section */
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
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.view-all-link {
  color: var(--accent);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  transition: color 0.2s;
}

.view-all-link:hover { color: var(--accent-light); }

/* Table */
.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  text-align: left;
  padding: 0.6rem 0.75rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid var(--divider);
}

.data-table td {
  padding: 0.75rem;
  font-size: 0.88rem;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
}

.table-row {
  cursor: pointer;
  transition: background 0.15s;
}

.table-row:hover {
  background: var(--bg-card-hover);
}

.cell-mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.82rem;
}

.fw-600 { font-weight: 600; color: var(--text-primary); }
.cell-muted { color: var(--text-muted); font-size: 0.82rem; }
.cell-success { color: var(--success); }

/* States */
.loading-state, .empty-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 0;
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

@keyframes spin { to { transform: rotate(360deg); } }

.retry-btn {
  padding: 0.4rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.retry-btn:hover { background: var(--bg-card-hover); }

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
  background: var(--bg-card-hover);
  box-shadow: var(--glass-shadow);
}

.qa-icon { color: var(--accent); }
.qa-label { font-weight: 600; color: var(--text-primary); font-size: 0.95rem; }
.qa-desc { color: var(--text-muted); font-size: 0.82rem; }
</style>
