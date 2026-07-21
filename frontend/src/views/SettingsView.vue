<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth.js';
import AppHeader from '../components/AppHeader.vue';
import SettingsHogarSection from '../components/settings/SettingsHogarSection.vue';
import SettingsMiembrosSection from '../components/settings/SettingsMiembrosSection.vue';
import SettingsConceptosSection from '../components/settings/SettingsConceptosSection.vue';
import SettingsSplitSection from '../components/settings/SettingsSplitSection.vue';

const auth = useAuthStore();

const tabs = [
  { id: 'hogar', label: 'Hogar' },
  { id: 'miembros', label: 'Miembros' },
  { id: 'conceptos', label: 'Conceptos' },
  { id: 'split', label: 'Split' },
];

const tabActivo = ref('hogar');

const canEdit = computed(() => Boolean(auth.usuario?.esAdmin || auth.usuario?.puedeEditarGastos));
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div>
        <h1 class="text-2xl font-semibold text-ink-primary">Configuración del hogar</h1>
        <p class="text-ink-secondary mt-1.5 text-sm">
          Frecuencia de corte, miembros, conceptos recurrentes y split de gastos.
        </p>
      </div>

      <div class="card p-2 flex gap-1 overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors"
          :class="tabActivo === tab.id ? 'bg-accent text-white' : 'text-ink-secondary hover:text-ink-primary'"
          @click="tabActivo = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <SettingsHogarSection v-if="tabActivo === 'hogar'" :can-edit="canEdit" />
      <SettingsMiembrosSection v-else-if="tabActivo === 'miembros'" />
      <SettingsConceptosSection v-else-if="tabActivo === 'conceptos'" :can-edit="canEdit" />
      <SettingsSplitSection v-else-if="tabActivo === 'split'" :can-edit="canEdit" />
    </main>
  </div>
</template>
