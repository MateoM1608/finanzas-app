<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import AppLayout from '../components/AppLayout.vue';
import AppIcon from '../components/AppIcon.vue';
import SettingsHogarSection from '../components/settings/SettingsHogarSection.vue';
import SettingsMiembrosSection from '../components/settings/SettingsMiembrosSection.vue';
import SettingsConceptosSection from '../components/settings/SettingsConceptosSection.vue';
import SettingsSplitSection from '../components/settings/SettingsSplitSection.vue';
import SettingsCategoriasSection from '../components/settings/SettingsCategoriasSection.vue';
import SettingsCuentaSection from '../components/settings/SettingsCuentaSection.vue';
import ExportarDatos from '../components/ExportarDatos.vue';

const auth = useAuthStore();

const tabs = [
  { id: 'hogar', label: 'Hogar', icono: 'home' },
  { id: 'miembros', label: 'Miembros', icono: 'users' },
  { id: 'conceptos', label: 'Cuentas fijas', icono: 'repeat' },
  { id: 'categorias', label: 'Categorías y topes', icono: 'gauge' },
  { id: 'split', label: 'Reparto', icono: 'sliders' },
  { id: 'exportar', label: 'Exportar', icono: 'arrowDownLeft' },
  { id: 'cuenta', label: 'Tu cuenta', icono: 'settings' },
];

// ?tab=categorias abre esa pestaña (desde las tarjetas de topes del hogar).
const route = useRoute();
const tabActivo = ref(tabs.some((t) => t.id === route.query.tab) ? route.query.tab : 'hogar');
const tabsRef = ref(null);
// En celular las pestañas se desplazan: la elegida por ?tab= queda a la vista.
onMounted(() => tabsRef.value?.querySelector('.tab-active')?.scrollIntoView({ inline: 'center', block: 'nearest' }));

const canEdit = computed(() => Boolean(auth.usuario?.esAdmin || auth.usuario?.puedeEditarGastos));
</script>

<template>
  <AppLayout title="Configuración del hogar" subtitle="Miembros, cuentas fijas, categorías y topes del hogar y reparto de gastos.">
    <div class="space-y-6 max-w-3xl">
      <div ref="tabsRef" class="tabs" role="tablist" aria-label="Secciones de configuración">
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
      <SettingsCategoriasSection v-else-if="tabActivo === 'categorias'" :can-edit="canEdit" />
      <SettingsSplitSection v-else-if="tabActivo === 'split'" :can-edit="canEdit" />
      <SettingsCuentaSection v-else-if="tabActivo === 'cuenta'" />
      <section v-else-if="tabActivo === 'exportar'" class="card card-pad">
        <h2 class="section-title">Exportar tus datos</h2>
        <p class="section-hint mb-4">Descarga tus movimientos y los del hogar para guardarlos o analizarlos en una hoja de cálculo.</p>
        <ExportarDatos />
      </section>
    </div>
  </AppLayout>
</template>
