<script setup>
import AppHeader from '../components/AppHeader.vue';
import PanelRecurrentesSection from '../components/pareja/PanelRecurrentesSection.vue';
import PanelVariablesSection from '../components/pareja/PanelVariablesSection.vue';
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div>
        <h1 class="text-2xl font-semibold text-ink-primary">Panel de pareja</h1>
        <p class="text-ink-secondary mt-1.5 text-sm">Gastos compartidos del hogar.</p>
      </div>

      <PanelRecurrentesSection />
      <PanelVariablesSection />
    </main>
  </div>
</template>
