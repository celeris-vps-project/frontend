<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import StatusBadge from '../components/StatusBadge.vue'
import {
  getInstance, startInstance, stopInstance, suspendInstance,
  unsuspendInstance, terminateInstance, formatDate, formatDateTime
} from '../api/billing.js'

const route = useRoute()
const router = useRouter()
const instance = ref(null)
const loading = ref(true)
const error = ref('')
const actionLoading = ref('')
const actionError = ref('')
const actionSuccess = ref('')
const showTerminateConfirm = ref(false)
let pollTimer = null

onMounted(fetchInstance)
onUnmounted(stopPolling)

// Auto-poll: when instance is "pending", refresh every 10s until it changes
const isPending = computed(() => instance.value?.status === 'pending')
watch(isPending, (pending) => {
  if (pending) startPolling()
  else stopPolling()
})

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    try { instance.value = await getInstance(route.params.id) }
    catch { /* silent */ }
  }, 10000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

async function fetchInstance() {
  loading.value = true; error.value = ''
  try { instance.value = await getInstance(route.params.id) }
  catch (err) { error.value = err.message }
  finally { loading.value = false }
}

async function doAction(actionFn, label) {
  actionLoading.value = label; actionError.value = ''; actionSuccess.value = ''
  try {
    instance.value = await actionFn(route.params.id)
    actionSuccess.value = `${label} successful`
    showTerminateConfirm.value = false
  } catch (err) { actionError.value = err.message }
  finally { actionLoading.value = '' }
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
      <button class="back-btn" @click="router.push('/instances')">← 返回实例列表</button>

      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div><span>加载实例中...</span>
      </div>

      <div v-else-if="error" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn small-btn" @click="fetchInstance">重试</button>
      </div>

      <template v-else-if="instance">
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

        <div v-if="actionError" class="notification notification-error glass-card" @click="actionError = ''">{{ actionError }}</div>
        <div v-if="actionSuccess" class="notification notification-success glass-card" @click="actionSuccess = ''">{{ actionSuccess }}</div>

        <div class="detail-grid">
          <div class="detail-main">
            <div class="config-section glass-card">
              <h2>配置信息</h2>
              <div class="config-grid">
                <div class="config-item">
                  <div class="config-icon-wrap"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
                  <div class="config-detail"><span class="config-label">套餐</span><span class="config-value">{{ instance.plan }}</span></div>
                </div>
                <div class="config-item">
                  <div class="config-icon-wrap"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div>
                  <div class="config-detail"><span class="config-label">规格</span><span class="config-value">{{ specLabel(instance) }}</span></div>
                </div>
                <div class="config-item">
                  <div class="config-icon-wrap"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
                  <div class="config-detail"><span class="config-label">操作系统</span><span class="config-value">{{ instance.os }}</span></div>
                </div>
                <div class="config-item">
                  <div class="config-icon-wrap"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg></div>
                  <div class="config-detail"><span class="config-label">主机名</span><span class="config-value mono">{{ instance.hostname }}</span></div>
                </div>
              </div>
            </div>

            <!-- Provisioning Progress Banner -->
            <div v-if="instance.status === 'pending'" class="provisioning-banner glass-card">
              <div class="provisioning-icon">
                <div class="spinner-sm"></div>
              </div>
              <div class="provisioning-text">
                <strong>VM 正在创建中</strong>
                <p>正在克隆模板、配置网络和启动虚拟机，预计需要 1-5 分钟。页面将自动刷新。</p>
              </div>
            </div>

            <div class="config-section glass-card">
              <h2>网络</h2>
              <div class="config-grid">
                <div class="config-item">
                  <div class="config-icon-wrap success"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
                  <div class="config-detail"><span class="config-label">IPv4</span><span class="config-value mono">{{ instance.ipv4 || '未分配' }}</span></div>
                </div>
                <div class="config-item">
                  <div class="config-icon-wrap info"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
                  <div class="config-detail"><span class="config-label">IPv6</span><span class="config-value mono">{{ instance.ipv6 || '未分配' }}</span></div>
                </div>
                <div class="config-item">
                  <div class="config-icon-wrap" :class="instance.network_mode === 'nat' ? 'nat' : ''">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3-3m0 0l3 3m-3-3v8"/><circle cx="12" cy="12" r="10"/></svg>
                  </div>
                  <div class="config-detail">
                    <span class="config-label">网络模式</span>
                    <span class="config-value">{{ instance.network_mode === 'nat' ? 'NAT 共享' : '独立 IP' }}</span>
                  </div>
                </div>
                <div v-if="instance.network_mode === 'nat' && instance.nat_port" class="config-item">
                  <div class="config-icon-wrap nat">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                  </div>
                  <div class="config-detail">
                    <span class="config-label">NAT SSH 端口</span>
                    <span class="config-value mono">:{{ instance.nat_port }}</span>
                  </div>
                </div>
              </div>

              <!-- SSH Connection Command (shown when instance is running with IP) -->
              <div v-if="instance.ipv4 && instance.status === 'running'" class="ssh-command-box">
                <span class="ssh-label">SSH 连接命令</span>
                <code v-if="instance.network_mode === 'nat' && instance.nat_port" class="ssh-cmd">ssh root@{{ instance.ipv4 }} -p {{ instance.nat_port }}</code>
                <code v-else class="ssh-cmd">ssh root@{{ instance.ipv4 }}</code>
              </div>
            </div>

            <div class="config-section glass-card">
              <h2>时间线</h2>
              <div class="timeline">
                <div class="timeline-item"><div class="tl-dot"></div><div class="tl-row"><span class="tl-label">创建</span><span class="tl-value">{{ formatDateTime(instance.created_at) }}</span></div></div>
                <div v-if="instance.started_at" class="timeline-item"><div class="tl-dot running"></div><div class="tl-row"><span class="tl-label">启动</span><span class="tl-value">{{ formatDateTime(instance.started_at) }}</span></div></div>
                <div v-if="instance.stopped_at" class="timeline-item"><div class="tl-dot stopped"></div><div class="tl-row"><span class="tl-label">停止</span><span class="tl-value">{{ formatDateTime(instance.stopped_at) }}</span></div></div>
                <div v-if="instance.suspended_at" class="timeline-item"><div class="tl-dot suspended"></div><div class="tl-row"><span class="tl-label">暂停</span><span class="tl-value">{{ formatDateTime(instance.suspended_at) }}</span></div></div>
                <div v-if="instance.terminated_at" class="timeline-item"><div class="tl-dot terminated"></div><div class="tl-row"><span class="tl-label">终止</span><span class="tl-value">{{ formatDateTime(instance.terminated_at) }}</span></div></div>
              </div>
            </div>
          </div>

          <div class="detail-sidebar">
            <div class="actions-card glass-card">
              <h3>电源控制</h3>
              <div class="power-btns">
                <button v-if="canStart" class="action-btn success-btn" :disabled="actionLoading !== ''" @click="doAction(startInstance, 'Start')">
                  {{ actionLoading === 'Start' ? '启动中...' : '▶ 启动' }}
                </button>
                <button v-if="canStop" class="action-btn warning-btn" :disabled="actionLoading !== ''" @click="doAction(stopInstance, 'Stop')">
                  {{ actionLoading === 'Stop' ? '停止中...' : '■ 停止' }}
                </button>
                <button v-if="canUnsuspend" class="action-btn success-btn" :disabled="actionLoading !== ''" @click="doAction(unsuspendInstance, 'Unsuspend')">
                  {{ actionLoading === 'Unsuspend' ? '恢复中...' : '↻ 恢复' }}
                </button>
              </div>

              <div v-if="canTerminate" class="terminate-section">
                <button class="action-btn danger-btn" @click="showTerminateConfirm = !showTerminateConfirm">⚠ 终止实例</button>
                <div v-if="showTerminateConfirm" class="confirm-box">
                  <p class="confirm-text">此操作不可逆。实例将被永久销毁。</p>
                  <button class="action-btn danger-btn small-btn" :disabled="actionLoading !== ''" @click="doAction(terminateInstance, 'Terminate')">
                    {{ actionLoading === 'Terminate' ? '终止中...' : '确认终止' }}
                  </button>
                </div>
              </div>

              <p v-if="instance.status === 'running'" class="status-note" style="color: var(--success)">✓ 实例运行中</p>
              <p v-if="instance.status === 'stopped'" class="status-note" style="color: var(--info)">■ 实例已停止</p>
              <p v-if="instance.status === 'pending'" class="status-note" style="color: var(--warning)">⧖ 实例正在配置中</p>
              <p v-if="instance.status === 'suspended'" class="status-note" style="color: var(--warning)">⚠ 实例已暂停</p>
              <p v-if="instance.status === 'terminated'" class="status-note">实例已终止</p>
            </div>

            <div class="info-card glass-card">
              <h3>详情</h3>
              <dl class="detail-list">
                <div class="dl-row"><dt>实例 ID</dt><dd class="mono">{{ instance.id }}</dd></div>
                <div class="dl-row"><dt>订单 ID</dt><dd class="mono">{{ instance.order_id.slice(0, 12) }}…</dd></div>
                <div class="dl-row"><dt>节点 ID</dt><dd class="mono">{{ instance.node_id.slice(0, 12) }}…</dd></div>
                <div class="dl-row"><dt>状态</dt><dd><StatusBadge :status="instance.status" /></dd></div>
              </dl>
            </div>
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<style scoped>
.detail-page { max-width: 1100px; margin: 0 auto; }

.back-btn {
  background: none; border: none; color: var(--text-muted);
  cursor: pointer; font-size: 0.85rem; padding: 0;
  margin-bottom: 1.25rem; transition: color 0.2s;
}
.back-btn:hover { color: var(--accent); }

.detail-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;
}

