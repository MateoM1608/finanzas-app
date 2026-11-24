<script setup>
import { ref, computed, onMounted } from 'vue';
import { Bar, Doughnut } from 'vue-chartjs';
import { obtenerResumenPersonal } from '../../api/resumenPersonal.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { useChartTheme } from '../../composables/useChartTheme.js';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatPeriodo(periodo) {
  const [anio, mes] = periodo.split('-');
  return `${MESES_CORTOS[Number(mes) - 1]} ${anio.slice(2)}`;
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

const { paleta, opcionesBarras, opcionesDona } = useChartTheme();
const opcionesMensual = opcionesBarras();
const opcionesCategoria = opcionesDona();
const vistaGrafico = ref('mensual');

const pendientes = computed(() => {
  const items = resumen.value?.compromisosPendientes ?? [];
  const gastos = items.filter((c) => c.tipo === 'gasto');
  const ingresos = items.filter((c) => c.tipo !== 'gasto');
  return {
    total: items.length,
    porPagar: gastos.reduce((a, c) => a + c.monto, 0),
    porRecibir: ingresos.reduce((a, c) => a + c.monto, 0),
  };
});

const serieMensualChart = computed(() => ({
  labels: (resumen.value?.serieMensual ?? []).map((m) => formatPeriodo(m.periodo)),
  datasets: [
    {
      label: 'Gastos',
      data: (resumen.value?.serieMensual ?? []).map((m) => m.total),
      backgroundColor: paleta.value.series[0],
      hoverBackgroundColor: paleta.value.series[0],
      borderRadius: 6,
      maxBarThickness: 36,
    },
  ],
}));

const porCategoriaChart = computed(() => {
  const items = resumen.value?.porCategoria ?? [];
  const p = paleta.value;
  return {
    labels: items.map((i) => i.categoria),
    datasets: [
      {
        data: items.map((i) => i.total),
        backgroundColor: items.map((_, idx) => p.series[idx % p.series.length]),
        borderColor: p.surface,
        borderWidth: 3,
        hoverOffset: 4,
      },
    ],
  };
});
</script>

