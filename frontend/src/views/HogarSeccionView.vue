<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppLayout from '../components/AppLayout.vue';
import AppIcon from '../components/AppIcon.vue';
import CuentasFijasHogarSection from '../components/hogar/CuentasFijasHogarSection.vue';
import PanelVariablesSection from '../components/hogar/PanelVariablesSection.vue';
import ResumenHogarSection from '../components/hogar/ResumenHogarSection.vue';
import MetasHogarSection from '../components/hogar/MetasHogarSection.vue';
import ActividadHogarSection from '../components/hogar/ActividadHogarSection.vue';
import TopesHogarSection from '../components/hogar/TopesHogarSection.vue';
import { SECCIONES_HOGAR } from '../utils/seccionesHogar.js';

// Una parte del hogar en su propia página: /hogar/cuentas, /hogar/gastos…
const COMPONENTES = {
  cuentas: CuentasFijasHogarSection,
  gastos: PanelVariablesSection,
  topes: TopesHogarSection,
  metas: MetasHogarSection,
  informe: ResumenHogarSection,
  actividad: ActividadHogarSection,
};

const route = useRoute();
const seccion = computed(() => SECCIONES_HOGAR.find((s) => s.id === route.params.seccion) ?? SECCIONES_HOGAR[0]);
const componente = computed(() => COMPONENTES[seccion.value.id]);
</script>

<template>
  <AppLayout :title="seccion.titulo">
    <template #actions>
      <router-link :to="{ name: 'panel-hogar' }" class="btn-secondary">
        <AppIcon name="chevronLeft" class="h-4 w-4" />
        Hogar
      </router-link>
    </template>
    <component :is="componente" :key="seccion.id" />
  </AppLayout>
</template>
