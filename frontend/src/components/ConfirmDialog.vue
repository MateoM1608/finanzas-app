<script setup>
import { watch, nextTick, ref, onBeforeUnmount } from 'vue';
import { estadoConfirmacion as estado, responderConfirmacion } from '../composables/useConfirm.js';
import AppIcon from './AppIcon.vue';

const botonAceptar = ref(null);

function onKey(e) {
  if (!estado.abierto) return;
  if (e.key === 'Escape') {
    // Que el Escape no cierre también el modal que está debajo.
    e.stopImmediatePropagation();
    responderConfirmacion(false);
  }
}

watch(
  () => estado.abierto,
  async (abierto) => {
    if (abierto) {
      document.addEventListener('keydown', onKey, true);
      await nextTick();
      botonAceptar.value?.focus();
    } else {
      document.removeEventListener('keydown', onKey, true);
    }
  },
);

onBeforeUnmount(() => document.removeEventListener('keydown', onKey, true));
</script>

<template>
  <div v-if="estado.abierto" class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" :aria-label="estado.mensaje">
    <div class="confirm-overlay fixed inset-0 bg-overlay/50" @click="responderConfirmacion(false)" />
    <div class="confirm-panel relative w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-pop">
      <div class="flex gap-3">
        <span
          class="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          :class="estado.peligroso ? 'bg-negative/10 text-negative' : 'bg-accent/10 text-accent'"
        >
          <AppIcon :name="estado.peligroso ? 'trash' : 'info'" class="h-5 w-5" />
        </span>
        <p class="pt-2 text-sm text-ink-primary">{{ estado.mensaje }}</p>
      </div>
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="responderConfirmacion(false)">Cancelar</button>
        <button
          ref="botonAceptar"
          type="button"
          :class="estado.peligroso ? 'btn bg-negative text-accent-on hover:bg-negative/90' : 'btn-primary'"
          @click="responderConfirmacion(true)"
        >
          {{ estado.textoAceptar }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-overlay {
  animation: fade 140ms ease-out;
}
.confirm-panel {
  animation: pop 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes fade {
  from {
    opacity: 0;
  }
}
@keyframes pop {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
}
</style>
