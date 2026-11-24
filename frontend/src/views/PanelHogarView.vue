<script setup>
import { ref } from 'vue';
import AppLayout from '../components/AppLayout.vue';
import AppIcon from '../components/AppIcon.vue';
import AppModal from '../components/AppModal.vue';
import PanelRecurrentesSection from '../components/hogar/PanelRecurrentesSection.vue';
import PanelVariablesSection from '../components/hogar/PanelVariablesSection.vue';
import ResumenHogarSection from '../components/hogar/ResumenHogarSection.vue';

const mostrarRecurrentes = ref(false);
</script>

<template>
  <AppLayout title="Hogar" subtitle="Gastos compartidos y balance entre los miembros.">
    <template #actions>
      <button class="btn-secondary" @click="mostrarRecurrentes = true">
        <AppIcon name="repeat" class="h-4 w-4" />
        Gastos recurrentes
      </button>
    </template>

    <div class="space-y-6">
      <ResumenHogarSection />
      <PanelVariablesSection />
    </div>

    <AppModal
      v-if="mostrarRecurrentes"
      title="Gastos recurrentes de este período"
      @close="mostrarRecurrentes = false"
    >
      <PanelRecurrentesSection />
    </AppModal>
  </AppLayout>
</template>
