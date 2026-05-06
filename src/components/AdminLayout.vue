<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { clearToken } from '../api/auth'
import { useI18n } from 'vue-i18n'
import { useLocale } from '../composables/useLocale'
import ThemeSelector from './ThemeSelector.vue'
import { pingMessageService } from '../api/message'

const { t } = useI18n()
const { toggleLocale, localeLabel } = useLocale()
const router = useRouter()
const route = useRoute()
const showMessageCenter = ref(false)

onMounted(async () => {
  showMessageCenter.value = await pingMessageService()
})

const navItems = [
  { path: '/admin', labelKey: 'nav.overview', icon: 'overview' },
  { path: '/admin/nodes', labelKey: 'nav.hostNodes', icon: 'nodes' },
  { path: '/admin/resource-pools', labelKey: 'nav.resourcePools', icon: 'pools' },
  { path: '/admin/products', labelKey: 'nav.products', icon: 'products' },
  { path: '/admin/coupons', labelKey: 'nav.coupons', icon: 'coupons' },
  { path: '/admin/repairs', label: '人工处理', icon: 'repairs' },
  { path: '/admin/payment-providers', labelKey: 'nav.payment', icon: 'payment' },
  { path: '/admin/messages', label: '消息管理', icon: 'message' },
  { path: '/admin/performance', labelKey: 'nav.performance', icon: 'performance' },
  { path: '/admin/general', label: '通用设置', icon: 'settings' },
  { path: '/admin/smtp', label: 'SMTP', icon: 'mail' },
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
          v-show="item.path !== '/admin/messages' || showMessageCenter"
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
          <!-- Coupons -->
          <svg v-else-if="item.icon === 'coupons'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7z"/>
            <path d="M9 9h.01"/>
            <path d="M15 15h.01"/>
            <path d="m9 15 6-6"/>
          </svg>
          <!-- 人工处理 -->
          <svg v-else-if="item.icon === 'repairs'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.1-3.1a5 5 0 0 1-6.6 6.6L7 20l-3-3 7.2-7.2a5 5 0 0 1 6.6-6.6l-3.1 3.1z"/>
          </svg>
          <!-- Performance -->
          <svg v-else-if="item.icon === 'performance'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <!-- Settings -->
          <svg v-else-if="item.icon === 'settings'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08A1.65 1.65 0 0 0 20.91 10H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <!-- Mail -->
          <svg v-else-if="item.icon === 'mail'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
            <path d="m3 7 9 6 9-6"/>
          </svg>
          <!-- Message Center -->
          <svg v-else-if="item.icon === 'message'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <path d="M8 8h8"/>
            <path d="M8 12h5"/>
          </svg>
          <span class="nav-label">{{ item.label || t(item.labelKey) }}</span>
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

        <ThemeSelector />

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
