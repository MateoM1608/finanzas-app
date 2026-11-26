<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import AppLayout from '../components/AppLayout.vue';
import AppIcon from '../components/AppIcon.vue';
import SettingsHogarSection from '../components/settings/SettingsHogarSection.vue';
import SettingsMiembrosSection from '../components/settings/SettingsMiembrosSection.vue';
import SettingsConceptosSection from '../components/settings/SettingsConceptosSection.vue';
import SettingsSplitSection from '../components/settings/SettingsSplitSection.vue';
import SettingsCategoriasSection from '../components/settings/SettingsCategoriasSection.vue';

/**
 * Configuración del hogar (dentro de Hogar, como la personal vive dentro de
 * Personal): datos y salida del hogar, miembros, cuentas fijas, categorías y
 * topes, y reparto. ?tab= abre una pestaña (desde "Configurar" en Panel del hogar).
 */
const auth = useAuthStore();

const tabs = [
  { id: 'hogar', label: 'Hogar', icono: 'home' },
  { id: 'miembros', label: 'Miembros', icono: 'users' },
  { id: 'conceptos', label: 'Cuentas fijas', icono: 'repeat' },
  { id: 'categorias', label: 'Categorías y topes', icono: 'gauge' },
  { id: 'split', label: 'Reparto', icono: 'sliders' },
];

const route = useRoute();
const router = useRouter();
const desdeQuery = () => (tabs.some((t) => t.id === route.query.tab) ? route.query.tab : 'hogar');
const tabActivo = ref(desdeQuery());
const tabsRef = ref(null);
// En celular las pestañas se desplazan: la elegida por ?tab= queda a la vista.
onMounted(() => tabsRef.value?.querySelector('.tab-active')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
watch(() => route.query.tab, () => {
  tabActivo.value = desdeQuery();
});
function elegir(id) {
  tabActivo.value = id;
  router.replace({ query: { ...route.query, tab: id } });
}

const canEdit = computed(() => Boolean(auth.usuario?.esAdmin || auth.usuario?.puedeEditarGastos));
</script>

<template>
  <AppLayout title="Configuración del hogar" subtitle="Miembros, cuentas fijas, categorías y topes, y reparto de gastos.">
    <template #actions>
      <router-link :to="{ name: 'panel-hogar' }" class="btn-secondary">
        <AppIcon name="chevronLeft" class="h-4 w-4" />
        Volver a Hogar
      </router-link>
    </template>

    <div class="space-y-6 max-w-3xl">
      <div ref="tabsRef" class="tabs" role="tablist" aria-label="Secciones de la configuración del hogar">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="tab inline-flex items-center gap-2"
          :class="tabActivo === tab.id ? 'tab-active' : ''"
          :aria-selected="tabActivo === tab.id"
          @click="elegir(tab.id)"
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
    </div>
  </AppLayout>
</template>
