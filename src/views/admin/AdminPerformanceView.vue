<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import AdminLayout from '../../components/AdminLayout.vue'
import { usePerformanceWS } from '../../api/performance.js'

Chart.register(...registerables)

// ── Color palette (Grafana-inspired) ──
const COLORS = [
  { line: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)', label: 'Indigo' },
  { line: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', label: 'Amber' },
  { line: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', label: 'Emerald' },
  { line: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'Red' },
  { line: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', label: 'Violet' },
]

// ── WebSocket connection ──
const { snapshot, history, connected, sendInterval } = usePerformanceWS(120)

// ── Admin controls ──
const interval = ref(2)
const intervalOptions = [1, 2, 3, 5, 10]

function changeInterval(val) {
  interval.value = val
  sendInterval(val)
}

// ── Computed data ──
const totalQPS = computed(() => snapshot.value?.total_qps?.toFixed(1) || '0.0')
const mitigatedCount = computed(() => snapshot.value?.mitigated_count || 0)
const normalCount = computed(() => snapshot.value?.normal_count || 0)
const mitigatedPct = computed(() => snapshot.value?.mitigated_pct?.toFixed(1) || '0.0')
const topEndpoints = computed(() => snapshot.value?.top_endpoints || [])

const maxQPS = computed(() => {
  if (!topEndpoints.value.length) return 1
  return Math.max(...topEndpoints.value.map(e => e.qps), 1)
})

// Track which endpoint keys we've seen (for consistent color assignment)
const endpointColorMap = ref({})
let colorIndex = 0

function getEndpointColor(key) {
  if (!endpointColorMap.value[key]) {
    endpointColorMap.value[key] = COLORS[colorIndex % COLORS.length]
    colorIndex++
  }
  return endpointColorMap.value[key]
}

function shortPath(path) {
  return path.replace('/api/v1/', '/')
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Charts ──
const pieCanvasRef = ref(null)
const lineCanvasRef = ref(null)
const mitigationCanvasRef = ref(null)
let pieChart = null
let lineChart = null
let mitigationChart = null

onMounted(() => {
  nextTick(() => {
    initPieChart()
    initLineChart()
    initMitigationChart()
  })
})

onUnmounted(() => {
  pieChart?.destroy()
  lineChart?.destroy()
  mitigationChart?.destroy()
})

function initPieChart() {
  if (!pieCanvasRef.value) return
  pieChart = new Chart(pieCanvasRef.value, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: COLORS.map(c => c.line),
        borderColor: 'rgba(0,0,0,0.3)',
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverBorderColor: '#fff',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 15, 25, 0.95)',
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.8)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.toFixed(1)} QPS (${((ctx.parsed / (snapshot.value?.total_qps || 1)) * 100).toFixed(0)}%)`
          }
        }
      },
      animation: { animateRotate: true, duration: 600 }
    }
  })
}

function initLineChart() {
  if (!lineCanvasRef.value) return
  lineChart = new Chart(lineCanvasRef.value, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'rgba(255,255,255,0.7)',
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
            font: { size: 11 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 15, 25, 0.95)',
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.8)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 10 }, maxTicksLimit: 10 },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.06)', drawBorder: false },
          ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
          title: { display: true, text: 'QPS', color: 'rgba(255,255,255,0.4)', font: { size: 11 } }
        }
      },
      elements: {
        line: { tension: 0.35, borderWidth: 2.5 },
        point: { radius: 0, hoverRadius: 4, hitRadius: 10 }
      },
      animation: { duration: 400 }
    }
  })
}

function initMitigationChart() {
  if (!mitigationCanvasRef.value) return
  mitigationChart = new Chart(mitigationCanvasRef.value, {
    type: 'doughnut',
    data: {
      labels: ['Normal (200)', 'Mitigated (202)'],
      datasets: [{
        data: [1, 0],
        backgroundColor: ['#10b981', '#f59e0b'],
        borderColor: 'rgba(0,0,0,0.3)',
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 15, 25, 0.95)',
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.8)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
        }
      },
      animation: { duration: 500 }
    }
  })
}

// ── Update charts when snapshot changes ──
watch(snapshot, (snap) => {
  if (!snap) return
  updatePieChart(snap)
  updateMitigationChart(snap)
})

watch(() => history.length, () => {
  updateLineChart()
})

function updatePieChart(snap) {
  if (!pieChart) return
  const endpoints = snap.top_endpoints || []
  pieChart.data.labels = endpoints.map(e => shortPath(`${e.method} ${e.path}`))
  pieChart.data.datasets[0].data = endpoints.map(e => e.qps)
  pieChart.data.datasets[0].backgroundColor = endpoints.map((e, i) => COLORS[i % COLORS.length].line)
  pieChart.update('none')
}

function updateLineChart() {
  if (!lineChart || history.length < 2) return

  // Collect all endpoint keys seen in history
  const keySet = new Set()
  history.forEach(h => {
    h.endpoints.forEach(e => keySet.add(e.key))
  })

  // Take only top 5 by latest QPS
  const latestSnap = history[history.length - 1]
  const topKeys = latestSnap.endpoints.slice(0, 5).map(e => e.key)

  // Build time labels
  const labels = history.map(h => formatTime(h.timestamp))

  // Build datasets
  const datasets = topKeys.map((key, idx) => {
    const color = getEndpointColor(key)
    return {
      label: shortPath(key),
      data: history.map(h => {
        const ep = h.endpoints.find(e => e.key === key)
        return ep ? ep.qps : 0
      }),
      borderColor: color.line,
      backgroundColor: color.bg,
      fill: true,
    }
  })

  lineChart.data.labels = labels
  lineChart.data.datasets = datasets
  lineChart.update('none')
}

function updateMitigationChart(snap) {
  if (!mitigationChart) return
  const normal = snap.normal_count || 0
  const mitigated = snap.mitigated_count || 0
  mitigationChart.data.datasets[0].data = [normal || 1, mitigated]
  mitigationChart.update('none')
}
</script>

<template>
  <AdminLayout>
    <div class="perf-page">
      <!-- Header -->
      <header class="page-header">
        <div class="header-left">
          <h1 class="page-title">
            <span class="title-icon">📊</span>
            Performance Dashboard
          </h1>
          <p class="page-subtitle">Real-time endpoint metrics — Adaptive QPS monitoring</p>
        </div>
        <div class="header-right">
          <div class="connection-badge" :class="{ connected }">
            <span class="conn-dot"></span>
            <span class="conn-label">{{ connected ? 'Live' : 'Connecting...' }}</span>
          </div>
        </div>
      </header>

      <!-- Top Stats Bar -->
      <div class="stats-bar">
        <div class="stat-pill total-qps">
          <div class="pill-icon">⚡</div>
          <div class="pill-body">
            <span class="pill-value">{{ totalQPS }}</span>
            <span class="pill-label">Total QPS</span>
          </div>
          <div class="pill-spark" :class="{ active: parseFloat(totalQPS) > 0 }"></div>
        </div>

        <div class="stat-pill">
          <div class="pill-icon">✅</div>
          <div class="pill-body">
            <span class="pill-value">{{ normalCount.toLocaleString() }}</span>
            <span class="pill-label">Normal (200)</span>
          </div>
        </div>

        <div class="stat-pill mitigated-pill">
          <div class="pill-icon">🛡️</div>
          <div class="pill-body">
            <span class="pill-value">{{ mitigatedCount.toLocaleString() }}</span>
            <span class="pill-label">Mitigated (202)</span>
          </div>
        </div>

        <div class="stat-pill">
          <div class="pill-icon">📈</div>
          <div class="pill-body">
            <span class="pill-value">{{ mitigatedPct }}%</span>
            <span class="pill-label">Mitigation Rate</span>
          </div>
        </div>

        <div class="stat-pill interval-pill">
          <div class="pill-icon">⏱️</div>
          <div class="pill-body">
            <span class="pill-label">Refresh Interval</span>
            <div class="interval-btns">
              <button
                v-for="opt in intervalOptions"
                :key="opt"
                class="interval-btn"
                :class="{ active: interval === opt }"
                @click="changeInterval(opt)"
              >{{ opt }}s</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 1: Pie + Top5 List -->
      <div class="grid-row two-col">
        <!-- Pie Chart -->
        <div class="glass-card chart-card">
          <div class="card-header">
            <h3 class="card-title">Request Distribution</h3>
            <span class="card-badge">Top 5</span>
          </div>
          <div class="pie-wrapper">
            <canvas ref="pieCanvasRef"></canvas>
            <div class="pie-center">
              <span class="pie-center-value">{{ totalQPS }}</span>
              <span class="pie-center-label">QPS</span>
            </div>
          </div>
          <!-- Pie legend -->
          <div class="pie-legend">
            <div
              v-for="(ep, idx) in topEndpoints"
              :key="idx"
              class="legend-item"
            >
              <span class="legend-color" :style="{ background: COLORS[idx % COLORS.length].line }"></span>
              <span class="legend-text">{{ shortPath(ep.method + ' ' + ep.path) }}</span>
              <span class="legend-value">{{ ep.qps.toFixed(1) }}</span>
            </div>
          </div>
        </div>

        <!-- Top 5 Endpoints List -->
        <div class="glass-card list-card">
          <div class="card-header">
            <h3 class="card-title">Top Endpoints by QPS</h3>
            <span class="card-badge live-badge">
              <span class="live-dot"></span>
              Live
            </span>
          </div>
          <div class="endpoint-list" v-if="topEndpoints.length > 0">
            <div
              v-for="(ep, idx) in topEndpoints"
              :key="idx"
              class="endpoint-row"
            >
              <div class="ep-rank" :style="{ background: COLORS[idx % COLORS.length].line }">{{ idx + 1 }}</div>
              <div class="ep-info">
                <div class="ep-name">
                  <span class="ep-method" :class="ep.method.toLowerCase()">{{ ep.method }}</span>
                  <span class="ep-path">{{ shortPath(ep.path) }}</span>
                </div>
                <div class="ep-meta">
                  <span class="ep-latency">{{ ep.avg_latency_ms.toFixed(1) }}ms</span>
                  <span class="ep-reqs">{{ ep.total_reqs.toLocaleString() }} reqs</span>
                  <span v-if="ep.mitigated > 0" class="ep-mitigated">🛡️ {{ ep.mitigated }}</span>
                </div>
              </div>
              <div class="ep-qps-wrap">
                <span class="ep-qps-value">{{ ep.qps.toFixed(1) }}</span>
                <div class="ep-qps-bar-bg">
                  <div
                    class="ep-qps-bar"
                    :style="{
                      width: (ep.qps / maxQPS * 100) + '%',
                      background: COLORS[idx % COLORS.length].line
                    }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <div class="empty-icon">📡</div>
            <p>Waiting for traffic data...</p>
            <p class="empty-hint">Run the perftest tool to generate demo traffic</p>
          </div>
        </div>
      </div>

      <!-- Row 2: Line Chart (full width) -->
      <div class="glass-card chart-card line-chart-card">
        <div class="card-header">
          <h3 class="card-title">QPS Timeline</h3>
          <div class="card-header-right">
            <span class="card-badge">{{ history.length }} samples</span>
          </div>
        </div>
        <div class="line-chart-wrapper">
          <canvas ref="lineCanvasRef"></canvas>
        </div>
        <div v-if="history.length < 2" class="chart-overlay">
          <div class="spinner"></div>
          <span>Collecting data points...</span>
        </div>
      </div>

      <!-- Row 3: Mitigation + Architecture -->
      <div class="grid-row two-col">
        <!-- Mitigation Panel -->
        <div class="glass-card mitigation-card">
          <div class="card-header">
            <h3 class="card-title">Mitigation Overview</h3>
          </div>
          <div class="mitigation-body">
            <div class="mitigation-chart-wrap">
              <canvas ref="mitigationCanvasRef"></canvas>
              <div class="mitigation-center">
                <span class="mitigation-pct">{{ mitigatedPct }}%</span>
                <span class="mitigation-label">mitigated</span>
              </div>
            </div>
            <div class="mitigation-stats">
              <div class="mit-stat">
                <span class="mit-dot normal"></span>
                <div class="mit-info">
                  <span class="mit-value">{{ normalCount.toLocaleString() }}</span>
                  <span class="mit-label">Sync (200 OK)</span>
                </div>
              </div>
              <div class="mit-stat">
                <span class="mit-dot mitigated"></span>
                <div class="mit-info">
                  <span class="mit-value">{{ mitigatedCount.toLocaleString() }}</span>
                  <span class="mit-label">Async (202 Accepted)</span>
                </div>
              </div>
              <div class="mit-divider"></div>
              <p class="mit-desc">
                When QPS exceeds the threshold, the adaptive dispatcher
                switches to async mode (HTTP 202), queuing requests for
                background processing to maintain system stability.
              </p>
            </div>
          </div>
        </div>

        <!-- Architecture Diagram -->
        <div class="glass-card arch-card">
          <div class="card-header">
            <h3 class="card-title">Adaptive Architecture</h3>
          </div>
          <div class="arch-flow">
            <div class="arch-step">
              <div class="arch-node request">HTTP Request</div>
              <div class="arch-arrow">↓</div>
            </div>
            <div class="arch-step">
              <div class="arch-node middleware">Perf Middleware</div>
              <div class="arch-desc">Records metrics per endpoint</div>
              <div class="arch-arrow">↓</div>
            </div>
            <div class="arch-step">
              <div class="arch-node dispatcher">QPS Dispatcher</div>
              <div class="arch-desc">Checks threshold in real-time</div>
              <div class="arch-arrow-split">
                <div class="arch-branch-line left"></div>
                <div class="arch-branch-line right"></div>
              </div>
            </div>
            <div class="arch-branches">
              <div class="arch-branch normal">
                <div class="arch-condition">QPS &lt; threshold</div>
                <div class="arch-node sync-node">Sync → 200</div>
              </div>
              <div class="arch-branch high">
                <div class="arch-condition">QPS ≥ threshold</div>
                <div class="arch-node async-node">Async → 202</div>
              </div>
            </div>
            <div class="arch-step">
              <div class="arch-arrow">↓</div>
              <div class="arch-node ws-node">WebSocket Hub</div>
              <div class="arch-desc">Broadcasts to dashboard</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.perf-page {
  max-width: 1280px;
  margin: 0 auto;
}

/* ─── Header ─── */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.page-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  background: linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.title-icon {
  -webkit-text-fill-color: initial;
  font-size: 1.8rem;
}

.page-subtitle {
  margin: 0.3rem 0 0;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.85rem;
}

.connection-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.85rem;
  border-radius: 20px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.25);
  font-size: 0.78rem;
  color: #fca5a5;
  transition: all 0.3s;
}

.connection-badge.connected {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.25);
  color: #6ee7b7;
}

.conn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  animation: pulse-fast 1s infinite;
}

.connected .conn-dot {
  background: #10b981;
  animation: pulse 2s infinite;
}

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes pulse-fast { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

/* ─── Stats Bar ─── */
.stats-bar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 1rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  flex: 1;
  min-width: 140px;
  position: relative;
  overflow: hidden;
}

.stat-pill.total-qps {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.2);
}

.stat-pill.mitigated-pill {
  background: rgba(245, 158, 11, 0.06);
  border-color: rgba(245, 158, 11, 0.15);
}

.pill-icon { font-size: 1.3rem; flex-shrink: 0; }
.pill-body { display: flex; flex-direction: column; gap: 0.1rem; }
.pill-value {
  font-size: 1.3rem;
  font-weight: 800;
  color: #fff;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.pill-label {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.pill-spark {
  position: absolute;
  right: -10px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.3), transparent 70%);
  opacity: 0;
  transition: opacity 0.5s;
}

.pill-spark.active {
  opacity: 1;
  animation: spark-pulse 2s ease-in-out infinite;
}

@keyframes spark-pulse {
  0%, 100% { transform: translateY(-50%) scale(1); opacity: 0.6; }
  50% { transform: translateY(-50%) scale(1.5); opacity: 0.2; }
}

/* Interval buttons */
.interval-pill { flex: 1.5; }
.interval-btns {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.2rem;
}

.interval-btn {
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.72rem;
  cursor: pointer;
  transition: all 0.2s;
}

.interval-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.interval-btn.active {
  background: rgba(99, 102, 241, 0.25);
  border-color: rgba(99, 102, 241, 0.5);
  color: #a78bfa;
  font-weight: 600;
}

/* ─── Grid ─── */
.grid-row {
  display: grid;
  gap: 1rem;
  margin-bottom: 1rem;
}

.two-col {
  grid-template-columns: 1fr 1fr;
}

@media (max-width: 900px) {
  .two-col { grid-template-columns: 1fr; }
}

/* ─── Cards ─── */
.glass-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  backdrop-filter: blur(12px);
}

.chart-card, .list-card, .mitigation-card, .arch-card {
  padding: 1.25rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.card-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
}

.card-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.12);
  color: #a78bfa;
  font-size: 0.68rem;
  font-weight: 600;
}

.live-badge {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: rgba(16, 185, 129, 0.12);
  color: #6ee7b7;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse 1.5s infinite;
}

/* ─── Pie Chart ─── */
.pie-wrapper {
  position: relative;
  height: 200px;
  margin-bottom: 1rem;
}

.pie-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}

.pie-center-value {
  font-size: 1.6rem;
  font-weight: 800;
  color: #fff;
  line-height: 1;
}

.pie-center-label {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pie-legend {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

.legend-color {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legend-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-value {
  font-weight: 700;
  color: rgba(255, 255, 255, 0.8);
  font-variant-numeric: tabular-nums;
}

/* ─── Endpoint List ─── */
.endpoint-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.endpoint-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s;
}

.endpoint-row:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.ep-rank {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}

.ep-info { flex: 1; min-width: 0; }

.ep-name {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.2rem;
}

.ep-method {
  font-size: 0.6rem;
  font-weight: 800;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.ep-method.get { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; }
.ep-method.post { background: rgba(99, 102, 241, 0.15); color: #a78bfa; }
.ep-method.put { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
.ep-method.delete { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }

.ep-path {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'SF Mono', 'Cascadia Code', monospace;
}

.ep-meta {
  display: flex;
  gap: 0.6rem;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.35);
}

.ep-mitigated {
  color: #fbbf24;
}

.ep-qps-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  min-width: 80px;
}

.ep-qps-value {
  font-size: 1.1rem;
  font-weight: 800;
  color: #fff;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.ep-qps-bar-bg {
  width: 80px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.ep-qps-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}

/* ─── Empty State ─── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
}

.empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
.empty-state p { margin: 0.2rem 0; font-size: 0.85rem; }
.empty-hint { font-size: 0.75rem !important; color: rgba(255, 255, 255, 0.25); }

/* ─── Line Chart ─── */
.line-chart-card {
  margin-bottom: 1rem;
  position: relative;
}

.line-chart-wrapper {
  height: 280px;
}

.chart-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.85rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 16px;
  backdrop-filter: blur(4px);
}

.card-header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* ─── Mitigation Card ─── */
.mitigation-body {
  display: flex;
  gap: 1.25rem;
}

.mitigation-chart-wrap {
  position: relative;
  width: 140px;
  height: 140px;
  flex-shrink: 0;
}

.mitigation-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}

.mitigation-pct {
  font-size: 1.4rem;
  font-weight: 800;
  color: #fbbf24;
  line-height: 1;
}

.mitigation-label {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.35);
  text-transform: uppercase;
}

.mitigation-stats {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.mit-stat {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.mit-dot {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  flex-shrink: 0;
}

.mit-dot.normal { background: #10b981; }
.mit-dot.mitigated { background: #f59e0b; }

.mit-info { display: flex; flex-direction: column; }
.mit-value { font-size: 1rem; font-weight: 700; color: #fff; }
.mit-label { font-size: 0.7rem; color: rgba(255, 255, 255, 0.4); }

.mit-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 0.3rem 0;
}

.mit-desc {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.3);
  line-height: 1.5;
  margin: 0;
}

/* ─── Architecture Card ─── */
.arch-flow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.arch-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.arch-node {
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);
}

.arch-node.request {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.25);
  color: #a78bfa;
}

.arch-node.middleware {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

.arch-node.dispatcher {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.25);
  color: #c4b5fd;
}

.arch-node.sync-node {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.25);
  color: #6ee7b7;
}

.arch-node.async-node {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.25);
  color: #fca5a5;
}

.arch-node.ws-node {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.25);
  color: #93c5fd;
}

.arch-arrow {
  color: rgba(255, 255, 255, 0.2);
  font-size: 0.85rem;
}

.arch-desc {
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.25);
  text-align: center;
}

.arch-arrow-split {
  display: flex;
  gap: 3rem;
  height: 20px;
  position: relative;
}

.arch-branch-line {
  width: 1px;
  height: 100%;
  background: rgba(255, 255, 255, 0.1);
}

.arch-branches {
  display: flex;
  gap: 1.5rem;
}

.arch-branch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.arch-condition {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.35);
  font-family: 'SF Mono', monospace;
}

/* ─── Spinner ─── */
.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
