<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { Bar } from 'vue-chartjs';
import { obtenerResumenHogar } from '../../api/cuadres.js';
import { gastoPorCategoriaHogar } from '../../api/categoriasHogar.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';
import { useChartTheme } from '../../composables/useChartTheme.js';

/**
 * Informe del hogar por mes calendario, según la fecha de cada gasto pagado
 * (no según cuándo se cuadró).
 */
const { paleta, opcionesBarras } = useChartTheme();

const loading = ref(true);
const error = ref('');
const resumen = ref(null);

// Gasto por categoría de un mes (E4).
const mesCategorias = ref('');
const porCategoria = ref(null);

async function cargarCategorias() {
  try {
    porCategoria.value = await gastoPorCategoriaHogar(mesCategorias.value || undefined);
  } catch {
    // Informativo.
  }
}
watch(mesCategorias, cargarCategorias);

async function cargar() {
  error.value = '';
  cargarCategorias();
  try {
    resumen.value = await obtenerResumenHogar();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(cargar);
defineExpose({ recargar: cargar });

const opcionesApilado = opcionesBarras({ apilado: true, conLeyenda: true });
const ESTILO_BARRA = { borderRadius: 6, maxBarThickness: 36, borderSkipped: false };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function etiquetaMes(periodo) {
  const [anio, mes] = periodo.split('-');
  return `${MESES[Number(mes) - 1]} ${anio.slice(2)}`;
}

const serie = computed(() => resumen.value?.serieMensual ?? []);

const chartData = computed(() => ({
  labels: serie.value.map((m) => etiquetaMes(m.periodo)),
  datasets: [
    {
      label: 'Cuentas fijas',
      data: serie.value.map((m) => m.totalCuentasFijas),
      backgroundColor: paleta.value.series[0],
      stack: 'total',
      ...ESTILO_BARRA,
    },
    {
      label: 'Variables',
      data: serie.value.map((m) => m.totalVariables),
      backgroundColor: paleta.value.soft,
      stack: 'total',
      ...ESTILO_BARRA,
    },
  ],
}));

function claveMesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const esteMes = computed(() => {
  const fila = serie.value.find((m) => m.periodo === claveMesActual());
  return fila ? fila.totalCuentasFijas + fila.totalVariables : 0;
});
const mesesParaCategorias = computed(() => {
  const actual = claveMesActual();
  const meses = new Set([actual, ...serie.value.map((m) => m.periodo)]);
  return [...meses].sort().reverse();
});

const totalVentana = computed(() => serie.value.reduce((acc, m) => acc + m.totalCuentasFijas + m.totalVariables, 0));
</script>

<template>
  <section class="space-y-4" aria-labelledby="resumen-hogar-titulo">
    <h2 id="resumen-hogar-titulo" class="sr-only">Informe del hogar</h2>
    <AlertError :message="error" />

    <div v-if="loading" class="card card-pad">
      <p class="text-sm text-ink-tertiary">Cargando informe…</p>
    </div>

    <template v-else-if="resumen">
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div class="card card-pad">
          <p class="stat-label flex items-center gap-1.5">
            <AppIcon name="calendar" class="h-3.5 w-3.5" />
            Gastado este mes
          </p>
          <p class="stat-value mt-2">{{ formatCurrency(esteMes) }}</p>
          <p class="text-[13px] text-ink-tertiary mt-1">Cuentas fijas y variables pagadas</p>
        </div>
        <div class="card card-pad">
          <p class="stat-label flex items-center gap-1.5">
            <AppIcon name="receipt" class="h-3.5 w-3.5" />
            Últimos 6 meses
          </p>
          <p class="stat-value mt-2">{{ formatCurrency(totalVentana) }}</p>
          <p class="text-[13px] text-ink-tertiary mt-1">
            {{ serie.length }} {{ serie.length === 1 ? 'mes' : 'meses' }} con movimientos
          </p>
        </div>
        <div v-for="pago in resumen.pagadoPorMiembro" :key="pago.nombre" class="card card-pad">
          <p class="stat-label flex items-center gap-1.5">
            <AppIcon name="wallet" class="h-3.5 w-3.5" />
            <span class="truncate">Pagó {{ pago.nombre }}</span>
          </p>
          <p class="stat-value mt-2">{{ formatCurrency(pago.total) }}</p>
          <p class="text-[13px] text-ink-tertiary mt-1">En los últimos 6 meses</p>
        </div>
      </div>

      <div class="card card-pad">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="section-title">Gasto del hogar por mes</h3>
            <p class="section-hint">Según la fecha de cada gasto, sin importar cuándo se cuadró.</p>
          </div>
          <p v-if="resumen.ultimoCuadre" class="text-[13px] text-ink-tertiary">
            Último cuadre: {{ formatDate(resumen.ultimoCuadre.fecha) }}
          </p>
        </div>
        <div v-if="!serie.length" class="empty h-60 grid place-items-center">
          <div>
            <AppIcon name="chart" class="mx-auto mb-2 h-6 w-6" />
            Aún no hay gastos pagados para graficar.
          </div>
        </div>
        <div v-else class="h-60 mt-4">
          <Bar :data="chartData" :options="opcionesApilado" />
        </div>
      </div>

      <div class="card card-pad">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="section-title">Gasto por categoría</h3>
            <p class="section-hint">Lo pagado en el mes. Las categorías se configuran en Configuración.</p>
          </div>
          <select v-model="mesCategorias" class="field !w-auto !py-1.5" aria-label="Mes del gasto por categoría">
            <option v-for="(m, i) in mesesParaCategorias" :key="m" :value="i === 0 ? '' : m">
              {{ i === 0 ? 'Este mes' : etiquetaMes(m) }}
            </option>
          </select>
        </div>
        <p v-if="!porCategoria" class="empty">Cargando…</p>
        <p v-else-if="!porCategoria.categorias.length" class="empty">No hay gastos pagados en ese mes.</p>
        <ul v-else class="mt-4 space-y-3">
          <li v-for="c in porCategoria.categorias" :key="c.clave">
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span class="truncate" :class="c.clave === 'sin_categoria' ? 'text-ink-tertiary' : 'text-ink-primary'">{{ c.nombre }}</span>
              <span class="shrink-0 font-medium text-ink-primary">
                {{ formatCurrency(c.monto) }} <span class="text-xs font-normal text-ink-tertiary">· {{ c.porcentaje }} %</span>
              </span>
            </div>
            <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
              <div class="h-full rounded-full bg-accent" :style="{ width: c.porcentaje + '%' }" />
            </div>
          </li>
          <li class="flex justify-between border-t border-border pt-3 text-sm font-semibold text-ink-primary">
            <span>Total</span><span>{{ formatCurrency(porCategoria.total) }}</span>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
