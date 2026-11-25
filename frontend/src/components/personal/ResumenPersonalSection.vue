<script setup>
import { ref, computed, watch } from 'vue';
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

// ciclo: 0 = el actual, -1 = el anterior… (navegación de Panel personal).
const props = defineProps({ ciclo: { type: Number, default: 0 } });
// Avisa al panel el rango del ciclo cargado (para el título y el filtro de movimientos).
const emit = defineEmits(['ciclo']);

const loading = ref(true);
const error = ref('');
const resumen = ref(null);
const esActual = computed(() => props.ciclo === 0);

async function cargar() {
  loading.value = true;
  error.value = '';
  try {
    resumen.value = await obtenerResumenPersonal(props.ciclo);
    emit('ciclo', resumen.value.ciclo);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
watch(() => props.ciclo, cargar, { immediate: true });
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
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4" aria-busy="true" aria-label="Cargando resumen">
      <div v-for="n in 3" :key="n" class="card card-pad h-[104px] sm:h-[132px] animate-pulse" :class="{ 'col-span-2 sm:col-span-1': n === 1 }">
        <div class="h-3 w-24 rounded bg-surface-sunken" />
        <div class="mt-4 h-8 w-40 rounded bg-surface-sunken" />
      </div>
    </div>

    <template v-else-if="resumen">
      <!-- Indicadores -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <section class="card card-pad relative overflow-hidden col-span-2 sm:col-span-1">
          <div class="pointer-events-none absolute inset-x-0 top-0 h-1 bg-accent" aria-hidden="true" />
          <div class="flex items-center justify-between">
            <p class="stat-label">{{ esActual ? 'Disponible' : 'Disponible al cierre' }}</p>
            <span class="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
              <AppIcon name="wallet" class="h-4 w-4" />
            </span>
          </div>
          <p class="stat-value-lg" :class="resumen.disponible < 0 ? 'text-negative' : 'text-ink-primary'">
            {{ formatCurrency(resumen.disponible) }}
          </p>
          <p class="stat-hint">
            <template v-if="esActual">Lo que entró menos lo que salió. Las compras con tarjeta de crédito cuentan al pagar la tarjeta.</template>
            <template v-else>Lo que tenías el último día de ese ciclo.</template>
          </p>
          <router-link
            v-if="resumen.deudaTarjetas > 0"
            :to="{ name: 'tarjetas' }"
            class="mt-2 flex items-center justify-between gap-2 rounded-lg text-[13px] hover:underline"
          >
            <span class="text-ink-secondary">{{ esActual ? 'Deuda de tarjetas' : 'Deuda de tarjetas al cierre' }}</span>
            <span class="font-semibold text-warning">{{ formatCurrency(resumen.deudaTarjetas) }}</span>
          </router-link>
          <router-link
            v-if="resumen.patrimonio && (resumen.patrimonio.ahorros || resumen.patrimonio.inversiones || resumen.patrimonio.prestamos || resumen.patrimonio.metasHogar)"
            :to="{ name: 'patrimonio' }"
            class="mt-1.5 flex items-center justify-between gap-2 rounded-lg text-[13px] hover:underline"
          >
            <span class="text-ink-secondary">Patrimonio</span>
            <span class="font-semibold" :class="resumen.patrimonio.total < 0 ? 'text-negative' : 'text-ink-primary'">{{
              formatCurrency(resumen.patrimonio.total)
            }}</span>
          </router-link>
        </section>

        <section class="card card-pad">
          <div class="flex items-center justify-between">
            <p class="stat-label">
              <span class="sm:hidden">Neto</span>
              <span class="hidden sm:inline">{{ esActual ? 'Neto de este ciclo' : 'Neto del ciclo' }}</span>
            </p>
            <span
              v-if="resumen.neto.variacionPct != null"
              class="badge"
              :class="resumen.neto.variacionPct >= 0 ? 'badge-positive' : 'badge-negative'"
            >
              <AppIcon :name="resumen.neto.variacionPct >= 0 ? 'trendingUp' : 'trendingDown'" class="h-3 w-3" :stroke-width="2.2" />
              {{ resumen.neto.variacionPct >= 0 ? '+' : '' }}{{ resumen.neto.variacionPct.toFixed(0) }}%
            </span>
          </div>
          <p class="stat-value" :class="resumen.neto.actual < 0 ? 'text-negative' : 'text-ink-primary'">
            {{ formatCurrency(resumen.neto.actual) }}
          </p>
          <p class="mt-1.5 sm:mt-2.5 text-[11px] sm:text-xs text-ink-tertiary">
            <span class="sm:hidden">Anterior:</span><span class="hidden sm:inline">Ciclo anterior:</span> {{ formatCurrency(resumen.neto.anterior) }}
          </p>
        </section>

        <section class="card card-pad">
          <div class="flex items-center justify-between">
            <p class="stat-label">{{ esActual ? 'Pendientes' : 'Quedaron pendientes' }}</p>
            <span class="badge-neutral">{{ pendientes.total }}</span>
          </div>
          <div class="mt-2 sm:mt-3 space-y-1 sm:space-y-1.5">
            <div class="flex items-baseline justify-between gap-3">
              <span class="whitespace-nowrap text-xs sm:text-[13px] text-ink-secondary">Por pagar</span>
              <span class="whitespace-nowrap text-sm sm:text-base font-semibold tracking-tight text-ink-primary">{{ formatCurrency(pendientes.porPagar) }}</span>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <span class="whitespace-nowrap text-xs sm:text-[13px] text-ink-secondary">Por recibir</span>
              <span
                class="whitespace-nowrap text-sm sm:text-base font-semibold tracking-tight"
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
            <p class="section-hint">
              {{ esActual ? 'No afectan tu disponible hasta que los marques.' : 'Los de ese ciclo que siguen sin pagar o sin recibir.' }}
            </p>
          </div>
          <div v-if="!resumen.compromisosPendientes.length" class="flex-1 grid place-items-center">
            <div class="empty">
              <AppIcon name="check" class="mx-auto mb-2 h-6 w-6 text-positive" />
              {{ esActual ? 'Estás al día: no tienes pendientes.' : 'Nada de ese ciclo quedó pendiente.' }}
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
              <p class="section-hint">
                Lo que gastaste tú, con tu parte del hogar: {{ vistaGrafico === 'mensual' ? 'últimos meses' : 'en este ciclo' }}.
              </p>
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
            <template v-else>
              <Doughnut v-if="resumen.porCategoria.length" :data="porCategoriaChart" :options="opcionesCategoria" />
              <div v-else class="empty h-full grid place-items-center">No hay gastos en este ciclo.</div>
            </template>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
