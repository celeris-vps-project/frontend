<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { clearToken, isAdmin } from '../api/auth'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useLocale } from '../composables/useLocale'
import ThemeSelector from './ThemeSelector.vue'

const { t } = useI18n()
const { toggleLocale, localeLabel } = useLocale()
const router = useRouter()
const route = useRoute()
const showAdmin = computed(() => isAdmin())

const navItems = [
  { path: '/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard' },
  { path: '/instances', labelKey: 'nav.instances', icon: 'instances' },
  { path: '/invoices', labelKey: 'nav.invoices', icon: 'invoices' },
  { path: '/profile', labelKey: 'nav.profile', icon: 'profile' },
]

function isActive(path) {
  if (path === '/dashboard') return route.path === '/dashboard'
  return route.path.startsWith(path)
}

function logout() {
  clearToken()
  router.push('/login')
}
</script>

<template>
  <div class="app-shell">
    <!-- Background gradient -->
    <div class="bg-gradient"></div>

    <!-- Sidebar -->
    <aside class="sidebar glass-panel">
      <!-- Brand -->
      <div class="sidebar-brand">
        <div class="brand-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="brand-text">Celeris</span>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
        >
          <!-- Dashboard icon -->
          <svg v-if="item.icon === 'dashboard'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <!-- Instances icon -->
          <svg v-else-if="item.icon === 'instances'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <!-- Invoices icon -->
          <svg v-else-if="item.icon === 'invoices'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <!-- Profile icon -->
          <svg v-else-if="item.icon === 'profile'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span class="nav-label">{{ t(item.labelKey) }}</span>
          <span class="active-dot" v-if="isActive(item.path)"></span>
        </RouterLink>

        <!-- Admin link -->
        <template v-if="showAdmin">
          <div class="nav-divider"></div>
          <RouterLink to="/admin" class="nav-item admin-item" :class="{ active: route.path.startsWith('/admin') }">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span class="nav-label">{{ t('nav.adminPanel') }}</span>
            <span class="active-dot" v-if="route.path.startsWith('/admin')"></span>
          </RouterLink>
        </template>
      </nav>

      <!-- Footer -->
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

    <!-- Main content -->
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

/* ─── Sidebar ─── */
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
  padding: 0;
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
  background: var(--accent-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.brand-text {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

/* ─── Navigation ─── */
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

.nav-label {
  flex: 1;
}

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

/* ─── Footer ─── */
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

.theme-toggle:hover {
  background: var(--accent-bg);
}

.toggle-label {
  flex: 1;
}

.logout-item {
  color: var(--danger);
}

.logout-item:hover {
  background: var(--danger-bg);
  color: var(--danger);
}

.admin-item.active {
  background: var(--warning-bg);
  color: var(--warning);
}

.admin-item .active-dot {
  background: var(--warning);
}

/* ─── Main Area ─── */
.main-area {
  flex: 1;
  padding: 2rem;
  z-index: 1;
  min-height: 100vh;
  margin-left: 220px;
}

@media (max-width: 768px) {
  .sidebar {
    width: 64px;
  }
  .brand-text,
  .nav-label,
  .toggle-label {
    display: none;
  }
  .sidebar-brand {
    justify-content: center;
    padding: 1.25rem 0.5rem;
  }
  .nav-item {
    justify-content: center;
    padding: 0.65rem;
  }
  .theme-toggle {
    justify-content: center;
    padding: 0.65rem;
  }
  .main-area {
    padding: 1.5rem;
    margin-left: 64px;
  }
}
</style>
