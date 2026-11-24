<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth.js';
import AppLayout from '../components/AppLayout.vue';
import SettingsHogarSection from '../components/settings/SettingsHogarSection.vue';
import SettingsMiembrosSection from '../components/settings/SettingsMiembrosSection.vue';
import SettingsConceptosSection from '../components/settings/SettingsConceptosSection.vue';
import SettingsSplitSection from '../components/settings/SettingsSplitSection.vue';

const auth = useAuthStore();

const tabs = [
  { id: 'hogar', label: 'Hogar' },
  { id: 'miembros', label: 'Miembros' },
  { id: 'conceptos', label: 'Conceptos' },
  { id: 'split', label: 'Reparto' },
];

const tabActivo = ref('hogar');

const canEdit = computed(() => Boolean(auth.usuario?.esAdmin || auth.usuario?.puedeEditarGastos));
</script>

<template>
  <AppLayout title="Configuración del hogar" subtitle="Frecuencia de corte, miembros, conceptos recurrentes y reparto de gastos.">
    <div class="space-y-6 max-w-3xl">
      <div class="tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="tab"
          :class="tabActivo === tab.id ? 'tab-active' : ''"
          :aria-selected="tabActivo === tab.id"
          @click="tabActivo = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <SettingsHogarSection v-if="tabActivo === 'hogar'" :can-edit="canEdit" />
      <SettingsMiembrosSection v-else-if="tabActivo === 'miembros'" />
      <SettingsConceptosSection v-else-if="tabActivo === 'conceptos'" :can-edit="canEdit" />
      <SettingsSplitSection v-else-if="tabActivo === 'split'" :can-edit="canEdit" />
    </div>
  </AppLayout>
</template>
