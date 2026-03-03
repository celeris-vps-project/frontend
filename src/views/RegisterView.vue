<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { register, saveToken, saveRole } from '../api/auth'

const router = useRouter()
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''

  if (!email.value || !password.value || !confirmPassword.value) {
    error.value = 'Please complete all fields.'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }

  loading.value = true
  try {
    const result = await register(email.value, password.value)
    saveToken(result.token)
    saveRole(result.role || 'user')
    router.push('/dashboard')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Register failed'
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
      <h1>Create Account</h1>
      <p>Get started with your VPS billing panel.</p>

      <form @submit.prevent="onSubmit">
        <div class="form-field">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" autocomplete="email" placeholder="you@example.com" />
        </div>

        <div class="form-field">
          <label for="password">Password</label>
          <input id="password" v-model="password" type="password" autocomplete="new-password" placeholder="••••••••" />
        </div>

        <div class="form-field">
          <label for="confirmPassword">Confirm Password</label>
          <input id="confirmPassword" v-model="confirmPassword" type="password" autocomplete="new-password" placeholder="••••••••" />
        </div>

        <button class="action-btn primary-btn" type="submit" :disabled="loading">
          {{ loading ? 'Creating account...' : 'Create Account' }}
        </button>
      </form>

      <p v-if="error" class="error">{{ error }}</p>

      <p class="alt-action">
        Already have an account?
        <RouterLink to="/login">Sign in</RouterLink>
      </p>
    </section>
  </main>
</template>
