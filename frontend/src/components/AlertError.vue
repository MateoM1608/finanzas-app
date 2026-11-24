<script setup>
import AppIcon from './AppIcon.vue';

defineProps({
  message: { type: String, default: '' },
});
</script>

<template>
  <p
    v-if="message"
    role="alert"
    class="flex items-start gap-2.5 text-sm text-negative bg-negative/10 border border-negative/20 rounded-xl px-3.5 py-2.5"
  >
    <AppIcon name="alert" class="h-4 w-4 mt-0.5 shrink-0" />
    <span>{{ message }}</span>
  </p>
</template>
