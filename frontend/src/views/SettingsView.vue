<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth.js';
import AppLayout from '../components/AppLayout.vue';
import AppIcon from '../components/AppIcon.vue';
import SettingsHogarSection from '../components/settings/SettingsHogarSection.vue';
import SettingsMiembrosSection from '../components/settings/SettingsMiembrosSection.vue';
import SettingsConceptosSection from '../components/settings/SettingsConceptosSection.vue';
import SettingsSplitSection from '../components/settings/SettingsSplitSection.vue';

const auth = useAuthStore();

const tabs = [
  { id: 'hogar', label: 'Hogar', icono: 'home' },
  { id: 'miembros', label: 'Miembros', icono: 'users' },
  { id: 'conceptos', label: 'Cuentas fijas', icono: 'repeat' },
  { id: 'split', label: 'Reparto', icono: 'sliders' },
];

const tabActivo = ref('hogar');

const canEdit = computed(() => Boolean(auth.usuario?.esAdmin || auth.usuario?.puedeEditarGastos));
</script>

<template>
  <AppLayout title="Configuración del hogar" subtitle="Miembros, cuentas fijas del hogar y reparto de gastos.">
    <div class="space-y-6 max-w-3xl">
      <div class="tabs" role="tablist" aria-label="Secciones de configuración">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="tab inline-flex items-center gap-2"
          :class="tabActivo === tab.id ? 'tab-active' : ''"
          :aria-selected="tabActivo === tab.id"
          @click="tabActivo = tab.id"
        >
          <AppIcon :name="tab.icono" class="h-4 w-4 shrink-0" />
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