<template>
  <div class="space-y-6">
    <AlertError :message="error" />

    <!-- Esqueleto mientras carga -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-busy="true" aria-label="Cargando resumen">
      <div v-for="n in 3" :key="n" class="card card-pad h-[132px] animate-pulse">
        <div class="h-3 w-24 rounded bg-surface-sunken" />
        <div class="mt-4 h-8 w-40 rounded bg-surface-sunken" />
      </div>
    </div>

    <template v-else-if="resumen">
      <!-- Indicadores -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <section class="card card-pad relative overflow-hidden">
          <div class="pointer-events-none absolute inset-x-0 top-0 h-1 bg-accent" aria-hidden="true" />
          <div class="flex items-center justify-between">
            <p class="stat-label">Disponible</p>
            <span class="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
              <AppIcon name="wallet" class="h-4 w-4" />
            </span>
          </div>
          <p
            class="mt-3 text-[2rem] leading-none font-semibold tracking-tight"
            :class="resumen.disponible < 0 ? 'text-negative' : 'text-ink-primary'"
          >
            {{ formatCurrency(resumen.disponible) }}
          </p>
          <p class="mt-2.5 text-xs text-ink-tertiary">Ingresos recibidos menos gastos pagados</p>
        </section>

        <section class="card card-pad">
          <div class="flex items-center justify-between">
            <p class="stat-label">Neto de este ciclo</p>
            <span
              v-if="resumen.neto.variacionPct != null"
              class="badge"
              :class="resumen.neto.variacionPct >= 0 ? 'badge-positive' : 'badge-negative'"
            >
              <AppIcon :name="resumen.neto.variacionPct >= 0 ? 'trendingUp' : 'trendingDown'" class="h-3 w-3" :stroke-width="2.2" />
              {{ resumen.neto.variacionPct >= 0 ? '+' : '' }}{{ resumen.neto.variacionPct.toFixed(0) }}%
            </span>
          </div>
          <p
            class="mt-3 text-[2rem] leading-none font-semibold tracking-tight"
            :class="resumen.neto.actual < 0 ? 'text-negative' : 'text-ink-primary'"
          >
            {{ formatCurrency(resumen.neto.actual) }}
          </p>
          <p class="mt-2.5 text-xs text-ink-tertiary">
            Ciclo anterior: {{ formatCurrency(resumen.neto.anterior) }}
          </p>
        </section>

        <section class="card card-pad">
          <div class="flex items-center justify-between">
            <p class="stat-label">Pendientes</p>
            <span class="badge-neutral">{{ pendientes.total }}</span>
          </div>
          <div class="mt-3 space-y-1.5">
            <div class="flex items-baseline justify-between gap-3">
              <span class="whitespace-nowrap text-[13px] text-ink-secondary">Por pagar</span>
              <span class="whitespace-nowrap text-base font-semibold tracking-tight text-ink-primary">{{ formatCurrency(pendientes.porPagar) }}</span>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <span class="whitespace-nowrap text-[13px] text-ink-secondary">Por recibir</span>
              <span
                class="whitespace-nowrap text-base font-semibold tracking-tight"
                :class="pendientes.porRecibir > 0 ? 'text-positive' : 'text-ink-primary'"
              >{{ formatCurrency(pendientes.porRecibir) }}</span>
            </div>
          </div>
        </section>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <!-- Compromisos pendientes -->
        <section class="card card-pad xl:col-span-2 flex flex-col">
          <div class="mb-3">
            <h2 class="section-title">Compromisos pendientes</h2>
            <p class="section-hint">No afectan tu disponible hasta que los marques.</p>
          </div>
          <div v-if="!resumen.compromisosPendientes.length" class="flex-1 grid place-items-center">
            <div class="empty">
              <AppIcon name="check" class="mx-auto mb-2 h-6 w-6 text-positive" />
              Estás al día: no tienes pendientes.
            </div>
          </div>
          <ul v-else class="list -my-1 max-h-[320px] overflow-y-auto pr-1">
            <li v-for="c in resumen.compromisosPendientes" :key="`${c.tipo}-${c.id}`" class="list-row !py-3">
              <div class="flex min-w-0 items-center gap-3">
                <span
                  class="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                  :class="c.tipo === 'gasto' ? 'bg-negative/10 text-negative' : 'bg-positive/10 text-positive'"
                >
                  <AppIcon :name="c.tipo === 'gasto' ? 'arrowUpRight' : 'arrowDownLeft'" class="h-4 w-4" />
                </span>
                <div class="min-w-0">
                  <p class="flex items-center gap-1.5 text-sm font-medium text-ink-primary">
                    <span class="truncate">{{ c.descripcion || c.categoria || (c.tipo === 'gasto' ? 'Gasto personal' : 'Ingreso personal') }}</span>
                    <span v-if="c.esObligatorio" class="badge-accent shrink-0">Obligatorio</span>
                  </p>
                  <p class="truncate text-[13px] text-ink-tertiary">
                    {{ formatDate(c.fecha) }}<template v-if="c.descripcion && c.categoria"> · {{ c.categoria }}</template>
                  </p>
                </div>
              </div>
              <span class="shrink-0 whitespace-nowrap text-sm font-semibold" :class="c.tipo === 'gasto' ? 'text-ink-primary' : 'text-positive'">
                {{ c.tipo === 'gasto' ? '−' : '+' }}{{ formatCurrency(c.monto) }}
              </span>
            </li>
          </ul>
        </section>

        <!-- Gráficos -->
        <section class="card card-pad xl:col-span-3">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 class="section-title">Gastos</h2>
              <p class="section-hint">Pagados, últimos meses con movimientos.</p>
            </div>
            <div v-if="resumen.serieMensual.length" class="tabs" role="tablist" aria-label="Vista del gráfico">
              <button
                type="button"
                role="tab"
                class="tab"
                :class="{ 'tab-active': vistaGrafico === 'mensual' }"
                :aria-selected="vistaGrafico === 'mensual'"
                @click="vistaGrafico = 'mensual'"
              >
                Por mes
              </button>
              <button
                type="button"
                role="tab"
                class="tab"
                :class="{ 'tab-active': vistaGrafico === 'categoria' }"
                :aria-selected="vistaGrafico === 'categoria'"
                @click="vistaGrafico = 'categoria'"
              >
                Por categoría
              </button>
            </div>
          </div>

          <div v-if="!resumen.serieMensual.length" class="empty h-60 grid place-items-center">
            <div>
              <AppIcon name="chart" class="mx-auto mb-2 h-6 w-6" />
              Aún no hay gastos pagados para graficar.
            </div>
          </div>
          <div v-else class="h-60">
            <Bar v-if="vistaGrafico === 'mensual'" :data="serieMensualChart" :options="opcionesMensual" />
            <Doughnut v-else :data="porCategoriaChart" :options="opcionesCategoria" />
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
