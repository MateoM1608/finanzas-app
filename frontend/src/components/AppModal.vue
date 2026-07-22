<script setup>
defineProps({
  title: { type: String, required: true },
});
const emit = defineEmits(['close']);
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
    <div class="fixed inset-0 bg-ink-primary/40" @click="emit('close')" />

    <div class="relative card p-6 sm:p-8 w-full max-w-lg my-8">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-base font-semibold text-ink-primary">{{ title }}</h3>
        <button
          type="button"
          class="text-ink-tertiary hover:text-ink-primary transition-colors text-xl leading-none"
          @click="emit('close')"
        >
          &times;
        </button>
      </div>

      <slot />
    </div>
  </div>
</template>
