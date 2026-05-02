<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { login, saveToken, saveRole } from '../api/auth'
import { useI18n } from 'vue-i18n'
import { translateError } from '../utils/errorHelper'
import { useToast } from '../composables/useToast'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const email = ref('')
const password = ref('')
const loading = ref(false)

async function onSubmit() {
  if (!email.value || !password.value) {
    toast.error(t('errors.emailPasswordRequired'))
    return
  }
  loading.value = true
  try {
    const result = await login(email.value, password.value)
    saveToken(result.token)
    saveRole(result.role)
    if (result.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/dashboard')
    }
  } catch (err) {
    toast.error(translateError(err))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-layout">
    <div class="auth-bg-orbs">
      <div class="auth-orb auth-orb-1"></div>
      <div class="auth-orb auth-orb-2"></div>
    </div>
    <section class="auth-card glass-card">
      <div class="auth-brand">◆ Celeris</div>
      <h1>{{ t('auth.welcomeBack') }}</h1>
      <p>{{ t('auth.loginSubtitle') }}</p>

      <form @submit.prevent="onSubmit">
        <div class="form-field">
          <label for="email">{{ t('auth.email') }}</label>
          <input id="email" v-model="email" type="email" autocomplete="email" placeholder="you@example.com" />
        </div>
        <div class="form-field">
          <label for="password">{{ t('auth.password') }}</label>
          <input id="password" v-model="password" type="password" autocomplete="current-password" placeholder="********" />
        </div>
        <button class="action-btn primary-btn" type="submit" :disabled="loading">
          {{ loading ? t('auth.loggingIn') : t('auth.loginBtn') }}
        </button>
      </form>

      <div class="auth-divider"><span>{{ t('auth.or') }}</span></div>
      <p class="alt-action">
        {{ t('auth.noAccount') }}
        <RouterLink to="/register">{{ t('auth.register') }}</RouterLink>
      </p>
      <p class="forgot-link">
        <RouterLink to="/forgot-password">找回密码</RouterLink>
      </p>
    </section>
  </main>
</template>

<style scoped>
.forgot-link {
  margin-top: 0.8rem;
  text-align: center;
}

.forgot-link a {
  color: var(--text-secondary);
  font-size: 0.84rem;
  font-weight: 600;
  text-decoration: none;
}

.forgot-link a:hover {
  color: var(--accent);
}
</style>
