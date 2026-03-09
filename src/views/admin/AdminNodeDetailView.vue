<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
  revokeNodeToken,
  createNodeBootstrapToken,
  formatPercent,
  formatDateTime
} from '../../api/admin'
import { useNodeStatusWS } from '../../api/ws'

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

function goToProduct(id) {
  router.push(`/admin/products/${id}`)
}
</script>

<template>
  <AdminLayout>
    <div class="node-detail">
      <!-- Back button -->
      <button class="back-btn" @click="router.push('/admin/nodes')">← Back to Nodes</button>

      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>Loading node details...</span>
      </div>

      <div v-else-if="error" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn small-btn" @click="fetchAll">Retry</button>
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
            <span class="info-label">IP Address</span>
            <span class="info-value mono">{{ liveNode.ip || '—' }}</span>
          </div>
          <div class="info-card glass-card">
            <span class="info-label">Agent Version</span>
            <span class="info-value">{{ liveNode.agent_ver || '—' }}</span>
          </div>
          <div class="info-card glass-card">
            <span class="info-label">VMs Running</span>
            <span class="info-value">{{ liveNode.vm_count }}</span>
          </div>
          <div class="info-card glass-card">
            <span class="info-label">Last Seen</span>
            <span class="info-value">{{ liveNode.last_seen_at ? formatDateTime(liveNode.last_seen_at) : '—' }}</span>
          </div>
        </div>

        <!-- Capacity & Node Management -->
        <section class="mgmt-section glass-card">
          <h2>Capacity & Management</h2>
          <div class="mgmt-grid">
            <div class="mgmt-item">
              <span class="mgmt-label">Total Slots</span>
              <span class="mgmt-value">{{ liveNode.total_slots }}</span>
            </div>
            <div class="mgmt-item">
              <span class="mgmt-label">Used Slots</span>
              <span class="mgmt-value">{{ liveNode.used_slots }}</span>
            </div>
            <div class="mgmt-item">
              <span class="mgmt-label">Available Slots</span>
              <span class="mgmt-value" :class="{ 'val-warn': liveNode.available_slots === 0 }">{{ liveNode.available_slots }}</span>
            </div>
            <div class="mgmt-item">
              <span class="mgmt-label">Status</span>
              <span class="mgmt-value">
                <span class="status-badge" :class="liveNode.enabled ? 'enabled' : 'disabled'">
                  {{ liveNode.enabled ? 'Enabled' : 'Disabled' }}
                </span>
              </span>
            </div>
          </div>

          <div class="mgmt-actions">
            <button
              class="action-btn small-btn"
              :class="liveNode.enabled ? 'danger-btn' : 'primary-btn'"
              :disabled="toggleLoading"
              @click="handleToggleEnabled"
            >
              {{ toggleLoading ? '...' : (liveNode.enabled ? 'Disable Node' : 'Enable Node') }}
            </button>
            <button
              class="action-btn secondary-btn small-btn"
              :disabled="revokeLoading"
              @click="handleRevokeNodeToken"
            >
              {{ revokeLoading ? '...' : 'Revoke Node Token' }}
            </button>
            <button
              class="action-btn accent-btn small-btn"
              @click="showBtForm = !showBtForm"
            >
              {{ showBtForm ? 'Cancel' : 'New Bootstrap Token' }}
            </button>
          </div>

          <p v-if="revokeSuccess" class="form-success">{{ revokeSuccess }}</p>

          <!-- Bootstrap Token Form -->
          <div v-if="showBtForm" class="inline-form" style="margin-top: 1rem;">
            <div class="form-row">
              <label style="color: rgba(255,255,255,0.5); font-size: 0.8rem;">TTL</label>
              <select v-model.number="btTTL" class="form-select">
                <option :value="60">1 hour</option>
                <option :value="360">6 hours</option>
                <option :value="1440">24 hours</option>
                <option :value="4320">3 days</option>
                <option :value="10080">7 days</option>
              </select>
              <button class="action-btn primary-btn small-btn" :disabled="btLoading" @click="handleCreateBootstrapToken">
                {{ btLoading ? 'Generating...' : 'Generate' }}
              </button>
            </div>
            <p v-if="btError" class="form-error">{{ btError }}</p>
            <div v-if="btResult" class="bt-result">
              <p class="form-success">Bootstrap token created. Copy it now — it will not be shown again.</p>
              <div class="token-box">
                <code class="token-value">{{ btResult.token }}</code>
                <button type="button" class="action-btn secondary-btn small-btn" @click="copyBootstrapToken">Copy</button>
              </div>
              <p class="bt-meta">Expires: {{ formatDateTime(btResult.expires_at) }}</p>
              <div class="token-yaml-hint">
                <p class="hint-label">agent.yaml:</p>
                <pre class="yaml-block">bootstrap_token: "{{ btResult.token }}"
