<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { clearToken } from '../api/auth'
import { useTheme } from '../composables/useTheme'
import { useI18n } from 'vue-i18n'
import { useLocale } from '../composables/useLocale'

const { t } = useI18n()
const { toggleLocale, localeLabel } = useLocale()
const router = useRouter()
const route = useRoute()
const { isDark, toggleTheme } = useTheme()

const navItems = [
  { path: '/admin', labelKey: 'nav.overview', icon: 'overview' },
  { path: '/admin/nodes', labelKey: 'nav.hostNodes', icon: 'nodes' },
  { path: '/admin/resource-pools', labelKey: 'nav.resourcePools', icon: 'pools' },
  { path: '/admin/products', labelKey: 'nav.products', icon: 'products' },
  { path: '/admin/payment-providers', labelKey: 'nav.payment', icon: 'payment' },
  { path: '/admin/performance', labelKey: 'nav.performance', icon: 'performance' },
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
    <div class="bg-gradient"></div>

    <aside class="sidebar glass-panel">
      <div class="sidebar-brand">
        <div class="brand-icon admin-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <span class="brand-text">Admin</span>
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
        >
          <!-- Overview -->
          <svg v-if="item.icon === 'overview'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <!-- Nodes -->
          <svg v-else-if="item.icon === 'nodes'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
            <rect x="9" y="9" width="6" height="6"/>
            <line x1="9" y1="1" x2="9" y2="4"/>
            <line x1="15" y1="1" x2="15" y2="4"/>
            <line x1="9" y1="20" x2="9" y2="23"/>
            <line x1="15" y1="20" x2="15" y2="23"/>
            <line x1="20" y1="9" x2="23" y2="9"/>
            <line x1="20" y1="14" x2="23" y2="14"/>
            <line x1="1" y1="9" x2="4" y2="9"/>
            <line x1="1" y1="14" x2="4" y2="14"/>
          </svg>
          <!-- Pools -->
          <svg v-else-if="item.icon === 'pools'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
          <!-- Products -->
          <svg v-else-if="item.icon === 'products'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          <!-- Payment -->
          <svg v-else-if="item.icon === 'payment'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
            <line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
          <!-- Performance -->
          <svg v-else-if="item.icon === 'performance'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <span class="nav-label">{{ t(item.labelKey) }}</span>
          <span class="active-dot" v-if="isActive(item.path)"></span>
        </RouterLink>

        <div class="nav-divider"></div>

        <button class="nav-item user-panel-item" @click="goToDashboard">
          <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          <span class="nav-label">{{ t('nav.userPanel') }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <button class="theme-toggle" @click="toggleLocale" title="Switch Language">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span class="toggle-label">{{ localeLabel }}</span>
        </button>

        <button class="theme-toggle" @click="toggleTheme">
          <svg v-if="isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          <span class="toggle-label">{{ t('nav.toggleTheme') }}</span>
        </button>

        <button class="nav-item logout-item" @click="logout">
          <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span class="nav-label">{{ t('nav.logout') }}</span>
        </button>
      </div>
    </aside>

    <main class="main-area">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  position: relative;
}

.bg-gradient {
  position: fixed;
  inset: 0;
  z-index: 0;
  background: var(--bg-gradient);
  pointer-events: none;
}

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 220px;
  display: flex;
  flex-direction: column;
  z-index: 10;
  border-radius: 0;
  border-right: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 1.5rem 1.25rem 1.25rem;
}

.brand-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.admin-brand {
  background: linear-gradient(135deg, #f59e0b, #f97316);
}

.brand-text {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.sidebar-nav {
  flex: 1;
  padding: 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.65rem 0.85rem;
  border-radius: 12px;
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  position: relative;
}

.nav-item:hover {
  background: var(--sidebar-hover-bg);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--sidebar-active-bg);
  color: var(--sidebar-active-text);
  font-weight: 600;
}

.nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  opacity: 0.7;
}

.nav-item.active .nav-icon {
  opacity: 1;
}

.nav-label { flex: 1; }

.active-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sidebar-active-dot);
  flex-shrink: 0;
}

.nav-divider {
  height: 1px;
  background: var(--divider);
  margin: 0.5rem 0.85rem;
}

.user-panel-item {
  color: var(--info);
}

.user-panel-item:hover {
  background: var(--info-bg);
  color: var(--info);
}

.sidebar-footer {
  padding: 0.75rem;
  border-top: 1px solid var(--divider);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.65rem 0.85rem;
  border-radius: 12px;
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--accent);
  cursor: pointer;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  transition: all 0.2s;
}

.theme-toggle:hover { background: var(--accent-bg); }
.toggle-label { flex: 1; }

.logout-item { color: var(--danger); }
.logout-item:hover {
  background: var(--danger-bg);
  color: var(--danger);
}

.main-area {
  flex: 1;
  padding: 2rem;
  z-index: 1;
  min-height: 100vh;
  margin-left: 220px;
}

@media (max-width: 768px) {
  .sidebar { width: 64px; }
  .brand-text, .nav-label, .toggle-label { display: none; }
  .sidebar-brand { justify-content: center; padding: 1.25rem 0.5rem; }
  .nav-item { justify-content: center; padding: 0.65rem; }
  .theme-toggle { justify-content: center; padding: 0.65rem; }
  .main-area { padding: 1.5rem; margin-left: 64px; }
}
</style>
