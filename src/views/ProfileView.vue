<script setup>
import { ref, onMounted, computed } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { fetchMe, changePassword, getRole } from '../api/auth.js'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Profile data
const userId = ref('')
const role = ref('')
const loading = ref(true)

// Password form
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changing = ref(false)
const error = ref('')
const success = ref(false)

const roleLabel = computed(() => {
  return role.value === 'admin' ? t('profile.roleAdmin') : t('profile.roleUser')
})

onMounted(async () => {
  try {
    const me = await fetchMe()
    userId.value = me.user_id || ''
    role.value = me.role || getRole()
  } catch (err) {
    role.value = getRole()
  } finally {
    loading.value = false
  }
})

async function handleChangePassword() {
  error.value = ''
  success.value = false

  // Validation
  if (!oldPassword.value || !newPassword.value || !confirmPassword.value) {
    error.value = t('profile.allFieldsRequired')
    return
  }
  if (newPassword.value.length < 6) {
    error.value = t('profile.passwordTooShort')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = t('profile.passwordsNotMatch')
    return
  }

  changing.value = true
  try {
    await changePassword(oldPassword.value, newPassword.value)
    success.value = true
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    // Error toast is already shown by the request helper
  } finally {
    changing.value = false
  }
}
</script>

<template>
  <AppLayout>
    <div class="profile-page">
      <header class="page-header">
        <h1 class="page-title">{{ t('profile.title') }}</h1>
        <p class="page-subtitle">{{ t('profile.subtitle') }}</p>
      </header>

      <!-- Account Info Card -->
      <section class="profile-section glass-card">
        <h2 class="section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          {{ t('profile.accountInfo') }}
        </h2>

        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
        </div>

        <div v-else class="info-grid">
          <div class="info-item">
            <span class="info-label">{{ t('profile.userId') }}</span>
            <span class="info-value mono">{{ userId || '—' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('profile.role') }}</span>
            <span class="info-value">
              <span class="role-badge" :class="role">{{ roleLabel }}</span>
            </span>
          </div>
        </div>
      </section>

      <!-- Change Password Card -->
      <section class="profile-section glass-card">
        <h2 class="section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          {{ t('profile.changePassword') }}
        </h2>
        <p class="section-desc">{{ t('profile.changePasswordDesc') }}</p>

        <!-- Success message -->
        <div v-if="success" class="success-banner">
          ✓ {{ t('profile.passwordChanged') }}
        </div>

        <form class="password-form" @submit.prevent="handleChangePassword">
          <!-- Error message -->
          <div v-if="error" class="error-banner">{{ error }}</div>

          <div class="form-group">
            <label class="form-label">{{ t('profile.oldPassword') }}</label>
            <input
              v-model="oldPassword"
              type="password"
              class="form-input"
              :placeholder="t('profile.oldPasswordPlaceholder')"
              autocomplete="current-password"
            />
          </div>

          <div class="form-group">
            <label class="form-label">{{ t('profile.newPassword') }}</label>
            <input
              v-model="newPassword"
              type="password"
              class="form-input"
              :placeholder="t('profile.newPasswordPlaceholder')"
              autocomplete="new-password"
            />
          </div>

          <div class="form-group">
            <label class="form-label">{{ t('profile.confirmNewPassword') }}</label>
            <input
              v-model="confirmPassword"
              type="password"
              class="form-input"
              :placeholder="t('profile.confirmPasswordPlaceholder')"
              autocomplete="new-password"
            />
          </div>

          <button type="submit" class="action-btn primary-btn" :disabled="changing">
            {{ changing ? t('profile.updatingPassword') : t('profile.updatePassword') }}
          </button>
        </form>
      </section>
    </div>
  </AppLayout>
</template>

<style scoped>
.profile-page {
  max-width: 720px;
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

/* Sections */
.profile-section {
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0 0 1rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.section-desc {
  margin: -0.5rem 0 1.25rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

/* Info grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.info-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  font-size: 0.95rem;
  color: var(--text-primary);
  font-weight: 500;
}

.info-value.mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.82rem;
  word-break: break-all;
}

/* Role badge */
.role-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.role-badge.admin {
  background: var(--warning-bg);
  color: var(--warning);
  border: 1px solid var(--warning-border);
}

.role-badge.user {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}

/* Password form */
.password-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.form-input {
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 0.9rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  outline: none;
}

.form-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

.form-input::placeholder {
  color: var(--text-muted);
}

/* Buttons */
.action-btn {
  padding: 0.7rem 1.5rem;
  border-radius: 10px;
  border: none;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  width: fit-content;
}

.primary-btn {
  background: var(--accent-gradient);
  color: #fff;
}

.primary-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Banners */
.error-banner {
  padding: 0.7rem 1rem;
  border-radius: 10px;
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-border);
  font-size: 0.85rem;
  font-weight: 500;
}

.success-banner {
  padding: 0.7rem 1rem;
  border-radius: 10px;
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 1rem;
}

/* Loading */
.loading-state {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
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
</style>
