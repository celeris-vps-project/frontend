<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminLayout from '../../components/AdminLayout.vue'
import {
  getResourcePool,
  activateResourcePool,
  deactivateResourcePool,
  assignNodeToPool,
  removeNodeFromPool,
  listHostNodes,
  listAllProducts,
  listAllRegions
} from '../../api/admin'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const pool = ref(null)
const loading = ref(true)
const error = ref('')
const activeTab = ref('nodes')

// Assign node dialog
const showAssignDialog = ref(false)
const allNodes = ref([])
const selectedNodeId = ref('')
const assignLoading = ref(false)

// Products linked to this pool
const allProducts = ref([])

// Regions lookup
const allRegions = ref([])

onMounted(fetchPool)

async function fetchPool() {
  loading.value = true
  error.value = ''
  try {
    pool.value = await getResourcePool(route.params.id)
    // Also load all nodes and products for assignment
    const [nodes, products, regionsData] = await Promise.all([
      listHostNodes(),
      listAllProducts(),
      listAllRegions()
    ])
    allNodes.value = nodes
    allProducts.value = products
    allRegions.value = regionsData
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const poolNodes = computed(() => pool.value?.nodes || [])

const poolRegion = computed(() => {
  if (!pool.value) return null
  return allRegions.value.find(r => r.id === pool.value.region_id)
})

const linkedProducts = computed(() => {
  if (!pool.value) return []
  return allProducts.value.filter(p => p.resource_pool_id === pool.value.id)
})

const unassignedNodes = computed(() => {
  const assignedIds = new Set(poolNodes.value.map(n => n.id))
  return allNodes.value.filter(n => !assignedIds.has(n.id))
})

function usagePercent(used, total) {
  if (!total) return 0
  return Math.round((used / total) * 100)
}

async function toggleStatus() {
  try {
    if (pool.value.status === 'active') {
      await deactivateResourcePool(pool.value.id)
    } else {
      await activateResourcePool(pool.value.id)
    }
    await fetchPool()
  } catch (err) {
    error.value = err.message
  }
}

async function handleAssignNode() {
  if (!selectedNodeId.value) return
  assignLoading.value = true
  try {
    await assignNodeToPool(pool.value.id, selectedNodeId.value)
    showAssignDialog.value = false
    selectedNodeId.value = ''
    await fetchPool()
  } catch (err) {
    error.value = err.message
  } finally {
    assignLoading.value = false
  }
}

async function handleRemoveNode(nodeId) {
  try {
    await removeNodeFromPool(pool.value.id, nodeId)
    await fetchPool()
  } catch (err) {
    error.value = err.message
  }
}
</script>

<template>
  <AdminLayout>
    <div class="pool-detail-page">
      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>{{ t('adminResourcePoolDetail.loadingPool') }}</span>
      </div>

      <div v-else-if="error && !pool" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn small-btn" @click="fetchPool">{{ t('common.retry') }}</button>
      </div>

      <template v-else-if="pool">
        <!-- Header -->
        <header class="page-header">
          <div>
            <h1 class="page-title">{{ pool.name }}</h1>
            <p class="page-subtitle mono">{{ pool.id }}</p>
          </div>
          <div class="header-actions">
            <button
              class="action-btn small-btn"
              :class="pool.status === 'active' ? 'danger-btn' : 'success-btn'"
              @click="toggleStatus"
            >
              {{ pool.status === 'active' ? t('adminResourcePoolDetail.deactivate') : t('adminResourcePoolDetail.activate') }}
            </button>
            <router-link to="/admin/resource-pools" class="action-btn secondary-btn small-btn">{{ t('adminResourcePoolDetail.back') }}</router-link>
          </div>
        </header>

        <div v-if="error" class="inline-error">{{ error }}</div>

        <!-- Summary Cards -->
        <div class="summary-row">
          <div class="summary-card glass-card">
            <div class="summary-icon status-icon" :class="pool.status">⬢</div>
            <div class="summary-content">
              <span class="summary-label">{{ t('adminResourcePoolDetail.statusLabel') }}</span>
              <span class="summary-value" :class="pool.status">{{ pool.status }}</span>
            </div>
          </div>
          <div class="summary-card glass-card">
            <div class="summary-icon region-icon">🌍</div>
            <div class="summary-content">
              <span class="summary-label">{{ t('adminResourcePoolDetail.regionLabel') }}</span>
              <span class="summary-value" v-if="poolRegion">{{ poolRegion.flag_icon }} {{ poolRegion.name }}</span>
              <span class="summary-value" v-else>—</span>
            </div>
          </div>
          <div class="summary-card glass-card">
            <div class="summary-icon nodes-icon">⬡</div>
            <div class="summary-content">
              <span class="summary-label">{{ t('adminResourcePoolDetail.nodesLabel') }}</span>
              <span class="summary-value">{{ poolNodes.length }}</span>
            </div>
          </div>
          <div class="summary-card glass-card">
            <div class="summary-icon slots-icon">◈</div>
            <div class="summary-content">
              <span class="summary-label">{{ t('adminResourcePoolDetail.availableSlots') }}</span>
              <span class="summary-value">{{ pool.available_slots }} <small>/ {{ pool.total_slots }}</small></span>
            </div>
          </div>
          <div class="summary-card glass-card">
            <div class="summary-icon usage-icon">⚡</div>
            <div class="summary-content">
              <span class="summary-label">{{ t('adminResourcePoolDetail.usageLabel') }}</span>
              <span class="summary-value">{{ usagePercent(pool.used_slots, pool.total_slots) }}%</span>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs glass-card">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'nodes' }"
            @click="activeTab = 'nodes'"
          >
            {{ t('adminResourcePoolDetail.nodesTab') }} <span class="tab-count">{{ poolNodes.length }}</span>
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'products' }"
            @click="activeTab = 'products'"
          >
            {{ t('adminResourcePoolDetail.productsTab') }} <span class="tab-count">{{ linkedProducts.length }}</span>
          </button>
        </div>

        <!-- Nodes Tab -->
        <div v-if="activeTab === 'nodes'" class="tab-content">
          <div class="tab-header">
            <h3>{{ t('adminResourcePoolDetail.assignedNodes') }}</h3>
            <button class="action-btn primary-btn small-btn" @click="showAssignDialog = true">
              {{ t('adminResourcePoolDetail.addNode') }}
            </button>
          </div>

          <div v-if="poolNodes.length === 0" class="empty-tab glass-card">
            <p>{{ t('adminResourcePoolDetail.noNodesAssigned') }}</p>
          </div>

          <div v-else class="node-grid">
            <div v-for="node in poolNodes" :key="node.id" class="node-item glass-card">
              <div class="node-item-top">
                <div>
                  <span class="node-code">{{ node.code }}</span>
                  <span class="node-name-label">{{ node.name }}</span>
                </div>
                <span class="node-status-dot" :class="node.status"></span>
              </div>
              <div class="node-item-stats">
                <span>{{ node.available_slots }} / {{ node.total_slots }} slots</span>
                <span class="node-enabled" :class="{ on: node.enabled }">
                  {{ node.enabled ? t('adminResourcePoolDetail.enabledLabel') : t('adminResourcePoolDetail.disabledLabel') }}
                </span>
              </div>
              <button class="remove-btn" @click.stop="handleRemoveNode(node.id)" title="Remove from pool">✕</button>
            </div>
          </div>
        </div>

        <!-- Products Tab -->
        <div v-if="activeTab === 'products'" class="tab-content">
          <div class="tab-header">
            <h3>{{ t('adminResourcePoolDetail.linkedProducts') }}</h3>
          </div>

          <div v-if="linkedProducts.length === 0" class="empty-tab glass-card">
            <p>{{ t('adminResourcePoolDetail.noProductsLinked') }}</p>
          </div>

          <div v-else class="product-grid">
            <div
              v-for="product in linkedProducts"
              :key="product.id"
              class="product-item glass-card"
              @click="router.push(`/admin/products/${product.id}`)"
            >
              <span class="product-item-name">{{ product.name }}</span>
              <span class="product-item-slug mono">{{ product.slug }}</span>
            </div>
          </div>
        </div>

        <!-- Assign Node Dialog -->
        <div v-if="showAssignDialog" class="dialog-overlay" @click.self="showAssignDialog = false">
          <div class="dialog glass-card">
            <h3 class="dialog-title">{{ t('adminResourcePoolDetail.addNodeToPool') }}</h3>
            <div class="form-group">
              <label class="form-label">{{ t('adminResourcePoolDetail.selectNode') }}</label>
              <select v-model="selectedNodeId" class="form-input">
                <option value="" disabled>{{ t('adminResourcePoolDetail.chooseNode') }}</option>
                <option v-for="n in unassignedNodes" :key="n.id" :value="n.id">
                  {{ n.code }} — {{ n.name }} ({{ n.location }})
                </option>
              </select>
            </div>
            <div class="dialog-actions">
              <button class="action-btn secondary-btn small-btn" @click="showAssignDialog = false">{{ t('common.cancel') }}</button>
              <button class="action-btn primary-btn small-btn" :disabled="!selectedNodeId || assignLoading" @click="handleAssignNode">
                {{ assignLoading ? t('adminResourcePoolDetail.addingNode') : t('adminResourcePoolDetail.addNodeBtn') }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </AdminLayout>
</template>

<style scoped>
.pool-detail-page {
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
  color: var(--text-muted);
  font-size: 0.8rem;
}

.header-actions { display: flex; gap: 0.5rem; }

.inline-error {
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  color: var(--danger);
  padding: 0.6rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

/* Summary */
.summary-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.summary-card {
  display: flex; align-items: center; gap: 1rem; padding: 1.1rem;
}

.summary-icon {
  width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
  border-radius: 10px; font-size: 1.2rem;
}
.status-icon.active { background: var(--success-bg); color: var(--success); }
.status-icon.inactive { background: var(--danger-bg); color: var(--danger); }
.region-icon { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
.nodes-icon { background: var(--accent-bg); color: var(--accent); }
.slots-icon { background: var(--warning-bg); color: var(--warning); }
.usage-icon { background: rgba(139, 92, 246, 0.15); color: var(--accent); }

.summary-content { display: flex; flex-direction: column; }
.summary-label { font-size: 0.75rem; color: var(--text-secondary); font-weight: 500; }
.summary-value { font-size: 1.25rem; font-weight: 700; color: var(--text-primary); text-transform: capitalize; }
.summary-value.active { color: var(--success); }
.summary-value.inactive { color: var(--danger); }
.summary-value small { font-size: 0.75rem; font-weight: 400; color: var(--text-muted); }

/* Tabs */
.tabs {
  display: flex; gap: 0.25rem; padding: 0.5rem; margin-bottom: 1.5rem;
}

.tab-btn {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.55rem 1rem; border-radius: 8px;
  font-size: 0.85rem; font-weight: 500;
  color: var(--text-secondary);
  background: none; border: 1px solid transparent;
  cursor: pointer; transition: all 0.2s;
}
.tab-btn:hover { color: var(--text-primary); background: var(--bg-card); }
.tab-btn.active { color: var(--danger); background: var(--danger-bg); border-color: var(--danger-border); }

.tab-count {
  background: var(--bg-input);
  padding: 0.1rem 0.4rem; border-radius: 5px; font-size: 0.7rem;
}

/* Tab Content */
.tab-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 1rem;
}
.tab-header h3 { margin: 0; font-size: 1rem; color: var(--text-primary); }

.empty-tab { padding: 2rem; text-align: center; color: var(--text-muted); }

/* Node Items */
.node-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem; }

.node-item {
  padding: 1rem; position: relative;
}

.node-item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.node-code { font-family: monospace; font-weight: 700; color: var(--accent); font-size: 0.95rem; }
.node-name-label { display: block; font-size: 0.75rem; color: var(--text-muted); }

.node-status-dot {
  width: 10px; height: 10px; border-radius: 50%;
}
.node-status-dot.online { background: #4ade80; box-shadow: 0 0 6px rgba(74, 222, 128, 0.4); }
.node-status-dot.offline { background: #f87171; }

.node-item-stats {
  display: flex; justify-content: space-between;
  font-size: 0.78rem; color: var(--text-secondary);
}
.node-enabled { font-weight: 600; }
.node-enabled.on { color: var(--success); }

.remove-btn {
  position: absolute; top: 0.6rem; right: 0.6rem;
  background: var(--danger-bg); border: 1px solid var(--danger-border);
  color: var(--danger); width: 24px; height: 24px;
  border-radius: 6px; font-size: 0.7rem;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.2s;
}
.node-item:hover .remove-btn { opacity: 1; }

/* Product Items */
.product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; }
.product-item {
  padding: 1rem; cursor: pointer; transition: all 0.2s;
}
.product-item:hover { border-color: var(--text-muted); }
.product-item-name { display: block; font-weight: 600; color: var(--text-primary); font-size: 0.9rem; }
.product-item-slug { font-size: 0.75rem; color: var(--text-muted); }

/* Dialog */
.dialog-overlay {
  position: fixed; inset: 0; background: var(--bg-code);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.dialog { padding: 2rem; width: 400px; max-width: 90vw; }
.dialog-title { margin: 0 0 1.5rem; font-size: 1.1rem; color: var(--text-primary); }
.dialog-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem; }

.form-group { margin-bottom: 1rem; }
.form-label { display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.5rem; }
.form-input {
  width: 100%; padding: 0.7rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 10px; color: var(--text-primary); font-size: 0.9rem;
  outline: none; box-sizing: border-box;
}
.form-input option { background: var(--bg-base); color: var(--text-primary); }

/* States */
.loading-state, .error-state {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.75rem; padding: 3rem; color: var(--text-secondary);
}

.spinner {
  width: 24px; height: 24px;
  border: 2px solid var(--border-default);
  border-top: 2px solid #f87171;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.mono { font-family: monospace; }
</style>
