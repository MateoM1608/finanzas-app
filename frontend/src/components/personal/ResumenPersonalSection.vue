<script setup>
import { ref, computed, onMounted } from 'vue';
import { Bar, Doughnut } from 'vue-chartjs';
import { obtenerResumenPersonal } from '../../api/resumenPersonal.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import AlertError from '../AlertError.vue';

const PALETA = ['#2F6FED', '#16A34A', '#F59E0B', '#DC2626', '#8B5CF6', '#0EA5E9'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatPeriodo(periodo) {
  const [anio, mes] = periodo.split('-');
  return `${MESES_CORTOS[Number(mes) - 1]} ${anio}`;
}

const loading = ref(true);
const error = ref('');
const resumen = ref(null);

async function cargar() {
  loading.value = true;
  error.value = '';
  try {
    resumen.value = await obtenerResumenPersonal();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(cargar);
defineExpose({ recargar: cargar });

const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };
const chartOptionsConLeyenda = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
};

const serieMensualChart = computed(() => ({
  labels: (resumen.value?.serieMensual ?? []).map((m) => formatPeriodo(m.periodo)),
  datasets: [
    {
      label: 'Gastos personales',
      data: (resumen.value?.serieMensual ?? []).map((m) => m.total),
      backgroundColor: '#2F6FED',
      borderRadius: 6,
    },
  ],
}));

const porCategoriaChart = computed(() => {
  const items = resumen.value?.porCategoria ?? [];
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
</script>

<template>
  <div>
    <AlertError :message="error" />
    <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <section class="card p-8">
          <p class="text-sm text-ink-secondary mb-2">Disponible</p>
          <p class="text-3xl font-semibold text-ink-primary tracking-tight">
            {{ formatCurrency(resumen.disponible) }}
          </p>
          <p class="text-xs text-ink-tertiary mt-1.5">Ingresos recibidos menos gastos pagados, histórico</p>
        </section>
        <section class="card p-8">
          <p class="text-sm text-ink-secondary mb-2">Neto de este ciclo</p>
          <p class="text-3xl font-semibold text-ink-primary tracking-tight">
            {{ formatCurrency(resumen.neto.actual) }}
          </p>
          <p
            v-if="resumen.neto.variacionPct != null"
            class="text-xs mt-1.5"
            :class="resumen.neto.variacionPct >= 0 ? 'text-positive' : 'text-negative'"
          >
            {{ resumen.neto.variacionPct >= 0 ? '+' : '' }}{{ resumen.neto.variacionPct.toFixed(0) }}% vs. ciclo
            anterior ({{ formatCurrency(resumen.neto.anterior) }})
          </p>
        </section>
      </div>

      <section class="card p-6 sm:p-8 mb-6">
        <h2 class="text-base font-semibold text-ink-primary mb-5">Compromisos pendientes</h2>
        <p v-if="!resumen.compromisosPendientes.length" class="text-sm text-ink-secondary">
          No tienes gastos ni ingresos pendientes.
        </p>
        <ul v-else class="divide-y divide-border">
          <li
            v-for="c in resumen.compromisosPendientes"
            :key="`${c.tipo}-${c.id}`"
            class="py-3 flex items-center justify-between gap-4"
          >
            <div>
              <p class="text-ink-primary font-medium">
                {{ c.descripcion || c.categoria || (c.tipo === 'gasto' ? 'Gasto personal' : 'Ingreso personal') }}
                <span v-if="c.esObligatorio" class="text-xs text-accent">obligatorio</span>
              </p>
              <p class="text-sm text-ink-tertiary">
                {{ formatDate(c.fecha) }}<template v-if="c.descripcion && c.categoria"> · {{ c.categoria }}</template>
              </p>
            </div>
            <span class="font-medium shrink-0" :class="c.tipo === 'gasto' ? 'text-negative' : 'text-positive'">
              {{ c.tipo === 'gasto' ? '−' : '+' }}{{ formatCurrency(c.monto) }}
            </span>
          </li>
        </ul>
      </section>

      <section class="card p-6 sm:p-8">
        <h2 class="text-base font-semibold text-ink-primary mb-5">Gastos personales</h2>
        <div v-if="!resumen.serieMensual.length" class="text-sm text-ink-secondary">
          Aún no hay gastos personales pagados.
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
    </template>
  </div>
</template>
