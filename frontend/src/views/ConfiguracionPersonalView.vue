<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppLayout from '../components/AppLayout.vue';
import AppIcon from '../components/AppIcon.vue';
import ConfiguracionPersonalSection from '../components/personal/ConfiguracionPersonalSection.vue';

// Configuración personal (?tab=ciclo, metodos, categorias, gastosFijos, ingresosFijos, ahorros, limites).
const route = useRoute();
const tab = computed(() => (typeof route.query.tab === 'string' ? route.query.tab : 'ciclo'));
</script>

<template>
  <AppLayout title="Configuración personal" subtitle="Ciclo, cuentas, categorías, fijos, metas y límites.">
    <template #actions>
      <router-link :to="{ name: 'analisis' }" class="btn-secondary">
        <AppIcon name="chevronLeft" class="h-4 w-4" />
        Análisis
      </router-link>
    </template>
    <section class="card card-pad">
      <ConfiguracionPersonalSection :key="tab" :tab-inicial="tab" />
    </section>
  </AppLayout>
</template>
