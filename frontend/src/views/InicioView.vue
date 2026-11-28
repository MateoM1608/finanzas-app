<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { obtenerResumenPersonal } from '../api/resumenPersonal.js';
import { listarGastos } from '../api/gastosPersonales.js';
import { listarIngresos } from '../api/ingresosPersonales.js';
import { obtenerSaldoHogar } from '../api/cuadres.js';
import { extractErrorMessage } from '../api/client.js';
import { formatCurrency, formatDate, formatearBalances, hoyISO } from '../utils/format.js';
import { registro, abrirRegistro } from '../stores/registro.js';
import { useAuthStore } from '../stores/auth.js';
import { ORIGEN_MOVIMIENTO, tituloMovimiento } from '../utils/movimientos.js';
import AppLayout from '../components/AppLayout.vue';
import AppIcon from '../components/AppIcon.vue';
import AlertError from '../components/AlertError.vue';
import AvisosPagar from '../components/AvisosPagar.vue';

/**
 * Inicio: una cifra protagonista (el Disponible), las acciones de todos los
 * días, lo que hay que pagar y lo último que pasó. El detalle vive en
 * Movimientos, Análisis, Hogar y Patrimonio.
 */
const auth = useAuthStore();
const router = useRouter();

const resumen = ref(null);
const ultimos = ref([]);
const saldoHogar = ref(null);
const loading = ref(true);
const error = ref('');
const avisosRef = ref(null);
const oculto = ref(localStorage.getItem('finanzas:ocultar-saldos') === '1');
watch(oculto, (v) => localStorage.setItem('finanzas:ocultar-saldos', v ? '1' : '0'));

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