grpc_address: "controller:50051"
credential_file: "node-credential.yaml"</pre>
              </div>
            </div>
          </div>
        </section>

        <!-- Usage -->
        <section class="usage-section glass-card">
          <h2>Resource Usage</h2>
          <div class="usage-bars">
            <div class="usage-row">
              <span class="usage-label">CPU</span>
              <div class="bar-track"><div class="bar-fill cpu-fill" :style="{ width: `${liveNode.cpu_usage}%` }"></div></div>
              <span class="usage-val">{{ formatPercent(liveNode.cpu_usage) }}</span>
            </div>
            <div class="usage-row">
              <span class="usage-label">Memory</span>
              <div class="bar-track"><div class="bar-fill mem-fill" :style="{ width: `${liveNode.mem_usage}%` }"></div></div>
              <span class="usage-val">{{ formatPercent(liveNode.mem_usage) }}</span>
            </div>
            <div class="usage-row">
              <span class="usage-label">Disk</span>
              <div class="bar-track"><div class="bar-fill disk-fill" :style="{ width: `${liveNode.disk_usage}%` }"></div></div>
              <span class="usage-val">{{ formatPercent(liveNode.disk_usage) }}</span>
            </div>
          </div>
        </section>

        <!-- IP Pool -->
        <section class="ips-section glass-card">
          <div class="section-header">
            <h2>IP Pool ({{ ips.length }})</h2>
            <button class="action-btn accent-btn small-btn" @click="showAddIP = !showAddIP">
              {{ showAddIP ? 'Cancel' : '+ Add IP' }}
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
                {{ ipLoading ? 'Adding...' : 'Add' }}
              </button>
            </div>
            <p v-if="ipError" class="form-error">{{ ipError }}</p>
          </div>

          <div v-if="ips.length === 0" class="empty-inline">No IPs assigned to this node.</div>

          <table v-else class="ips-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>Version</th>
                <th>Status</th>
                <th>Instance</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ip in ips" :key="ip.id">
                <td class="mono">{{ ip.address }}</td>
                <td>IPv{{ ip.version }}</td>
                <td>
                  <span class="ip-status" :class="ip.available ? 'avail' : 'assigned'">
                    {{ ip.available ? 'Available' : 'Assigned' }}
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
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  margin-bottom: 1rem;
  transition: color 0.2s;
}
.back-btn:hover { color: #fff; }

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
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.info-value {
  font-size: 1.1rem;
  color: #fff;
  font-weight: 600;
}
.mono { font-family: monospace; }

/* Usage */
.usage-section {
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}
.usage-section h2 { margin: 0 0 1rem; font-size: 1.1rem; color: #fff; }

.usage-bars { display: flex; flex-direction: column; gap: 0.75rem; }

.usage-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.usage-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  width: 60px;
}

.bar-track {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.06);
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
  color: rgba(255, 255, 255, 0.6);
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
.mgmt-section h2 { margin: 0 0 1rem; font-size: 1.1rem; color: #fff; }

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
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.mgmt-value {
  font-size: 1.25rem;
  color: #fff;
  font-weight: 700;
}
.mgmt-value.val-warn { color: #f87171; }

.mgmt-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.danger-btn {
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: rgba(239, 68, 68, 0.3) !important;
  color: #f87171 !important;
}
.danger-btn:hover {
  background: rgba(239, 68, 68, 0.25) !important;
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
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.token-value {
  flex: 1;
  font-family: monospace;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.85);
  word-break: break-all;
}

.bt-meta {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  margin: 0.25rem 0 0;
}

.token-yaml-hint {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.hint-label {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

.yaml-block {
  margin: 0;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.7);
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
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.2);
}
.status-badge.disabled {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.section-header h2 { margin: 0; font-size: 1.1rem; color: #fff; }

/* Inline form */
.inline-form {
  margin-bottom: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.form-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.form-input, .form-select {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  color: #fff;
}
.form-input:focus, .form-select:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.5);
}
.form-select {
  appearance: none;
  cursor: pointer;
}

.form-error {
  margin: 0.5rem 0 0;
  color: #f87171;
  font-size: 0.8rem;
}
.form-success {
  margin: 0.5rem 0 0;
  color: #4ade80;
  font-size: 0.8rem;
}

.empty-inline {
  padding: 1.5rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
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
  color: rgba(255, 255, 255, 0.4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.ips-table td {
  padding: 0.65rem 0.75rem;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
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
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
}
.assigned {
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
}

/* Task form */
.task-form {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
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
  color: rgba(255, 255, 255, 0.5);
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
  color: rgba(255, 255, 255, 0.5);
}

.spinner {
  width: 24px; height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.1);
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
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.node-product-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-1px);
}

.np-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.6rem;
}

.np-name-col { display: flex; flex-direction: column; gap: 0.1rem; }
.np-name { font-weight: 700; color: #fff; font-size: 0.95rem; }
.np-slug { font-size: 0.72rem; color: rgba(255, 255, 255, 0.4); font-family: monospace; }


.np-specs {
  display: flex;
  gap: 0.6rem;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 0.6rem;
}

.np-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.np-price {
  font-size: 0.9rem;
  font-weight: 700;
  background: linear-gradient(135deg, #f87171, #fb923c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.np-stock {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.45);
}

.np-stock-avail {
  font-weight: 700;
  color: #4ade80;
}
</style>
