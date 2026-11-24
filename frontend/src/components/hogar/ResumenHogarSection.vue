<script setup>
import { ref, computed, onMounted } from 'vue';
import { Bar } from 'vue-chartjs';
import { obtenerResumenHogar } from '../../api/cortes.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';
import { useChartTheme } from '../../composables/useChartTheme.js';

const { paleta, opcionesBarras } = useChartTheme();

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

// Opciones reactivas al tema (claro/oscuro).
const chartOptionsConLeyenda = opcionesBarras({ conLeyenda: true });
const chartOptionsApilado = opcionesBarras({ apilado: true, conLeyenda: true });

const ESTILO_BARRA = { borderRadius: 6, maxBarThickness: 36, borderSkipped: false };

function etiquetaCorte(c) {
  return formatDate(c.fechaNominal) + (c.secuencia > 1 ? ' (compl.)' : '');
}

const serieCortesChart = computed(() => {
  const items = resumen.value?.serieCortes ?? [];
  return {
    labels: items.map(etiquetaCorte),
    datasets: [
      {
        label: 'Recurrentes',
        data: items.map((c) => c.totalRecurrentes),
        backgroundColor: paleta.value.series[0],
        stack: 'total',
        ...ESTILO_BARRA,
      },
      {
        label: 'Variables',
        data: items.map((c) => c.totalVariables),
        backgroundColor: paleta.value.soft,
        stack: 'total',
        ...ESTILO_BARRA,
      },
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
  const series = paleta.value.series;
  return {
    labels: items.map(etiquetaCorte),
    datasets: miembrosBalance.value.map((m, idx) => ({
      label: m.nombre,
      data: items.map((c) => c.balances.find((b) => b.usuarioId === m.usuarioId)?.balance ?? 0),
      backgroundColor: series[idx % series.length],
      ...ESTILO_BARRA,
    })),
  };
});

// KPIs de presentación, derivados de la misma serie que ya trae el resumen.
const ultimoCorte = computed(() => {
  const items = resumen.value?.serieCortes ?? [];
  if (!items.length) return null;
  const c = items[items.length - 1];
  return { ...c, total: c.totalRecurrentes + c.totalVariables };
});

const totalVentana = computed(() =>
  (resumen.value?.serieCortes ?? []).reduce((acc, c) => acc + c.totalRecurrentes + c.totalVariables, 0),
);
</script>

<template>
  <section class="space-y-4" aria-labelledby="resumen-hogar-titulo">
    <AlertError :message="error" />

    <div v-if="loading" class="card card-pad">
      <p class="text-sm text-ink-tertiary">Cargando resumen…</p>
    </div>

    <template v-else-if="resumen">
      <router-link
        v-if="resumen.hayCorteAbierto"
        :to="{ name: 'cortes' }"
        class="card flex items-center gap-3 px-4 py-3 sm:px-5 border-accent/30 bg-accent/10 hover:bg-accent/15 transition-colors"
      >
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-on">
          <AppIcon name="scale" class="h-4 w-4" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium text-ink-primary">Hay un corte abierto</span>
          <span class="block text-[13px] text-ink-secondary">Revísalo y confírmalo para liquidar los gastos.</span>
        </span>
        <AppIcon name="chevronRight" class="h-4 w-4 shrink-0 text-accent" />
      </router-link>

      <div v-if="!resumen.serieCortes.length" class="card card-pad">
        <h2 id="resumen-hogar-titulo" class="section-title">Resumen del hogar</h2>
        <div class="empty flex flex-col items-center gap-2">
          <AppIcon name="chart" class="h-6 w-6 text-ink-tertiary" />
          Todavía no hay cortes cerrados para mostrar.
        </div>
      </div>

      <template v-else>
        <h2 id="resumen-hogar-titulo" class="sr-only">Resumen del hogar</h2>

        <!-- KPIs -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <div class="card card-pad">
            <p class="stat-label flex items-center gap-1.5">
              <AppIcon name="calendar" class="h-3.5 w-3.5" />
              Último corte
            </p>
            <p class="stat-value mt-2">{{ formatCurrency(ultimoCorte.total) }}</p>
            <p class="text-[13px] text-ink-tertiary mt-1">{{ etiquetaCorte(ultimoCorte) }}</p>
          </div>
          <div class="card card-pad">
            <p class="stat-label flex items-center gap-1.5">
              <AppIcon name="receipt" class="h-3.5 w-3.5" />
              Total liquidado
            </p>
            <p class="stat-value mt-2">{{ formatCurrency(totalVentana) }}</p>
            <p class="text-[13px] text-ink-tertiary mt-1">
              En {{ resumen.serieCortes.length === 1 ? 'el último corte' : `los últimos ${resumen.serieCortes.length} cortes` }}
            </p>
          </div>
          <div v-for="pago in resumen.pagadoPorMiembro" :key="pago.nombre" class="card card-pad">
            <p class="stat-label flex items-center gap-1.5">
              <AppIcon name="wallet" class="h-3.5 w-3.5" />
              <span class="truncate">Pagó {{ pago.nombre }}</span>
            </p>
            <p class="stat-value mt-2">{{ formatCurrency(pago.total) }}</p>
            <p class="text-[13px] text-ink-tertiary mt-1">En los mismos cortes</p>
          </div>
        </div>

        <!-- Gráficos -->
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div class="card card-pad">
            <h3 class="section-title">Recurrentes vs. variables</h3>
            <p class="section-hint">Total liquidado en cada corte, por tipo de gasto.</p>
            <div class="h-60 mt-4">
              <Bar :data="serieCortesChart" :options="chartOptionsApilado" />
            </div>
          </div>
          <div class="card card-pad">
            <h3 class="section-title">Balance por miembro</h3>
            <p class="section-hint">Positivo: le deben. Negativo: debe a los demás.</p>
            <div class="h-60 mt-4">
              <Bar :data="balancesChart" :options="chartOptionsConLeyenda" />
            </div>
          </div>
        </div>
      </template>
    </template>
  </section>
</template>