async function cargar() {
  error.value = '';
  try {
    const hoy = hoyISO();
    const [r, g, i, s] = await Promise.all([
      obtenerResumenPersonal(0),
      listarGastos(),
      listarIngresos(),
      obtenerSaldoHogar().catch(() => null),
    ]);
    resumen.value = r;
    saldoHogar.value = s;
    const movs = [
      ...g.filter((x) => String(x.fecha).slice(0, 10) <= hoy && x.estado === 'pagado').map((mov) => ({ tipo: 'gasto', mov })),
      ...i.filter((x) => String(x.fecha).slice(0, 10) <= hoy && x.estado === 'recibido').map((mov) => ({ tipo: 'ingreso', mov })),
    ];
    movs.sort((a, b) => {
      const fa = String(a.mov.fecha).slice(0, 10);
      const fb = String(b.mov.fecha).slice(0, 10);
      if (fa !== fb) return fa < fb ? 1 : -1;
      return String(b.mov.creadoEn ?? '').localeCompare(String(a.mov.creadoEn ?? ''));
    });
    ultimos.value = movs.slice(0, 5);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(cargar);
watch(
  () => registro.version,
  () => {
    cargar();
    avisosRef.value?.recargar();
  },
);

const primerNombre = computed(() => (auth.usuario?.nombre || '').split(' ')[0]);
const nombreMes = computed(() => {
  const inicio = resumen.value?.ciclo?.inicio;
  if (!inicio) return 'este ciclo';
  if (resumen.value.ciclo.frecuencia !== 'mensual') return 'este ciclo';
  return MESES[new Date(inicio).getUTCMonth()];
});
const neto = computed(() => resumen.value?.neto?.actual ?? 0);

const puedeGastoHogar = computed(() =>
  Boolean(auth.usuario?.hogarId && (auth.usuario?.esAdmin || auth.usuario?.puedeEditarGastos)),
);
const acciones = computed(() => [
  { id: 'gasto', texto: 'Gasto', icono: 'arrowUpRight', accion: () => abrirRegistro('gasto') },
  { id: 'ingreso', texto: 'Ingreso', icono: 'arrowDownLeft', accion: () => abrirRegistro('ingreso') },
  ...(puedeGastoHogar.value
    ? [{ id: 'hogar', texto: 'Del hogar', icono: 'home', accion: () => router.push({ name: 'hogar-seccion', params: { seccion: 'gastos' }, query: { registrar: 'variable' } }) }]
    : []),
  { id: 'tarjetas', texto: 'Tarjetas', icono: 'creditCard', accion: () => router.push({ name: 'tarjetas' }) },
]);

const hogarAlDia = computed(() => !saldoHogar.value || saldoHogar.value.balances.every((b) => b.balance === 0));
const fraseHogar = computed(() => (saldoHogar.value ? formatearBalances(saldoHogar.value.balances) : ''));

function cifra(valor) {
  return oculto.value ? '$ ••••••' : formatCurrency(valor);
}
// En las tres cifras pequeñas: millones abreviados para que quepan en el celular.
function corta(valor) {
  if (oculto.value) return '••••';
  const abs = Math.abs(valor);
  if (abs < 1_000_000) return formatCurrency(valor);
  const m = (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2).replace('.', ',').replace(/,?0+$/, '');
  return `${valor < 0 ? '−' : ''}$ ${m} M`;
}
</script>

<template>
  <AppLayout :title="primerNombre ? `Hola, ${primerNombre}` : 'Inicio'">
    <div class="space-y-6">
      <AlertError :message="error" />

      <!-- Disponible -->
      <section class="card-brand card-pad overflow-hidden" aria-labelledby="disponible-titulo">
        <div v-if="loading" class="animate-pulse" aria-busy="true">
          <div class="h-3 w-24 rounded bg-surface-sunken" />
          <div class="mt-4 h-10 w-56 max-w-full rounded bg-surface-sunken" />
          <div class="mt-6 h-12 rounded bg-surface-sunken" />
        </div>
        <template v-else-if="resumen">
          <div class="flex items-center justify-between gap-3">
            <p id="disponible-titulo" class="stat-label flex items-center gap-1.5">
              <AppIcon name="wallet" class="h-3.5 w-3.5" />
              Disponible
            </p>
            <button
              type="button"
              class="btn-icon !p-1.5"
              :aria-label="oculto ? 'Mostrar saldos' : 'Ocultar saldos'"
              :aria-pressed="oculto"
              @click="oculto = !oculto"
            >
              <AppIcon :name="oculto ? 'eye-off' : 'eye'" class="h-4 w-4" />
            </button>
          </div>
          <p class="mt-2 text-[2.5rem] sm:text-[3.25rem] font-extrabold leading-none tracking-[-0.04em] text-ink-primary">
            {{ cifra(resumen.disponible) }}
          </p>
          <p class="mt-2 text-[13px] text-ink-secondary">La plata que tienes hoy en tus cuentas.</p>

          <div class="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <router-link
              :to="{ name: 'analisis' }"
              class="rounded-2xl bg-surface-sunken/70 px-3 py-2.5 transition-colors hover:bg-surface-hover"
            >
              <span class="block truncate text-[11px] sm:text-xs font-medium text-ink-tertiary">Neto<span class="hidden sm:inline"> de {{ nombreMes }}</span><span class="sm:hidden"> del mes</span></span>
              <span class="mt-0.5 block truncate text-sm sm:text-base font-bold" :class="neto < 0 ? 'text-negative' : 'text-positive'">
                <span class="sm:hidden">{{ (neto > 0 && !oculto ? '+' : '') + corta(neto) }}</span><span class="hidden sm:inline">{{ (neto > 0 && !oculto ? '+' : '') + (oculto ? '••••' : formatCurrency(neto)) }}</span>
              </span>
            </router-link>
            <router-link
              :to="{ name: 'tarjetas' }"
              class="rounded-2xl bg-surface-sunken/70 px-3 py-2.5 transition-colors hover:bg-surface-hover"
            >
              <span class="block truncate text-[11px] sm:text-xs font-medium text-ink-tertiary">Tarjetas</span>
              <span class="mt-0.5 block truncate text-sm sm:text-base font-bold text-ink-primary"><span class="sm:hidden">{{ corta(resumen.deudaTarjetas) }}</span><span class="hidden sm:inline">{{ oculto ? '••••' : formatCurrency(resumen.deudaTarjetas) }}</span></span>
            </router-link>
            <router-link
              :to="{ name: 'patrimonio' }"
              class="rounded-2xl bg-surface-sunken/70 px-3 py-2.5 transition-colors hover:bg-surface-hover"
            >
              <span class="block truncate text-[11px] sm:text-xs font-medium text-ink-tertiary">Patrimonio</span>
              <span class="mt-0.5 block truncate text-sm sm:text-base font-bold text-ink-primary">
                <span class="sm:hidden">{{ corta(resumen.patrimonio?.total ?? 0) }}</span><span class="hidden sm:inline">{{ oculto ? '••••' : formatCurrency(resumen.patrimonio?.total ?? 0) }}</span>
              </span>
            </router-link>
          </div>
        </template>
      </section>

      <!-- Acciones rápidas -->
      <nav aria-label="Acciones rápidas" class="flex justify-around gap-2 sm:justify-start sm:gap-8">
        <button
          v-for="a in acciones"
          :key="a.id"
          type="button"
          class="group flex w-16 flex-col items-center gap-1.5 text-[12px] font-semibold text-ink-secondary hover:text-ink-primary"
          @click="a.accion"
        >
          <span
            class="grid h-14 w-14 place-items-center rounded-full border border-border bg-surface text-accent shadow-card transition-transform group-hover:border-border-strong group-active:scale-95"
          >
            <AppIcon :name="a.icono" class="h-[22px] w-[22px]" :stroke-width="2" />
          </span>
          {{ a.texto }}
        </button>
      </nav>

      <AvisosPagar ref="avisosRef" ambito="personal" />

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:items-start">
        <!-- Últimos movimientos -->
        <section class="card lg:col-span-3" aria-labelledby="ultimos-titulo">
          <div class="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
            <h2 id="ultimos-titulo" class="section-title">Últimos movimientos</h2>
            <router-link :to="{ name: 'movimientos' }" class="text-[13px] font-semibold text-accent hover:underline">Ver todo</router-link>
          </div>
          <div v-if="loading" class="space-y-3 p-4 sm:p-5" aria-busy="true">
            <div v-for="n in 4" :key="n" class="h-10 rounded-lg bg-surface-sunken animate-pulse" />
          </div>
          <div v-else-if="!ultimos.length" class="empty px-4">
            Aún no tienes movimientos.
            <div class="mt-3">
              <button type="button" class="btn-secondary btn-sm" @click="abrirRegistro('gasto')">
                <AppIcon name="plus" class="h-3.5 w-3.5" /> Registrar el primero
              </button>
            </div>
          </div>
          <ul v-else class="mt-2 divide-y divide-border">
            <li v-for="u in ultimos" :key="`${u.tipo}-${u.mov.id}`">
              <router-link
                :to="{ name: 'movimientos', hash: `#${u.tipo}-${u.mov.id}` }"
                class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover sm:px-5"
              >
                <span
                  class="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                  :class="u.tipo === 'ingreso' ? 'bg-positive/10 text-positive' : 'bg-surface-sunken text-ink-secondary'"
                >
                  <AppIcon
                    :name="u.tipo === 'ingreso' ? 'arrowDownLeft' : ORIGEN_MOVIMIENTO[u.mov.origen]?.icono ?? 'receipt'"
                    class="h-[18px] w-[18px]"
                  />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold text-ink-primary">{{ tituloMovimiento(u.mov, u.tipo) }}</span>
                  <span class="block truncate text-[13px] text-ink-tertiary">
                    {{ formatDate(u.mov.fecha) }}<template v-if="u.mov.metodoPago"> · {{ u.mov.metodoPago.nombre }}</template>
                  </span>
                </span>
                <span class="shrink-0 text-sm font-bold" :class="u.tipo === 'ingreso' ? 'text-positive' : 'text-ink-primary'">
                  {{ u.tipo === 'ingreso' ? '+' : '−' }}{{ formatCurrency(u.mov.monto) }}
                </span>
              </router-link>
            </li>
          </ul>
        </section>

        <div class="space-y-6 lg:col-span-2">
          <!-- Hogar -->
          <router-link
            v-if="auth.usuario?.hogarId"
            :to="{ name: 'panel-hogar' }"
            class="card card-pad flex items-center gap-3 transition-colors hover:bg-surface-hover"
          >
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-on">
              <AppIcon name="home" class="h-[18px] w-[18px]" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13px] font-medium text-ink-tertiary">Hogar</span>
              <span class="block text-sm font-semibold text-ink-primary text-balance">
                {{ saldoHogar ? (hogarAlDia ? 'Están a paz y salvo' : fraseHogar) : 'Gastos compartidos' }}
              </span>
            </span>
            <AppIcon name="chevronRight" class="h-4 w-4 shrink-0 text-ink-tertiary" />
          </router-link>

          <!-- Accesos -->
          <nav aria-label="Más" class="card divide-y divide-border overflow-hidden">
            <router-link
              v-for="l in [
                { to: { name: 'analisis' }, icono: 'chart', titulo: 'Análisis', texto: 'Neto, límites, ahorros y próximos meses' },
                { to: { name: 'patrimonio' }, icono: 'trendingUp', titulo: 'Patrimonio', texto: 'Cuentas, préstamos e inversiones' },
                { to: { name: 'cuadres' }, icono: 'scale', titulo: 'Cuadres', texto: 'Cuadrar cuentas del hogar' },
              ]"
              :key="l.titulo"
              :to="l.to"
              class="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-hover sm:px-5"
            >
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-secondary">
                <AppIcon :name="l.icono" class="h-[18px] w-[18px]" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold text-ink-primary">{{ l.titulo }}</span>
                <span class="block truncate text-[13px] text-ink-tertiary">{{ l.texto }}</span>
              </span>
              <AppIcon name="chevronRight" class="h-4 w-4 shrink-0 text-ink-tertiary" />
            </router-link>
          </nav>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
