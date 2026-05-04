<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminLayout from '../../components/AdminLayout.vue'
import NodeStatusBadge from '../../components/NodeStatusBadge.vue'
import {
  getHostNode,
  listIPs,
  addIP,
  enqueueTask,
  listAllProducts,
  enableHostNode,
  disableHostNode,
  updateHostNodeNatEntry,
  updateHostNodeSlots,
  revokeNodeToken,
  createNodeBootstrapToken,
  formatPercent,
  formatDateTime
} from '../../api/admin'
import { useNodeStatusWS } from '../../api/ws'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const nodeID = route.params.id

const node = ref(null)
const ips = ref([])
const products = ref([])
const loading = ref(true)
const error = ref('')

// Real-time WebSocket updates
const { nodeStates } = useNodeStatusWS()

// Merge WebSocket state into the fetched node data
const liveNode = computed(() => {
  if (!node.value) return null
  const ws = nodeStates[node.value.id]
  if (!ws) return node.value
  return {
    ...node.value,
    status: ws.status ?? node.value.status,
    cpu_usage: ws.cpu_usage ?? node.value.cpu_usage,
    mem_usage: ws.mem_usage ?? node.value.mem_usage,
    disk_usage: ws.disk_usage ?? node.value.disk_usage,
    vm_count: ws.vm_count ?? node.value.vm_count,
    ip: ws.ip || node.value.ip,
    agent_ver: ws.agent_ver || node.value.agent_ver,
    last_seen_at: ws.last_seen_at || node.value.last_seen_at,
  }
})

// -- Add IP form --
const showAddIP = ref(false)
const ipForm = ref({ address: '', version: 4 })
const ipLoading = ref(false)
const ipError = ref('')

// -- Enqueue Task form --
const showTaskForm = ref(false)
const taskForm = ref({
  type: 'provision',
  spec: {
    instance_id: '',
    hostname: '',
    os: 'ubuntu-22.04',
    cpu: 1,
    memory_mb: 1024,
    disk_gb: 25,
    virt_type: 'kvm'
  }
})
const taskLoading = ref(false)
const taskError = ref('')
const taskSuccess = ref('')

onMounted(fetchAll)

