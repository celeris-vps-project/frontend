<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { login, saveToken, saveRole } from '../api/auth'

const router = useRouter()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''

  if (!email.value || !password.value) {
    error.value = 'Please fill in email and password.'
    return
  }

  loading.value = true
  try {
    const result = await login(email.value, password.value)
    saveToken(result.token)
    saveRole(result.role)
    // Redirect admins to admin panel, users to dashboard
    if (result.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/dashboard')
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Login failed'
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
      <div class="auth-brand">&#9670; Celeris</div>
      <h1>Welcome back</h1>
      <p>Sign in to your VPS billing panel.</p>

      <form @submit.prevent="onSubmit">
        <div class="form-field">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" autocomplete="email" placeholder="you@example.com" />
        </div>

        <div class="form-field">
          <label for="password">Password</label>
          <input id="password" v-model="password" type="password" autocomplete="current-password" placeholder="********" />
        </div>

        <button class="action-btn primary-btn" type="submit" :disabled="loading">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>

      <p v-if="error" class="error">{{ error }}</p>

      <p class="alt-action">
        Don't have an account?
        <RouterLink to="/register">Register</RouterLink>
      </p>
    </section>
  </main>
</template>
