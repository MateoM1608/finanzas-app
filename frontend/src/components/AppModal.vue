<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps({
  title: { type: String, required: true },
  // md: formularios cortos · lg: configuración con pestañas y listas largas
  size: { type: String, default: 'md' },
});
const emit = defineEmits(['close']);

function onKey(e) {
  if (e.key === 'Escape') emit('close');
}

onMounted(() => {
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true" :aria-label="title">
    <div class="modal-overlay fixed inset-0 bg-overlay/50 backdrop-blur-[2px]" @click="emit('close')" />

    <div
      class="modal-panel relative w-full bg-surface border border-border shadow-pop rounded-t-3xl sm:rounded-2xl flex flex-col max-h-[92vh]"
      :class="props.size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-lg'"
    >
      <div class="flex items-center justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-border">
        <h3 class="section-title">{{ title }}</h3>
        <button type="button" class="btn-icon !p-1.5 -mr-1.5" aria-label="Cerrar" @click="emit('close')">
          <AppIcon name="x" class="h-5 w-5" />
        </button>
      </div>

      <div class="overflow-y-auto overscroll-contain px-5 sm:px-6 py-5" style="padding-bottom: max(1.25rem, env(safe-area-inset-bottom))">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  animation: fade-in 160ms ease-out;
}
.modal-panel {
  animation: panel-in 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
}
@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.985);
  }
}
</style>
