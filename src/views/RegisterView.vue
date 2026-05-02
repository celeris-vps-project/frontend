<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  fetchAuthOptions,
  register,
  registerWithCode,
  saveRole,
  saveToken,
  sendRegistrationCode
} from '../api/auth'
import { useI18n } from 'vue-i18n'
import { translateError } from '../utils/errorHelper'
import { useToast } from '../composables/useToast'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const verificationCode = ref('')
const verificationRequired = ref(false)
const loading = ref(false)
const sendingCode = ref(false)

onMounted(async () => {
  try {
    const options = await fetchAuthOptions()
    verificationRequired.value = !!options.registration_verification_required
  } catch {
    verificationRequired.value = false
  }
})

/**
 * Validate password format on the frontend.
 * Rules (matching backend: len($)>5 plus basic strength):
 *   - At least 6 characters
 *   - Contains at least one letter
 *   - Contains at least one digit
 * Returns true if valid; shows toast and returns false otherwise.
 */
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email)) {
    toast.error(t('errors.invalidEmail'))
    return false
  }
  return true
}

function validatePassword(pwd) {
  if (pwd.length < 6) {
    toast.error(t('errors.passwordTooShort'))
    return false
  }
  if (!/[a-zA-Z]/.test(pwd)) {
    toast.error(t('errors.passwordNoLetter'))
    return false
  }
  if (!/\d/.test(pwd)) {
    toast.error(t('errors.passwordNoDigit'))
    return false
  }
  return true
}

async function onSubmit() {
  if (!email.value || !password.value || !confirmPassword.value) {
    toast.error(t('errors.allFieldsRequired'))
    return
  }
  if (!validateEmail(email.value)) {
    return
  }
  if (password.value !== confirmPassword.value) {
    toast.error(t('errors.passwordsNotMatch'))
    return
  }
  if (!validatePassword(password.value)) {
    return
  }
  if (verificationRequired.value && !verificationCode.value.trim()) {
    toast.error('请输入邮箱验证码。')
    return
  }
  loading.value = true
  try {
    const result = verificationRequired.value
      ? await registerWithCode(email.value, password.value, verificationCode.value.trim())
      : await register(email.value, password.value)
    saveToken(result.token)
    saveRole(result.role || 'user')
    router.push('/dashboard')
  } catch (err) {
    toast.error(translateError(err))
  } finally {
    loading.value = false
  }
}

async function requestCode() {
  if (!email.value || !validateEmail(email.value)) return
  sendingCode.value = true
  try {
    await sendRegistrationCode(email.value)
    toast.success('验证码已发送，请检查邮箱。')
  } catch (err) {
    toast.error(translateError(err))
  } finally {
    sendingCode.value = false
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
      <h1>{{ t('auth.createAccount') }}</h1>
      <p>{{ t('auth.registerSubtitle') }}</p>

      <form @submit.prevent="onSubmit">
        <div class="form-field">
          <label for="email">{{ t('auth.email') }}</label>
          <input id="email" v-model="email" type="text" autocomplete="email" placeholder="you@example.com" />
        </div>
        <div class="form-field">
          <label for="password">{{ t('auth.password') }}</label>
          <input id="password" v-model="password" type="password" autocomplete="new-password" placeholder="••••••••" />
        </div>
        <div class="form-field">
          <label for="confirmPassword">{{ t('auth.confirmPassword') }}</label>
          <input id="confirmPassword" v-model="confirmPassword" type="password" autocomplete="new-password" placeholder="••••••••" />
        </div>
        <div v-if="verificationRequired" class="form-field">
          <label for="verificationCode">邮箱验证码</label>
          <div class="code-row">
            <input
              id="verificationCode"
              v-model="verificationCode"
              type="text"
              inputmode="numeric"
              maxlength="6"
              autocomplete="one-time-code"
              placeholder="6 位验证码"
            />
            <button class="action-btn secondary-btn code-btn" type="button" :disabled="sendingCode" @click="requestCode">
              {{ sendingCode ? '发送中...' : '发送验证码' }}
            </button>
          </div>
        </div>
        <button class="action-btn primary-btn" type="submit" :disabled="loading">
          {{ loading ? t('auth.creatingAccount') : t('auth.createAccount') }}
        </button>
      </form>

      <div class="auth-divider"><span>{{ t('auth.or') }}</span></div>
      <p class="alt-action">
        {{ t('auth.hasAccount') }}
        <RouterLink to="/login">{{ t('auth.login') }}</RouterLink>
      </p>
    </section>
  </main>
</template>

<style scoped>
.code-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
}

.code-btn {
  width: auto;
  white-space: nowrap;
  border-radius: 12px;
  padding-inline: 0.9rem;
}

@media (max-width: 420px) {
  .code-row {
    grid-template-columns: 1fr;
  }

  .code-btn {
    width: 100%;
  }
}
</style>
