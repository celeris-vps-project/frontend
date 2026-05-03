<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { resetPassword, sendPasswordResetCode } from '../api/auth'
import { translateError } from '../utils/errorHelper'
import { useToast } from '../composables/useToast'
import { useCooldown } from '../composables/useCooldown'

const router = useRouter()
const toast = useToast()
const email = ref('')
const code = ref('')
const password = ref('')
const confirmPassword = ref('')
const sending = ref(false)
const resetting = ref(false)
const { remaining: codeCooldown, coolingDown: codeCoolingDown, startCooldown: startCodeCooldown } = useCooldown(60)

function validateEmail() {
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)
  if (!ok) toast.error('请输入有效的邮箱地址。')
  return ok
}

async function requestCode() {
  if (codeCoolingDown.value || !validateEmail()) return
  sending.value = true
  try {
    await sendPasswordResetCode(email.value)
    startCodeCooldown()
    toast.success('验证码已发送，请检查邮箱。')
  } catch (err) {
    toast.error(translateError(err))
  } finally {
    sending.value = false
  }
}

async function onSubmit() {
  if (!email.value || !code.value || !password.value || !confirmPassword.value) {
    toast.error('请填写所有字段。')
    return
  }
  if (!validateEmail()) return
  if (password.value.length < 6) {
    toast.error('密码长度至少为 6 个字符。')
    return
  }
  if (password.value !== confirmPassword.value) {
    toast.error('两次密码不一致。')
    return
  }
  resetting.value = true
  try {
    await resetPassword(email.value, code.value.trim(), password.value)
    toast.success('密码已重置，请重新登录。')
    router.push('/login')
  } catch (err) {
    toast.error(translateError(err))
  } finally {
    resetting.value = false
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
      <div class="auth-brand">Celeris</div>
      <h1>找回密码</h1>
      <p>通过邮箱验证码重置账号密码。</p>

      <form @submit.prevent="onSubmit">
        <div class="form-field">
          <label for="email">邮箱</label>
          <input id="email" v-model="email" type="email" autocomplete="email" placeholder="you@example.com" />
        </div>
        <div class="form-field">
          <label for="code">邮箱验证码</label>
          <div class="code-row">
            <input id="code" v-model="code" type="text" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="6 位验证码" />
            <button class="action-btn secondary-btn code-btn" type="button" :disabled="sending || codeCoolingDown" @click="requestCode">
              {{ sending ? '发送中...' : codeCoolingDown ? `${codeCooldown}s` : '发送验证码' }}
            </button>
          </div>
        </div>
        <div class="form-field">
          <label for="password">新密码</label>
          <input id="password" v-model="password" type="password" autocomplete="new-password" placeholder="至少 6 位" />
        </div>
        <div class="form-field">
          <label for="confirmPassword">确认新密码</label>
          <input id="confirmPassword" v-model="confirmPassword" type="password" autocomplete="new-password" placeholder="再次输入新密码" />
        </div>
        <button class="action-btn primary-btn" type="submit" :disabled="resetting">
          {{ resetting ? '重置中...' : '重置密码' }}
        </button>
      </form>

      <div class="auth-divider"><span>或</span></div>
      <p class="alt-action">
        已想起密码？
        <RouterLink to="/login">返回登录</RouterLink>
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