async function fetchAll() {
  loading.value = true
  error.value = ''
  try {
    const [n, ipList] = await Promise.all([
      getHostNode(nodeID),
      listIPs(nodeID)
    ])
    node.value = n
    natEntryForm.value = n.nat_entry_host || ''
    slotsForm.value = n.total_slots || 0
    ips.value = ipList

    // Fetch products matching this node's location
    try {
      const allProducts = await listAllProducts()
      products.value = allProducts.filter(p => p.location === n.location)
    } catch (e) {
      console.error('Failed to load products for node', e)
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function handleAddIP() {
  ipError.value = ''
  ipLoading.value = true
  try {
    const newIP = await addIP(nodeID, {
      address: ipForm.value.address,
      version: ipForm.value.version
    })
    ips.value.push(newIP)
    ipForm.value = { address: '', version: 4 }
    showAddIP.value = false
  } catch (err) {
    ipError.value = err.message
  } finally {
    ipLoading.value = false
  }
}

async function handleEnqueueTask() {
  taskError.value = ''
  taskSuccess.value = ''
  taskLoading.value = true
  try {
    const task = await enqueueTask(nodeID, {
      type: taskForm.value.type,
      spec: {
        ...taskForm.value.spec,
        cpu: Number(taskForm.value.spec.cpu),
        memory_mb: Number(taskForm.value.spec.memory_mb),
        disk_gb: Number(taskForm.value.spec.disk_gb)
      }
    })
    taskSuccess.value = `Task ${task.id} queued successfully`
    taskForm.value.spec.instance_id = ''
    taskForm.value.spec.hostname = ''
  } catch (err) {
    taskError.value = err.message
  } finally {
    taskLoading.value = false
  }
}

const taskTypes = ['provision', 'deprovision', 'start', 'stop', 'reboot', 'suspend', 'unsuspend']

// -- Physical slots --
const slotsForm = ref(0)
const slotsLoading = ref(false)
const slotsError = ref('')
const slotsSuccess = ref('')

async function handleUpdateSlots() {
  slotsError.value = ''
  slotsSuccess.value = ''
  slotsLoading.value = true
  try {
    const nextSlots = Number(slotsForm.value)
    node.value = await updateHostNodeSlots(nodeID, Number.isFinite(nextSlots) ? nextSlots : 0)
    slotsForm.value = node.value.total_slots || 0
    slotsSuccess.value = 'Slots updated'
  } catch (err) {
    slotsError.value = err.message
  } finally {
    slotsLoading.value = false
  }
}

// -- NAT entry host --
const natEntryForm = ref('')
const natEntryLoading = ref(false)
const natEntryError = ref('')
const natEntrySuccess = ref('')

function beginEditNatEntryHost() {
  natEntryForm.value = liveNode.value?.nat_entry_host || ''
  natEntryError.value = ''
  natEntrySuccess.value = ''
}

async function handleUpdateNatEntryHost() {
  natEntryError.value = ''
  natEntrySuccess.value = ''
  natEntryLoading.value = true
  try {
    node.value = await updateHostNodeNatEntry(nodeID, String(natEntryForm.value || '').trim())
    natEntrySuccess.value = t('adminNodeDetail.natEntrySaved')
  } catch (err) {
    natEntryError.value = err.message
  } finally {
    natEntryLoading.value = false
  }
}

// -- Enable / Disable --
const toggleLoading = ref(false)

async function handleToggleEnabled() {
  toggleLoading.value = true
  try {
    const updated = liveNode.value?.enabled
      ? await disableHostNode(nodeID)
      : await enableHostNode(nodeID)
    node.value = updated
  } catch (err) {
    error.value = err.message
  } finally {
    toggleLoading.value = false
  }
}

// -- Bootstrap Token --
const showBtForm = ref(false)
const btLoading = ref(false)
const btError = ref('')
const btResult = ref(null)
const btTTL = ref(1440)

async function handleCreateBootstrapToken() {
  btError.value = ''
  btResult.value = null
  btLoading.value = true
  try {
    const bt = await createNodeBootstrapToken(nodeID, {
      ttl_minutes: btTTL.value,
      description: `Re-bootstrap for node ${liveNode.value?.code || nodeID}`
    })
    btResult.value = bt
  } catch (err) {
    btError.value = err.message
  } finally {
    btLoading.value = false
  }
}

function copyBootstrapToken() {
  if (btResult.value?.token) {
    navigator.clipboard.writeText(btResult.value.token)
  }
}

// -- Revoke Node Token --
const revokeLoading = ref(false)
const revokeSuccess = ref('')

async function handleRevokeNodeToken() {
  if (!confirm('Revoke the permanent node token? The agent will disconnect and need a new bootstrap token to reconnect.')) return
  revokeLoading.value = true
  revokeSuccess.value = ''
  try {
    await revokeNodeToken(nodeID)
    revokeSuccess.value = 'Node token revoked. Agent will be disconnected.'
    await fetchAll()
  } catch (err) {
    error.value = err.message
  } finally {
    revokeLoading.value = false
  }
}

function formatPrice(amount, currency) {
  return `${currency.toUpperCase()} ${(amount / 100).toFixed(2)}`
}

function formatCycle(cycle) {
  const map = { monthly: '/mo', quarterly: '/qtr', annually: '/yr' }
  return map[cycle] || `/${cycle}`
}

function formatNatPortRange(n) {
  if (!n?.nat_port_start || !n?.nat_port_end) return '—'
  return `${n.nat_port_start}-${n.nat_port_end}`
}

function goToProduct(id) {
  router.push(`/admin/products/${id}`)
}
</script>

<template>
  <AdminLayout>
    <div class="node-detail">
      <!-- Back button -->
      <button class="back-btn" @click="router.push('/admin/nodes')">{{ t('adminNodeDetail.backToNodes') }}</button>

      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>{{ t('adminNodeDetail.loadingNode') }}</span>
      </div>

      <div v-else-if="error" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn small-btn" @click="fetchAll">{{ t('common.retry') }}</button>
      </div>

      <template v-else-if="liveNode">
        <!-- Node Header -->
        <header class="node-header">
          <div>
            <h1 class="page-title">{{ liveNode.code }}</h1>
            <p class="page-subtitle">{{ liveNode.name }} — {{ liveNode.location }}</p>
          </div>
          <NodeStatusBadge :status="liveNode.status" />
        </header>

        <!-- Info Cards -->
        <div class="info-grid">
          <div class="info-card glass-card">
            <span class="info-label">{{ t('adminNodeDetail.ipAddress') }}</span>
            <span class="info-value mono">{{ liveNode.ip || '—' }}</span>
          </div>
          <div class="info-card glass-card">
            <span class="info-label">{{ t('adminNodeDetail.agentVersion') }}</span>
            <span class="info-value">{{ liveNode.agent_ver || '—' }}</span>
          </div>
          <div class="info-card glass-card">
            <span class="info-label">{{ t('adminNodeDetail.vmsRunning') }}</span>
            <span class="info-value">{{ liveNode.vm_count }}</span>
          </div>
          <div class="info-card glass-card">
            <span class="info-label">{{ t('adminNodeDetail.lastSeen') }}</span>
            <span class="info-value">{{ liveNode.last_seen_at ? formatDateTime(liveNode.last_seen_at) : '—' }}</span>
          </div>
        </div>

        <!-- Capacity & Node Management -->
        <section class="mgmt-section glass-card">
          <h2>{{ t('adminNodeDetail.capacityMgmt') }}</h2>
          <div class="mgmt-grid">
            <div class="mgmt-item">
              <span class="mgmt-label">{{ t('adminNodeDetail.totalSlots') }}</span>
              <span class="mgmt-value">{{ liveNode.total_slots }}</span>
            </div>
            <div class="mgmt-item">
              <span class="mgmt-label">{{ t('adminNodeDetail.usedSlots') }}</span>
              <span class="mgmt-value">{{ liveNode.used_slots }}</span>
            </div>
            <div class="mgmt-item">
              <span class="mgmt-label">{{ t('adminNodeDetail.availableSlots') }}</span>
              <span class="mgmt-value" :class="{ 'val-warn': liveNode.available_slots === 0 }">{{ liveNode.available_slots }}</span>
            </div>
            <div class="mgmt-item">
              <span class="mgmt-label">{{ t('adminNodeDetail.natBridge') }}</span>
              <span class="mgmt-value mono">{{ liveNode.nat_bridge || '-' }}</span>
            </div>
            <div class="mgmt-item">
              <span class="mgmt-label">{{ t('adminNodeDetail.natEntryHost') }}</span>
              <span class="mgmt-value mono">{{ liveNode.nat_entry_host || '-' }}</span>
            </div>
            <div class="mgmt-item">
              <span class="mgmt-label">{{ t('adminNodeDetail.natPortRange') }}</span>
              <span class="mgmt-value mono">{{ formatNatPortRange(liveNode) }}</span>
            </div>
            <div class="mgmt-item">
              <span class="mgmt-label">{{ t('adminNodeDetail.statusLabel') }}</span>
              <span class="mgmt-value">
                <span class="status-badge" :class="liveNode.enabled ? 'enabled' : 'disabled'">
                  {{ liveNode.enabled ? t('adminNodeDetail.enabled') : t('adminNodeDetail.disabled') }}
                </span>
              </span>
            </div>
          </div>

          <div class="inline-form slots-form">
            <div class="form-row">
              <label class="inline-label">{{ t('adminNodeDetail.totalSlots') }}</label>
              <input
                v-model.number="slotsForm"
                type="number"
                min="0"
                class="form-input compact-input"
              />
              <button
                class="action-btn primary-btn small-btn"
                :disabled="slotsLoading || slotsForm < liveNode.used_slots"
                @click="handleUpdateSlots"
              >
                {{ slotsLoading ? t('common.loading') : t('common.save') }}
              </button>
            </div>
            <p class="form-hint">Must be at least current used slots.</p>
            <p v-if="slotsError" class="form-error">{{ slotsError }}</p>
            <p v-if="slotsSuccess" class="form-success">{{ slotsSuccess }}</p>
          </div>

          <div class="inline-form nat-entry-form">
            <div class="form-row">
              <label class="inline-label">{{ t('adminNodeDetail.natEntryHost') }}</label>
              <input
                v-model="natEntryForm"
                type="text"
                class="form-input"
                placeholder="203.0.113.10"
                @focus="beginEditNatEntryHost"
              />
              <button class="action-btn primary-btn small-btn" :disabled="natEntryLoading" @click="handleUpdateNatEntryHost">
                {{ natEntryLoading ? t('common.loading') : t('common.save') }}
              </button>
            </div>
            <p class="form-hint">{{ t('adminNodeDetail.natEntryHint') }}</p>
            <p v-if="natEntryError" class="form-error">{{ natEntryError }}</p>
            <p v-if="natEntrySuccess" class="form-success">{{ natEntrySuccess }}</p>
          </div>

          <div class="mgmt-actions">
            <button
              class="action-btn small-btn"
              :class="liveNode.enabled ? 'danger-btn' : 'primary-btn'"
              :disabled="toggleLoading"
              @click="handleToggleEnabled"
            >
              {{ toggleLoading ? '...' : (liveNode.enabled ? t('adminNodeDetail.disableNode') : t('adminNodeDetail.enableNode')) }}
            </button>
            <button
              class="action-btn secondary-btn small-btn"
              :disabled="revokeLoading"
              @click="handleRevokeNodeToken"
            >
              {{ revokeLoading ? '...' : t('adminNodeDetail.revokeNodeToken') }}
            </button>
            <button
              class="action-btn accent-btn small-btn"
              @click="showBtForm = !showBtForm"
            >
              {{ showBtForm ? t('common.cancel') : t('adminNodeDetail.newBootstrapToken') }}
            </button>
          </div>

          <p v-if="revokeSuccess" class="form-success">{{ revokeSuccess }}</p>

          <!-- Bootstrap Token Form -->
          <div v-if="showBtForm" class="inline-form" style="margin-top: 1rem;">
            <div class="form-row">
              <label style="color: rgba(255,255,255,0.5); font-size: 0.8rem;">TTL</label>
              <select v-model.number="btTTL" class="form-select">
                <option :value="60">{{ t('adminCreateNode.ttl1h') }}</option>
                <option :value="360">{{ t('adminCreateNode.ttl6h') }}</option>
                <option :value="1440">{{ t('adminCreateNode.ttl24h') }}</option>
                <option :value="4320">{{ t('adminCreateNode.ttl3d') }}</option>
                <option :value="10080">{{ t('adminCreateNode.ttl7d') }}</option>
              </select>
              <button class="action-btn primary-btn small-btn" :disabled="btLoading" @click="handleCreateBootstrapToken">
                {{ btLoading ? t('adminNodeDetail.generating') : t('adminNodeDetail.generate') }}
              </button>
            </div>
            <p v-if="btError" class="form-error">{{ btError }}</p>
            <div v-if="btResult" class="bt-result">
              <p class="form-success">{{ t('adminNodeDetail.tokenCreated') }}</p>
              <div class="token-box">
                <code class="token-value">{{ btResult.token }}</code>
                <button type="button" class="action-btn secondary-btn small-btn" @click="copyBootstrapToken">{{ t('common.copy') }}</button>
              </div>
              <p class="bt-meta">{{ t('adminNodeDetail.expires', { time: formatDateTime(btResult.expires_at) }) }}</p>
              <div class="token-yaml-hint">
                <p class="hint-label">{{ t('adminNodeDetail.agentYamlExample') }}</p>
                <pre class="yaml-block">bootstrap_token: "{{ btResult.token }}"
grpc_address: "controller:50051"
credential_file: "node-credential.yaml"</pre>
              </div>
            </div>
          </div>
        </section>

        <!-- Usage -->
        <section class="usage-section glass-card">
          <h2>{{ t('adminNodeDetail.resourceUsage') }}</h2>
          <div class="usage-bars">
            <div class="usage-row">
              <span class="usage-label">{{ t('adminNodeDetail.cpu') }}</span>
              <div class="bar-track"><div class="bar-fill cpu-fill" :style="{ width: `${liveNode.cpu_usage}%` }"></div></div>
              <span class="usage-val">{{ formatPercent(liveNode.cpu_usage) }}</span>
            </div>
            <div class="usage-row">
              <span class="usage-label">{{ t('adminNodeDetail.memory') }}</span>
              <div class="bar-track"><div class="bar-fill mem-fill" :style="{ width: `${liveNode.mem_usage}%` }"></div></div>
              <span class="usage-val">{{ formatPercent(liveNode.mem_usage) }}</span>
            </div>
            <div class="usage-row">
              <span class="usage-label">{{ t('adminNodeDetail.disk') }}</span>
              <div class="bar-track"><div class="bar-fill disk-fill" :style="{ width: `${liveNode.disk_usage}%` }"></div></div>
              <span class="usage-val">{{ formatPercent(liveNode.disk_usage) }}</span>
            </div>
          </div>
        </section>

        <!-- IP Pool -->
        <section class="ips-section glass-card">
          <div class="section-header">
            <h2>{{ t('adminNodeDetail.ipPool', { count: ips.length }) }}</h2>
            <button class="action-btn accent-btn small-btn" @click="showAddIP = !showAddIP">
              {{ showAddIP ? t('common.cancel') : t('adminNodeDetail.addIP') }}
            </button>
          </div>

          <!-- Add IP Form -->
          <div v-if="showAddIP" class="inline-form">
            <div class="form-row">
              <input v-model="ipForm.address" type="text" placeholder="e.g. 185.1.2.3" class="form-input" />
              <select v-model.number="ipForm.version" class="form-select">
                <option :value="4">IPv4</option>
                <option :value="6">IPv6</option>
              </select>
              <button class="action-btn primary-btn small-btn" :disabled="ipLoading || !ipForm.address" @click="handleAddIP">
                {{ ipLoading ? t('adminNodeDetail.adding') : t('common.create') }}
              </button>
            </div>
            <p v-if="ipError" class="form-error">{{ ipError }}</p>
          </div>

          <div v-if="ips.length === 0" class="empty-inline">{{ t('adminNodeDetail.noIPs') }}</div>

          <table v-else class="ips-table">
            <thead>
              <tr>
                <th>{{ t('adminNodeDetail.address') }}</th>
                <th>{{ t('adminNodeDetail.version') }}</th>
                <th>{{ t('adminNodeDetail.ipStatus') }}</th>
                <th>{{ t('adminNodeDetail.instance') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ip in ips" :key="ip.id">
                <td class="mono">{{ ip.address }}</td>
                <td>IPv{{ ip.version }}</td>
                <td>
                  <span class="ip-status" :class="ip.available ? 'avail' : 'assigned'">
                    {{ ip.available ? t('adminNodeDetail.available') : t('adminNodeDetail.assigned') }}
                  </span>
                </td>
                <td class="mono">{{ ip.instance_id || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </section>

      </template>
    </div>
  </AdminLayout>
</template>

<style scoped>
.node-detail {
  max-width: 1100px;
  margin: 0 auto;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  margin-bottom: 1rem;
  transition: color 0.2s;
}
.back-btn:hover { color: var(--text-primary); }

.node-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.page-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  font-family: monospace;
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

/* Info grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.info-card {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.info-value {
  font-size: 1.1rem;
  color: var(--text-primary);
  font-weight: 600;
}
.mono { font-family: monospace; }

/* Usage */
.usage-section {
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}
.usage-section h2 { margin: 0 0 1rem; font-size: 1.1rem; color: var(--text-primary); }

.usage-bars { display: flex; flex-direction: column; gap: 0.75rem; }

.usage-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.usage-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  width: 60px;
}

.bar-track {
  flex: 1;
  height: 8px;
  background: var(--bg-input);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.cpu-fill { background: linear-gradient(90deg, #6366f1, #818cf8); }
.mem-fill { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
.disk-fill { background: linear-gradient(90deg, #f59e0b, #fbbf24); }

.usage-val {
  font-size: 0.85rem;
  color: var(--text-secondary);
  width: 55px;
  text-align: right;
  font-family: monospace;
}

/* Sections */
.ips-section, .task-section {
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

/* Management section */
.mgmt-section {
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}
.mgmt-section h2 { margin: 0 0 1rem; font-size: 1.1rem; color: var(--text-primary); }

.mgmt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.mgmt-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.mgmt-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.mgmt-value {
  font-size: 1.25rem;
  color: var(--text-primary);
  font-weight: 700;
}
.mgmt-value.val-warn { color: var(--danger); }

.mgmt-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.danger-btn {
  background: var(--danger-bg) !important;
  border-color: var(--danger-border) !important;
  color: #f87171 !important;
}
.danger-btn:hover {
  background: var(--danger-bg) !important;
}

.bt-result {
  margin-top: 0.75rem;
}

.token-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
  padding: 0.6rem 0.85rem;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 8px;
}

.token-value {
  flex: 1;
  font-family: monospace;
  font-size: 0.78rem;
  color: var(--text-primary);
  word-break: break-all;
}

.bt-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0.25rem 0 0;
}

.token-yaml-hint {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 8px;
}

.hint-label {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.yaml-block {
  margin: 0;
  padding: 0.5rem;
  background: var(--bg-code);
  border-radius: 6px;
  font-size: 0.78rem;
  color: var(--text-primary);
  overflow-x: auto;
  line-height: 1.5;
}

.status-badge {
  display: inline-flex;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.status-badge.enabled {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}
.status-badge.disabled {
  background: var(--bg-card);
  color: var(--text-muted);
  border: 1px solid var(--border-default);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.section-header h2 { margin: 0; font-size: 1.1rem; color: var(--text-primary); }

/* Inline form */
.inline-form {
  margin-bottom: 1rem;
  padding: 1rem;
  background: var(--bg-card);
  border-radius: 10px;
  border: 1px solid var(--border-default);
}

.form-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.inline-label {
  color: var(--text-muted);
  font-size: 0.8rem;
  min-width: 90px;
}

.nat-entry-form {
  margin-top: 1rem;
}

.slots-form {
  margin-top: 1rem;
}

.compact-input {
  width: 120px;
}

.nat-entry-form .form-input {
  min-width: min(100%, 280px);
  flex: 1;
}

.form-input, .form-select {
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  color: var(--text-primary);
}
.form-input:focus, .form-select:focus {
  outline: none;
  border-color: var(--accent-border);
}
.form-select {
  appearance: none;
  cursor: pointer;
}

.form-error {
  margin: 0.5rem 0 0;
  color: var(--danger);
  font-size: 0.8rem;
}
.form-success {
  margin: 0.5rem 0 0;
  color: var(--success);
  font-size: 0.8rem;
}

.form-hint {
  margin: 0.5rem 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.empty-inline {
  padding: 1.5rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
}

/* IP Table */
.ips-table {
  width: 100%;
  border-collapse: collapse;
}
.ips-table th {
  text-align: left;
  padding: 0.6rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--divider);
}
.ips-table td {
  padding: 0.65rem 0.75rem;
  font-size: 0.85rem;
  color: var(--text-primary);
  border-bottom: 1px solid var(--divider);
}

.ip-status {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}
.avail {
  background: var(--success-bg);
  color: var(--success);
}
.assigned {
  background: var(--warning-bg);
  color: var(--warning);
}

/* Task form */
.task-form {
  padding: 1rem;
  background: var(--bg-card);
  border-radius: 10px;
  border: 1px solid var(--border-default);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.form-group label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
}

/* Loading / Error */
.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-secondary);
}

.spinner {
  width: 24px; height: 24px;
  border: 2px solid var(--border-default);
  border-top: 2px solid #f87171;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Products Section */
.products-section {
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.node-product-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.75rem;
}

.node-product-card {
  padding: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.node-product-card:hover {
  border-color: var(--text-muted);
  background: var(--bg-card);
  transform: translateY(-1px);
}

.np-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.6rem;
}

.np-name-col { display: flex; flex-direction: column; gap: 0.1rem; }
.np-name { font-weight: 700; color: var(--text-primary); font-size: 0.95rem; }
.np-slug { font-size: 0.72rem; color: var(--text-muted); font-family: monospace; }


.np-specs {
  display: flex;
  gap: 0.6rem;
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-bottom: 0.6rem;
}

.np-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px solid var(--divider);
}

.np-price {
  font-size: 0.9rem;
  font-weight: 700;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.np-stock {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.np-stock-avail {
  font-weight: 700;
  color: var(--success);
}
</style>
