<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { clearToken } from '../api/auth'

const router = useRouter()
const route = useRoute()
const sidebarOpen = ref(true)

const navItems = [
  { path: '/admin', label: 'Overview', icon: '⬡' },
  { path: '/admin/nodes', label: 'Host Nodes', icon: '⬢' },
  { path: '/admin/resource-pools', label: 'Resource Pools', icon: '◈' },
  { path: '/admin/products', label: 'Products', icon: '◇' },
  { path: '/admin/performance', label: 'Performance', icon: '📊' },
]

function isActive(path) {
  if (path === '/admin') return route.path === '/admin'
  return route.path.startsWith(path)
}

function logout() {
  clearToken()
  router.push('/login')
}

function goToDashboard() {
  router.push('/dashboard')
}
</script>

<template>
  <div class="app-shell">
    <!-- Animated background orbs -->
    <div class="bg-orbs">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <!-- Sidebar -->
    <aside class="sidebar glass-panel" :class="{ collapsed: !sidebarOpen }">
      <div class="sidebar-header">
        <h2 class="brand">
          <span class="brand-icon">◆</span>
          <span v-if="sidebarOpen" class="brand-text">Admin</span>
        </h2>
        <button class="toggle-btn" @click="sidebarOpen = !sidebarOpen">
          {{ sidebarOpen ? '◁' : '▷' }}
        </button>
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          :class="{ active: isActive(item.path) }"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span v-if="sidebarOpen" class="nav-label">{{ item.label }}</span>
        </RouterLink>

        <div class="nav-divider"></div>

        <button class="nav-link dashboard-btn" @click="goToDashboard">
          <span class="nav-icon">↩</span>
          <span v-if="sidebarOpen" class="nav-label">User Panel</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <button class="nav-link logout-btn" @click="logout">
          <span class="nav-icon">⏻</span>
          <span v-if="sidebarOpen" class="nav-label">Logout</span>
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <div class="main-area">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

.bg-orbs {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.5;
  animation: float 20s ease-in-out infinite;
}

.orb-1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(239, 68, 68, 0.3), transparent 70%);
  top: -10%;
  left: -5%;
  animation-delay: 0s;
}

.orb-2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(251, 146, 60, 0.25), transparent 70%);
  top: 50%;
  right: -10%;
  animation-delay: -7s;
}

.orb-3 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.3), transparent 70%);
  bottom: -5%;
  left: 30%;
  animation-delay: -14s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -30px) scale(1.05); }
  50% { transform: translate(-20px, 20px) scale(0.95); }
  75% { transform: translate(15px, 15px) scale(1.02); }
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  width: 240px;
  display: flex;
  flex-direction: column;
  z-index: 10;
  transition: width 0.3s ease;
  border-radius: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.sidebar.collapsed { width: 72px; }

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, #f87171, #fb923c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-icon {
  font-size: 1.5rem;
  -webkit-text-fill-color: #f87171;
}

.toggle-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.7rem;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.sidebar-nav {
  flex: 1;
  padding: 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.65);
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
  border: 1px solid transparent;
  background: none;
  width: 100%;
  text-align: left;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.nav-link.active {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.2);
}

.nav-icon {
  font-size: 1.1rem;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.nav-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 0.5rem 0.85rem;
}

.dashboard-btn {
  color: rgba(96, 165, 250, 0.8);
  font-size: 0.85rem;
}
.dashboard-btn:hover {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
}

.sidebar-footer {
  padding: 0.75rem 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.logout-btn {
  color: rgba(248, 113, 113, 0.8);
  font-size: 0.9rem;
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
}

.main-area {
  flex: 1;
  padding: 2rem;
  z-index: 1;
  overflow-y: auto;
  min-height: 100vh;
}
</style>
