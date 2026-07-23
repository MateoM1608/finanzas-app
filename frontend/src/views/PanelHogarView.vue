<script setup>
import { ref } from 'vue';
import AppHeader from '../components/AppHeader.vue';
import AppModal from '../components/AppModal.vue';
import PanelRecurrentesSection from '../components/hogar/PanelRecurrentesSection.vue';
import PanelVariablesSection from '../components/hogar/PanelVariablesSection.vue';
import ResumenHogarSection from '../components/hogar/ResumenHogarSection.vue';

const mostrarRecurrentes = ref(false);
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold text-ink-primary">Panel del hogar</h1>
          <p class="text-ink-secondary mt-1.5 text-sm">Gastos compartidos del hogar.</p>
        </div>
        <button class="btn-secondary" @click="mostrarRecurrentes = true">
          Ver gastos recurrentes
        </button>
      </div>

      <ResumenHogarSection />
      <PanelVariablesSection />
    </main>

    <AppModal
      v-if="mostrarRecurrentes"
      title="Gastos recurrentes de este período"
      @close="mostrarRecurrentes = false"
    >
      <PanelRecurrentesSection />
    </AppModal>
  </div>
</template>
