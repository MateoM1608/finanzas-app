<script setup>
import { ref, computed, onMounted } from 'vue';
import { Bar, Doughnut } from 'vue-chartjs';
import { obtenerDashboardPersonal, obtenerDashboardHogar } from '../api/dashboard.js';
import { extractErrorMessage } from '../api/client.js';
import { formatCurrency, formatDate } from '../utils/format.js';
import AppHeader from '../components/AppHeader.vue';
import AlertError from '../components/AlertError.vue';

const PALETA = ['#2F6FED', '#16A34A', '#F59E0B', '#DC2626', '#8B5CF6', '#0EA5E9'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatPeriodo(periodo) {
  const [anio, mes] = periodo.split('-');
  return `${MESES_CORTOS[Number(mes) - 1]} ${anio}`;
}

const loading = ref(true);
const error = ref('');
const personal = ref(null);
const hogar = ref(null);

async function cargar() {
  loading.value = true;
  error.value = '';
  try {
    const [datosPersonal, datosHogar] = await Promise.all([
      obtenerDashboardPersonal(),
      obtenerDashboardHogar(),
    ]);
    personal.value = datosPersonal;
    hogar.value = datosHogar;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

onMounted(cargar);

const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };
const chartOptionsConLeyenda = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
};

const serieMensualChart = computed(() => ({
  labels: (personal.value?.serieMensual ?? []).map((m) => formatPeriodo(m.periodo)),
  datasets: [
    {
      label: 'Gastos personales',
      data: (personal.value?.serieMensual ?? []).map((m) => m.total),
      backgroundColor: '#2F6FED',
      borderRadius: 6,
    },
  ],
}));

const porCategoriaChart = computed(() => {
  const items = personal.value?.porCategoria ?? [];
  return {
    labels: items.map((i) => i.categoria),
    datasets: [
      {
        data: items.map((i) => i.total),
        backgroundColor: items.map((_, idx) => PALETA[idx % PALETA.length]),
        borderWidth: 0,
      },
    ],
  };
});

const serieCortesChart = computed(() => {
  const items = hogar.value?.serieCortes ?? [];
  return {
    labels: items.map((c) => formatDate(c.fechaNominal)),
    datasets: [
      { label: 'Recurrentes', data: items.map((c) => c.totalRecurrentes), backgroundColor: '#2F6FED', stack: 'total' },
      { label: 'Variables', data: items.map((c) => c.totalVariables), backgroundColor: '#93B4F5', stack: 'total' },
    ],
  };
});

const chartOptionsApilado = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
  scales: { x: { stacked: true }, y: { stacked: true } },
};

const miembrosBalance = computed(() => {
  const nombres = new Map();
  for (const corte of hogar.value?.serieCortes ?? []) {
    for (const b of corte.balances) nombres.set(b.usuarioId, b.nombre);
  }
  return [...nombres.entries()].map(([usuarioId, nombre]) => ({ usuarioId, nombre }));
});

const balancesChart = computed(() => {
  const items = hogar.value?.serieCortes ?? [];
  return {
    labels: items.map((c) => formatDate(c.fechaNominal)),
    datasets: miembrosBalance.value.map((m, idx) => ({
      label: m.nombre,
      data: items.map((c) => c.balances.find((b) => b.usuarioId === m.usuarioId)?.balance ?? 0),
      backgroundColor: PALETA[idx % PALETA.length],
    })),
  };
});
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 class="text-2xl font-semibold text-ink-primary">Dashboard</h1>
        <p class="text-ink-secondary mt-1.5 text-sm">Resumen visual de tus finanzas y las del hogar.</p>
      </div>

      <AlertError :message="error" />
      <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>

      <template v-else>
        <section class="card p-6 sm:p-8">
          <h2 class="text-base font-semibold text-ink-primary mb-5">Panel personal</h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div class="bg-surface-raised rounded-xl p-5">
              <p class="text-sm text-ink-secondary mb-1">Este mes</p>
              <p class="text-2xl font-semibold text-ink-primary">
                {{ formatCurrency(personal.resumen.totalMesActual) }}
              </p>
              <p
                v-if="personal.resumen.variacionPct != null"
                class="text-sm mt-1"
                :class="personal.resumen.variacionPct > 0 ? 'text-negative' : 'text-positive'"
              >
                {{ personal.resumen.variacionPct > 0 ? '+' : '' }}{{ personal.resumen.variacionPct.toFixed(0) }}%
                vs. mes anterior
              </p>
            </div>
            <div class="bg-surface-raised rounded-xl p-5">
              <p class="text-sm text-ink-secondary mb-1">Mes anterior</p>
              <p class="text-2xl font-semibold text-ink-primary">
                {{ formatCurrency(personal.resumen.totalMesAnterior) }}
              </p>
            </div>
          </div>

          <div v-if="!personal.serieMensual.length" class="text-sm text-ink-secondary">
            Aún no hay gastos personales registrados.
          </div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p class="text-sm font-medium text-ink-primary mb-3">Gasto mensual</p>
              <div class="h-56">
                <Bar :data="serieMensualChart" :options="chartOptions" />
              </div>
            </div>
            <div>
              <p class="text-sm font-medium text-ink-primary mb-3">Por categoría</p>
              <div class="h-56">
                <Doughnut :data="porCategoriaChart" :options="chartOptionsConLeyenda" />
              </div>
            </div>
          </div>
        </section>

        <section class="card p-6 sm:p-8">
          <h2 class="text-base font-semibold text-ink-primary mb-5">Panel del hogar</h2>

          <p v-if="hogar.hayCorteAbierto" class="text-sm text-accent mb-5">
            Hay un corte abierto —
            <router-link :to="{ name: 'cortes' }" class="underline">revísalo aquí</router-link>.
          </p>

          <div v-if="!hogar.serieCortes.length" class="text-sm text-ink-secondary">
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
              <div v-for="pago in hogar.pagadoPorMiembro" :key="pago.nombre" class="bg-surface-raised rounded-xl p-4">
                <p class="text-xs text-ink-tertiary">Pagó {{ pago.nombre }}</p>
                <p class="text-ink-primary font-medium">{{ formatCurrency(pago.total) }}</p>
              </div>
            </div>
          </template>
        </section>
      </template>
    </main>
  </div>
</template>
