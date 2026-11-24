<script setup>
import { ref, computed, onMounted } from 'vue';
import { Bar } from 'vue-chartjs';
import { obtenerProyeccion } from '../../api/proyeccionPersonal.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { useChartTheme } from '../../composables/useChartTheme.js';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';

/**
 * Mis próximos meses: lo que ya tengo comprometido cada mes (mi parte del
 * hogar + mis fijos + mis cuotas) contra lo que espero recibir.
 */
const proyeccion = ref(null);
const loading = ref(true);
const error = ref('');
const mesAbierto = ref(null);

async function cargar() {
  error.value = '';
  try {
    proyeccion.value = await obtenerProyeccion(6);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(cargar);
defineExpose({ recargar: cargar });

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function etiqueta(periodo, largo = false) {
  const [anio, mes] = periodo.split('-');
  return largo ? `${MESES_LARGOS[Number(mes) - 1]} ${anio}` : `${MESES[Number(mes) - 1]} ${anio.slice(2)}`;
}

const meses = computed(() => proyeccion.value?.meses ?? []);
const hayDatos = computed(() => meses.value.some((m) => m.comprometido || m.ingresosEsperados));

const { paleta, opcionesBarras } = useChartTheme();
const opciones = opcionesBarras({ apilado: true, conLeyenda: true });
const ESTILO = { borderRadius: 4, maxBarThickness: 40, borderSkipped: false, stack: 'comprometido' };

const COMPONENTES = [
  { campo: 'hogarCuentasFijas', label: 'Cuentas del hogar' },
  { campo: 'hogarCuotas', label: 'Cuotas del hogar' },
  { campo: 'fijosPersonales', label: 'Fijos personales' },
  { campo: 'cuotasPersonales', label: 'Cuotas personales' },
];

const chartData = computed(() => ({
  labels: meses.value.map((m) => etiqueta(m.periodo)),
  datasets: COMPONENTES.map((c, i) => ({
    label: c.label,
    data: meses.value.map((m) => m[c.campo]),
    backgroundColor: paleta.value.series[i % paleta.value.series.length],
    ...ESTILO,
  })),
}));

const TIPO_DETALLE = {
  hogarCuentasFijas: 'Hogar',
  hogarCuotas: 'Cuota hogar',
  fijosPersonales: 'Fijo',
  cuotasPersonales: 'Cuota',
  ingreso: 'Ingreso',
};
</script>

<template>
  <section class="card card-pad" aria-labelledby="proximos-meses-titulo">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="grid h-9 w-9 place-items-center rounded-xl bg-surface-sunken text-ink-secondary">
          <AppIcon name="calendar" class="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 id="proximos-meses-titulo" class="section-title">Mis próximos meses</h2>
          <p class="section-hint">Lo que ya tienes comprometido cada mes y lo que te quedaría libre.</p>
        </div>
      </div>
    </div>

    <AlertError :message="error" />

    <div v-if="loading" class="h-60 rounded-xl bg-surface-sunken animate-pulse" aria-busy="true" />

    <div v-else-if="!hayDatos" class="empty flex flex-col items-center gap-2">
      <AppIcon name="calendar" class="h-6 w-6" />
      Aún no hay compromisos ni ingresos futuros. Configura tus fijos o registra una compra a cuotas.
    </div>

    <template v-else>
      <div class="h-56">
        <Bar :data="chartData" :options="opciones" />
      </div>

      <div class="mt-5 overflow-x-auto">
        <table class="w-full min-w-[520px] text-sm">
          <thead>
            <tr class="text-left text-[13px] text-ink-tertiary">
              <th class="py-2 pr-3 font-medium">Mes</th>
              <th class="py-2 pr-3 text-right font-medium">Ingresos esperados</th>
              <th class="py-2 pr-3 text-right font-medium">Comprometido</th>
              <th class="py-2 text-right font-medium">Te quedaría libre</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <template v-for="m in meses" :key="m.periodo">
              <tr
                class="cursor-pointer hover:bg-surface-hover"
                :aria-expanded="mesAbierto === m.periodo"
                @click="mesAbierto = mesAbierto === m.periodo ? null : m.periodo"
              >
                <td class="py-2.5 pr-3 font-medium text-ink-primary">
                  <span class="inline-flex items-center gap-1.5">
                    <AppIcon
                      name="chevronRight"
                      class="h-3.5 w-3.5 text-ink-tertiary transition-transform"
                      :class="{ 'rotate-90': mesAbierto === m.periodo }"
                    />
                    {{ etiqueta(m.periodo, true) }}
                    <span v-if="m.estimado" class="badge-neutral" title="Incluye cuentas de monto variable estimadas con el último pago">Estimado</span>
                  </span>
                </td>
                <td class="py-2.5 pr-3 text-right whitespace-nowrap text-positive">{{ formatCurrency(m.ingresosEsperados) }}</td>
                <td class="py-2.5 pr-3 text-right whitespace-nowrap text-ink-primary">{{ formatCurrency(m.comprometido) }}</td>
                <td class="py-2.5 text-right whitespace-nowrap font-semibold" :class="m.libre < 0 ? 'text-negative' : 'text-ink-primary'">
                  ≈ {{ formatCurrency(m.libre) }}
                </td>
              </tr>
              <tr v-if="mesAbierto === m.periodo">
                <td colspan="4" class="pb-3">
                  <p v-if="!m.detalle.length" class="empty !py-3">Sin movimientos proyectados este mes.</p>
                  <ul v-else class="panel-sunken divide-y divide-border px-3.5">
                    <li v-for="(d, i) in m.detalle" :key="i" class="flex items-center justify-between gap-3 py-2">
                      <span class="min-w-0">
                        <span class="block truncate text-[13px] font-medium text-ink-primary">{{ d.nombre }}</span>
                        <span class="block text-xs text-ink-tertiary">
                          {{ formatDate(d.fecha) }} · {{ TIPO_DETALLE[d.tipo] }}<template v-if="d.estimado"> · estimado</template>
                        </span>
                      </span>
                      <span
                        class="shrink-0 whitespace-nowrap text-[13px] font-medium"
                        :class="d.tipo === 'ingreso' ? 'text-positive' : 'text-ink-primary'"
                      >
                        {{ d.tipo === 'ingreso' ? '+' : '−' }}{{ formatCurrency(d.monto) }}
                      </span>
                    </li>
                  </ul>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-[13px] text-ink-tertiary">
        Es una estimación: no incluye gastos que todavía no has hecho, como mercado o salidas.
      </p>
    </template>
  </section>
</template>
