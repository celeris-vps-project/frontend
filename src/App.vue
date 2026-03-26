<template>
  <router-view />
  <ToastContainer />
  <TopProgressBar />
</template>

<script setup>
import ToastContainer from './components/ToastContainer.vue'
import TopProgressBar from './components/TopProgressBar.vue'
</script>