.detail-title-row { display: flex; align-items: center; gap: 0.75rem; }

.page-title { margin: 0; font-size: 1.6rem; font-weight: 700; color: var(--text-primary); }
.page-subtitle { margin: 0.25rem 0 0; color: var(--text-secondary); font-size: 0.88rem; }
.mono { font-family: 'SF Mono', 'Fira Code', monospace; }

.meta-plan {
  font-size: 0.88rem; padding: 0.3rem 0.8rem; border-radius: 8px;
  background: var(--accent-bg); border: 1px solid var(--accent-border);
  color: var(--accent); font-weight: 600;
}

.notification {
  padding: 0.75rem 1rem; margin-bottom: 1rem; border-radius: 12px;
  font-size: 0.85rem; cursor: pointer;
}
.notification-error { border-left: 3px solid var(--danger); color: var(--danger); }
.notification-success { border-left: 3px solid var(--success); color: var(--success); }

.detail-grid {
  display: grid; grid-template-columns: 1fr 320px; gap: 1.5rem; align-items: start;
}
@media (max-width: 900px) { .detail-grid { grid-template-columns: 1fr; } }

.config-section { padding: 1.5rem; margin-bottom: 1.25rem; }
.config-section h2 { margin: 0 0 1.25rem; font-size: 1.05rem; font-weight: 600; color: var(--text-primary); }

