<script setup>
defineProps({
  message: { type: String, default: '' },
});
</script>

<template>
  <p v-if="message" class="text-sm text-negative bg-negative/10 border border-negative/20 rounded-xl px-3.5 py-2.5">
    {{ message }}
  </p>
</template>
