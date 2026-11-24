<script setup>
import { computed } from 'vue';
import { useTheme } from '../composables/useTheme.js';
import AppIcon from './AppIcon.vue';

defineProps({
  // `full` muestra la etiqueta (barra lateral); `icon` solo el ícono (barra móvil).
  variant: { type: String, default: 'icon' },
});

const { tema, alternar } = useTheme();
const esOscuro = computed(() => tema.value === 'dark');
const etiqueta = computed(() => (esOscuro.value ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'));
</script>

<template>
  <button
    v-if="variant === 'full'"
    type="button"
    class="group w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
    :aria-label="etiqueta"
    :aria-pressed="esOscuro"
    @click="alternar"
  >
    <span class="flex items-center gap-3">
      <AppIcon :name="esOscuro ? 'moon' : 'sun'" class="h-[18px] w-[18px]" />
      {{ esOscuro ? 'Modo oscuro' : 'Modo claro' }}
    </span>
    <span
      class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border-strong bg-surface-sunken transition-colors"
      :class="esOscuro ? '!bg-accent !border-accent' : ''"
      aria-hidden="true"
    >
      <span
        class="h-3.5 w-3.5 rounded-full bg-surface shadow-card transition-transform duration-200 ease-out"
        :class="esOscuro ? 'translate-x-[18px]' : 'translate-x-[2px]'"
      />
    </span>
  </button>

  <button v-else type="button" class="btn-icon" :aria-label="etiqueta" :title="etiqueta" @click="alternar">
    <AppIcon :name="esOscuro ? 'sun' : 'moon'" class="h-5 w-5" />
  </button>
</template>
