<script setup>
import { ref, computed, onMounted } from 'vue';
import { Bar } from 'vue-chartjs';
import { obtenerResumenHogar } from '../../api/cortes.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import AlertError from '../AlertError.vue';

const PALETA = ['#2F6FED', '#16A34A', '#F59E0B', '#DC2626', '#8B5CF6', '#0EA5E9'];

const loading = ref(true);
const error = ref('');
const resumen = ref(null);

async function cargar() {
  loading.value = true;
  error.value = '';
  try {
    resumen.value = await obtenerResumenHogar();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(cargar);

const chartOptionsConLeyenda = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
};
const chartOptionsApilado = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
  scales: { x: { stacked: true }, y: { stacked: true } },
};

const serieCortesChart = computed(() => {
  const items = resumen.value?.serieCortes ?? [];
  return {
    labels: items.map((c) => formatDate(c.fechaNominal) + (c.secuencia > 1 ? ' (compl.)' : '')),
    datasets: [
      { label: 'Recurrentes', data: items.map((c) => c.totalRecurrentes), backgroundColor: '#2F6FED', stack: 'total' },
      { label: 'Variables', data: items.map((c) => c.totalVariables), backgroundColor: '#93B4F5', stack: 'total' },
    ],
  };
});

const miembrosBalance = computed(() => {
  const nombres = new Map();
  for (const corte of resumen.value?.serieCortes ?? []) {
    for (const b of corte.balances) nombres.set(b.usuarioId, b.nombre);
  }
  return [...nombres.entries()].map(([usuarioId, nombre]) => ({ usuarioId, nombre }));
});

const balancesChart = computed(() => {
  const items = resumen.value?.serieCortes ?? [];
  return {
    labels: items.map((c) => formatDate(c.fechaNominal) + (c.secuencia > 1 ? ' (compl.)' : '')),
    datasets: miembrosBalance.value.map((m, idx) => ({
      label: m.nombre,
      data: items.map((c) => c.balances.find((b) => b.usuarioId === m.usuarioId)?.balance ?? 0),
      backgroundColor: PALETA[idx % PALETA.length],
    })),
  };
});
</script>

<template>
  <div class="card p-6 sm:p-8">
    <h2 class="text-base font-semibold text-ink-primary mb-5">Resumen del hogar</h2>

    <AlertError :message="error" />
    <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>

    <template v-else>
      <p v-if="resumen.hayCorteAbierto" class="text-sm text-accent mb-5">
        Hay un corte abierto —
        <router-link :to="{ name: 'cortes' }" class="underline">revísalo aquí</router-link>.
      </p>

      <div v-if="!resumen.serieCortes.length" class="text-sm text-ink-secondary">
        Todavía no hay cortes cerrados para mostrar.
      </div>
      <template v-else>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <p class="text-sm font-medium text-ink-primary mb-3">Recurrentes vs. variables por corte</p>
            <div class="h-56">
              <Bar :data="serieCortesChart" :options="chartOptionsApilado" />
            </div>
          </div>
          <div>
            <p class="text-sm font-medium text-ink-primary mb-3">Balance por miembro</p>
            <div class="h-56">
              <Bar :data="balancesChart" :options="chartOptionsConLeyenda" />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div v-for="pago in resumen.pagadoPorMiembro" :key="pago.nombre" class="bg-surface-raised rounded-xl p-4">
            <p class="text-xs text-ink-tertiary">Pagó {{ pago.nombre }}</p>
            <p class="text-ink-primary font-medium">{{ formatCurrency(pago.total) }}</p>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