.config-grid { display: flex; flex-direction: column; gap: 0.6rem; }

.config-item {
  display: flex; align-items: center; gap: 0.85rem; padding: 0.7rem;
  background: var(--bg-code); border: 1px solid var(--border-subtle); border-radius: 12px;
}

.config-icon-wrap {
  width: 38px; height: 38px; border-radius: 10px; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0;
  background: var(--accent-bg); color: var(--accent);
  border: 1px solid var(--accent-border);
}
.config-icon-wrap.success { background: var(--success-bg); color: var(--success); border-color: var(--success-border); }
.config-icon-wrap.info { background: var(--info-bg); color: var(--info); border-color: var(--info-border); }
.config-icon-wrap.nat { background: rgba(168, 85, 247, 0.08); color: #a855f7; border-color: rgba(168, 85, 247, 0.2); }

.config-detail { display: flex; flex-direction: column; gap: 0.05rem; }
.config-label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.config-value { font-size: 0.88rem; color: var(--text-primary); font-weight: 500; }

.timeline { display: flex; flex-direction: column; position: relative; padding-left: 1.5rem; }
.timeline::before {
  content: ''; position: absolute; left: 6px; top: 6px; bottom: 6px;
  width: 2px; background: var(--divider);
}
.timeline-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0; position: relative; }
.tl-dot {
  width: 12px; height: 12px; border-radius: 50%; position: absolute;
  left: -1.5rem; top: 50%; transform: translateY(-50%);
  background: var(--text-muted);
}
.tl-dot.running { background: var(--success); }
.tl-dot.stopped { background: var(--info); }
.tl-dot.suspended { background: var(--warning); }
.tl-dot.terminated { background: var(--danger); }
.tl-row { display: flex; justify-content: space-between; align-items: center; width: 100%; }
.tl-label { font-size: 0.85rem; color: var(--text-secondary); }
.tl-value { font-size: 0.85rem; color: var(--text-primary); font-weight: 500; }

