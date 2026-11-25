<script setup>
import { ref } from 'vue';
import AppLayout from '../components/AppLayout.vue';
import AppIcon from '../components/AppIcon.vue';
import SaldoHogarSection from '../components/hogar/SaldoHogarSection.vue';
import CuentasFijasHogarSection from '../components/hogar/CuentasFijasHogarSection.vue';
import PanelVariablesSection from '../components/hogar/PanelVariablesSection.vue';
import ResumenHogarSection from '../components/hogar/ResumenHogarSection.vue';
import MetasHogarSection from '../components/hogar/MetasHogarSection.vue';
import AvisosPagar from '../components/AvisosPagar.vue';
import ActividadHogarSection from '../components/hogar/ActividadHogarSection.vue';
import TopesHogarSection from '../components/hogar/TopesHogarSection.vue';

const saldoRef = ref(null);
const resumenRef = ref(null);
const avisosRef = ref(null);
const actividadRef = ref(null);
const topesRef = ref(null);

// Pagar una cuenta o registrar un gasto mueve el saldo y el informe.
function onCambio() {
  saldoRef.value?.recargar();
  resumenRef.value?.recargar();
  avisosRef.value?.recargar();
  actividadRef.value?.recargar();
  topesRef.value?.recargar();
}
</script>

<template>
  <AppLayout title="Hogar" subtitle="Gastos compartidos y quién le debe a quién.">
    <template #actions>
      <router-link :to="{ name: 'cuadres' }" class="btn-secondary">
        <AppIcon name="scale" class="h-4 w-4" />
        Cuadres
      </router-link>
    </template>

    <div class="space-y-6">
      <AvisosPagar ref="avisosRef" ambito="hogar" />
      <SaldoHogarSection ref="saldoRef" />
      <TopesHogarSection ref="topesRef" />
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <CuentasFijasHogarSection @cambio="onCambio" />
        <PanelVariablesSection @cambio="onCambio" />
      </div>
      <MetasHogarSection />
      <ActividadHogarSection ref="actividadRef" />
      <ResumenHogarSection ref="resumenRef" />
    </div>
  </AppLayout>
</template>
