<script setup>
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppLayout from '../components/AppLayout.vue';
import AppIcon from '../components/AppIcon.vue';
import PerfilSection from '../components/cuenta/PerfilSection.vue';
import SeguridadSection from '../components/cuenta/SeguridadSection.vue';
import ExportarDatos from '../components/ExportarDatos.vue';

/**
 * Cuenta: lo tuyo como usuario, sin importar el hogar ni el panel personal.
 * Perfil (nombre, hogar, apariencia), Seguridad (contraseña, códigos de
 * recuperación, sesiones) y Exportar datos. ?tab= abre una pestaña.
 */
const tabs = [
  { id: 'perfil', label: 'Perfil', icono: 'user' },
  { id: 'seguridad', label: 'Seguridad', icono: 'lock' },
  { id: 'exportar', label: 'Exportar datos', icono: 'arrowDownLeft' },
];

const route = useRoute();
const router = useRouter();
const desdeQuery = () => (tabs.some((t) => t.id === route.query.tab) ? route.query.tab : 'perfil');
const tabActivo = ref(desdeQuery());
watch(() => route.query.tab, () => {
  tabActivo.value = desdeQuery();
});
function elegir(id) {
  tabActivo.value = id;
  router.replace({ query: { ...route.query, tab: id } });
}
</script>

<template>
  <AppLayout title="Cuenta" subtitle="Tu perfil, la seguridad de tu cuenta y tus datos.">
    <div class="space-y-6 max-w-3xl">
      <div class="tabs" role="tablist" aria-label="Secciones de tu cuenta">
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

      <PerfilSection v-if="tabActivo === 'perfil'" />
      <SeguridadSection v-else-if="tabActivo === 'seguridad'" />
      <section v-else class="card card-pad">
        <h2 class="section-title">Exportar tus datos</h2>
        <p class="section-hint mb-4">Descarga tus movimientos y los del hogar para guardarlos o analizarlos en una hoja de cálculo.</p>
        <ExportarDatos />
      </section>
    </div>
  </AppLayout>
</template>