.detail-sidebar { display: flex; flex-direction: column; gap: 1rem; }
.actions-card { padding: 1.25rem; }
.actions-card h3 { margin: 0 0 1rem; font-size: 1rem; font-weight: 600; color: var(--text-primary); }
.power-btns { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; }

.terminate-section { border-top: 1px solid var(--divider); padding-top: 0.75rem; margin-top: 0.25rem; }
.confirm-box {
  margin-top: 0.5rem; padding: 0.75rem;
  background: var(--danger-bg); border: 1px solid var(--danger-border); border-radius: 10px;
}
.confirm-text { font-size: 0.8rem; color: var(--danger); margin: 0 0 0.5rem; }

.status-note { color: var(--text-muted); font-size: 0.85rem; margin: 0.5rem 0 0; }

.info-card { padding: 1.25rem; }
.info-card h3 { margin: 0 0 1rem; font-size: 1rem; font-weight: 600; color: var(--text-primary); }
.detail-list { margin: 0; }
.dl-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle);
}
.dl-row:last-child { border-bottom: none; }
.dl-row dt { font-size: 0.8rem; color: var(--text-muted); }
.dl-row dd { margin: 0; font-size: 0.82rem; color: var(--text-primary); text-align: right; max-width: 60%; word-break: break-all; }

/* Provisioning banner */
.provisioning-banner {
  display: flex; align-items: center; gap: 1rem;
  padding: 1.25rem; margin-bottom: 1.25rem;
  border-left: 3px solid var(--warning);
  animation: pulse-banner 2s ease-in-out infinite;
}

@keyframes pulse-banner {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.provisioning-icon { flex-shrink: 0; }

.spinner-sm {
  width: 24px; height: 24px;
  border: 3px solid var(--border-default);
  border-top-color: var(--warning);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.provisioning-text strong {
  display: block; font-size: 0.95rem; color: var(--warning); margin-bottom: 0.25rem;
}

.provisioning-text p {
  margin: 0; font-size: 0.8rem; color: var(--text-muted); line-height: 1.5;
}

/* SSH command box */
.ssh-command-box {
  margin-top: 1rem; padding: 0.85rem 1rem;
  background: var(--bg-code); border: 1px solid var(--border-subtle);
  border-radius: 10px; display: flex; flex-direction: column; gap: 0.35rem;
}

.ssh-label {
  font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ssh-cmd {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.85rem; color: var(--success); font-weight: 500;
  user-select: all; cursor: text;
}

.loading-state, .error-state {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.75rem; padding: 3rem; color: var(--text-muted);
}

.spinner {
  width: 28px; height: 28px; border: 3px solid var(--border-default);
  border-top-color: var(--spinner-color); border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
