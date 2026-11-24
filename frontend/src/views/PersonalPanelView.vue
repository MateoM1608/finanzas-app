<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { listarGastos, crearGasto, actualizarGasto, eliminarGasto } from '../api/gastosPersonales.js';
import { listarIngresos, crearIngreso, actualizarIngreso, eliminarIngreso } from '../api/ingresosPersonales.js';
import { listarCategorias } from '../api/categoriasPersonales.js';
import { listarMetodosPago } from '../api/metodosPagoPersonales.js';
import {
  listarComprasPersonales,
  crearCompraPersonal,
  actualizarCompraPersonal,
  eliminarCompraPersonal,
  sugerirPrimeraCuota,
} from '../api/comprasCuotas.js';
import { confirmar } from '../composables/useConfirm.js';
import { extractErrorMessage } from '../api/client.js';
import { formatCurrency, formatDate, hoyISO, modoCobroSugerido } from '../utils/format.js';
import AppLayout from '../components/AppLayout.vue';
import FormField from '../components/FormField.vue';
import AlertError from '../components/AlertError.vue';
import AppModal from '../components/AppModal.vue';
import AppIcon from '../components/AppIcon.vue';
import ConfiguracionPersonalSection from '../components/personal/ConfiguracionPersonalSection.vue';
import ResumenPersonalSection from '../components/personal/ResumenPersonalSection.vue';
import AhorrosPersonalesSection from '../components/personal/AhorrosPersonalesSection.vue';
import LimitesPersonalesSection from '../components/personal/LimitesPersonalesSection.vue';
import ProximosMesesSection from '../components/personal/ProximosMesesSection.vue';
import CompraCuotasForm from '../components/CompraCuotasForm.vue';

const mostrarConfig = ref(false);
const configTab = ref('ciclo');

function abrirConfig(tab = 'ciclo') {
  configTab.value = tab;
  mostrarConfig.value = true;
}

// Lo que se crea o edita en la configuración (límites, metas, fijos) cambia
// los resúmenes de arriba: sin recargar, un límite nuevo no aparecía hasta
// refrescar la página.
function cerrarConfig() {
  mostrarConfig.value = false;
  recargarResumenes();
  cargarCatalogos().catch((e) => {
    error.value = extractErrorMessage(e);
  });
  cargarGastos();
  cargarIngresos();
  cargarCompras();
}
const loading = ref(true);
const error = ref('');
const resumenRef = ref(null);
const ahorrosRef = ref(null);
const limitesRef = ref(null);
const proximosRef = ref(null);

function recargarResumenes() {
  resumenRef.value?.recargar();
  proximosRef.value?.recargar();
  ahorrosRef.value?.recargar();
  limitesRef.value?.recargar();
}

const categorias = ref([]);
const metodos = ref([]);
const categoriasParaGasto = computed(() => categorias.value.filter((c) => c.aplicaA.includes('gasto')));
const categoriasParaIngreso = computed(() => categorias.value.filter((c) => c.aplicaA.includes('ingreso')));

// --- Gastos ---
const gastos = ref([]);
const gMonto = ref('');
const gFecha = ref(hoyISO());
const gDescripcion = ref('');
const gCategoriaId = ref('');
const gMetodoPagoId = ref('');
const gEsObligatorio = ref(false);
const gEstado = ref('pagado');
const guardandoGasto = ref(false);
const eliminandoGastoId = ref(null);
const cambiandoEstadoGastoId = ref(null);

// --- Compra a cuotas (opción del formulario de gasto) ---
const gACuotas = ref(false);
const gNumeroCuotas = ref('3');
const gPrimeraCuota = ref('');
const gModoCobro = ref('automatico');
const compras = ref([]);
const eliminandoCompraId = ref(null);
const editandoCompra = ref(null);
const guardandoCompra = ref(false);
const errorCompra = ref('');

async function onGuardarCompra(payload) {
  errorCompra.value = '';
  guardandoCompra.value = true;
  try {
    await actualizarCompraPersonal(editandoCompra.value.id, payload);
    editandoCompra.value = null;
    await Promise.all([cargarCompras(), cargarGastos()]);
    recargarResumenes();
  } catch (e) {
    errorCompra.value = extractErrorMessage(e);
  } finally {
    guardandoCompra.value = false;
  }
}

// La fecha de la primera cuota se sugiere con el día de corte/pago del método.
async function actualizarSugerenciaCuota() {
  if (!gACuotas.value || !gFecha.value) return;
  const metodo = metodos.value.find((m) => m.id === gMetodoPagoId.value);
  gModoCobro.value = modoCobroSugerido(metodo);
  try {
    gPrimeraCuota.value = await sugerirPrimeraCuota(gFecha.value, gMetodoPagoId.value || undefined);
  } catch {
    // sin sugerencia: el usuario la escribe
  }
}
watch([gACuotas, gMetodoPagoId, gFecha], actualizarSugerenciaCuota);

const valorCuota = computed(() => {
  const n = Number(gNumeroCuotas.value);
  const total = Number(gMonto.value);
  return n >= 2 && total > 0 ? Math.floor(total / n) : null;
});

async function cargarCompras() {
  compras.value = await listarComprasPersonales();
}

async function onEliminarCompra(compra) {
  const ok = await confirmar(`¿Eliminar la compra "${compra.descripcion}" con sus ${compra.numeroCuotas} cuotas?`, {
    textoAceptar: 'Eliminar',
    peligroso: true,
  });
  if (!ok) return;
  error.value = '';
  eliminandoCompraId.value = compra.id;
  try {
    await eliminarCompraPersonal(compra.id);
    await Promise.all([cargarCompras(), cargarGastos()]);
    recargarResumenes();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoCompraId.value = null;
  }
}

async function cargarGastos() {
  gastos.value = await listarGastos();
}

async function onAgregarCompra() {
  await crearCompraPersonal({
    descripcion: gDescripcion.value,
    montoTotal: Number(gMonto.value),
    numeroCuotas: Number(gNumeroCuotas.value),
    fechaPrimeraCuota: gPrimeraCuota.value,
    modoCobro: gModoCobro.value,
    metodoPagoId: gMetodoPagoId.value || undefined,
    categoriaId: gCategoriaId.value || undefined,
    esObligatorio: gEsObligatorio.value,
  });
  await Promise.all([cargarCompras(), cargarGastos()]);
}

async function onAgregarGasto() {
  error.value = '';
  guardandoGasto.value = true;
  try {
    if (gACuotas.value) {
      await onAgregarCompra();
      gMonto.value = '';
      gDescripcion.value = '';
      gACuotas.value = false;
      recargarResumenes();
      return;
    }
    const nuevo = await crearGasto({
      monto: Number(gMonto.value),
      fecha: gFecha.value,
      descripcion: gDescripcion.value || undefined,
      categoriaId: gCategoriaId.value || undefined,
      metodoPagoId: gMetodoPagoId.value || undefined,
      esObligatorio: gEsObligatorio.value,
      estado: gEstado.value,
    });
    gastos.value = [nuevo, ...gastos.value];
    gMonto.value = '';
    gDescripcion.value = '';
    gCategoriaId.value = '';
    gMetodoPagoId.value = '';
    gEsObligatorio.value = false;
    gEstado.value = 'pagado';
    recargarResumenes();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoGasto.value = false;
  }
}

async function onToggleEstadoGasto(gasto) {
  error.value = '';
  cambiandoEstadoGastoId.value = gasto.id;
  try {
    const actualizado = await actualizarGasto(gasto.id, {
      estado: gasto.estado === 'pagado' ? 'pendiente' : 'pagado',
    });
    const idx = gastos.value.findIndex((g) => g.id === gasto.id);
    gastos.value[idx] = actualizado;
    recargarResumenes();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    cambiandoEstadoGastoId.value = null;
  }
}

async function onEliminarGasto(id) {
  error.value = '';
  eliminandoGastoId.value = id;
  try {
    await eliminarGasto(id);
    gastos.value = gastos.value.filter((g) => g.id !== id);
    recargarResumenes();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoGastoId.value = null;
  }
}

// --- Ingresos ---
const ingresos = ref([]);
const iMonto = ref('');
const iFecha = ref(hoyISO());
const iDescripcion = ref('');
const iCategoriaId = ref('');
const iMetodoPagoId = ref('');
const iEstado = ref('recibido');
const guardandoIngreso = ref(false);
const eliminandoIngresoId = ref(null);
const cambiandoEstadoIngresoId = ref(null);

async function cargarIngresos() {
  ingresos.value = await listarIngresos();
}

async function onAgregarIngreso() {
  error.value = '';
  guardandoIngreso.value = true;
  try {
    const nuevo = await crearIngreso({
      monto: Number(iMonto.value),
      fecha: iFecha.value,
      descripcion: iDescripcion.value || undefined,
      categoriaId: iCategoriaId.value || undefined,
      metodoPagoId: iMetodoPagoId.value || undefined,
      estado: iEstado.value,
    });
    ingresos.value = [nuevo, ...ingresos.value];
    iMonto.value = '';
    iDescripcion.value = '';
    iCategoriaId.value = '';
    iMetodoPagoId.value = '';
    iEstado.value = 'recibido';
    recargarResumenes();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoIngreso.value = false;
  }
}

async function onToggleEstadoIngreso(ingreso) {
  error.value = '';
  cambiandoEstadoIngresoId.value = ingreso.id;
  try {
    const actualizado = await actualizarIngreso(ingreso.id, {
      estado: ingreso.estado === 'recibido' ? 'pendiente' : 'recibido',
    });
    const idx = ingresos.value.findIndex((i) => i.id === ingreso.id);
    ingresos.value[idx] = actualizado;
    recargarResumenes();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    cambiandoEstadoIngresoId.value = null;
  }
}

async function onEliminarIngreso(id) {
  error.value = '';
  eliminandoIngresoId.value = id;
  try {
    await eliminarIngreso(id);
    ingresos.value = ingresos.value.filter((i) => i.id !== id);
    recargarResumenes();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoIngresoId.value = null;
  }
}

// Métodos de pago y categorías se crean en Configuración personal: hay que
// volver a cargarlos al cerrarla, o no aparecen en "Registrar movimiento".
async function cargarCatalogos() {
  const [c, m] = await Promise.all([listarCategorias(), listarMetodosPago()]);
  categorias.value = c;
  metodos.value = m;
}

async function cargarTodo() {
  loading.value = true;
  try {
    await cargarCatalogos();
    await Promise.all([cargarGastos(), cargarIngresos(), cargarCompras()]);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

onMounted(cargarTodo);

// --- Presentación (no cambia datos) ---
const mostrarRegistro = ref(false);
const tipoRegistro = ref('gasto');
const tabMovimientos = ref('gastos');
const LIMITE_LISTA = 8;
const verTodo = ref(false);

function abrirRegistro(tipo = 'gasto') {
  tipoRegistro.value = tipo;
  error.value = '';
  mostrarRegistro.value = true;
}

async function guardarRegistro() {
  if (tipoRegistro.value === 'gasto') await onAgregarGasto();
  else await onAgregarIngreso();
  if (!error.value) {
    tabMovimientos.value = tipoRegistro.value === 'gasto' ? 'gastos' : 'ingresos';
    mostrarRegistro.value = false;
  }
}

function cambiarTab(tab) {
  tabMovimientos.value = tab;
  verTodo.value = false;
}

// Las cuotas futuras de una compra no se listan hasta su fecha: se ven en
// "Mis próximos meses" y en la pestaña A cuotas.
const gastosALaFecha = computed(() => {
  const hoy = hoyISO();
  return gastos.value.filter((g) => !g.compraId || g.fecha.slice(0, 10) <= hoy);
});

function listaDeTab() {
  if (tabMovimientos.value === 'gastos') return gastosALaFecha.value;
  if (tabMovimientos.value === 'compras') return compras.value;
  return ingresos.value;
}
const listaVisible = computed(() => (verTodo.value ? listaDeTab() : listaDeTab().slice(0, LIMITE_LISTA)));
const totalLista = computed(() => listaDeTab().length);

// Movimientos de caja que se manejan desde Hogar/Cuadres/Métodos de pago.
const ORIGEN_MOVIMIENTO = {
  pago_hogar: { badge: 'Pago del hogar', icono: 'home' },
  liquidacion_hogar: { badge: 'Cuadre', icono: 'scale' },
  pago_tarjeta: { badge: 'Pago de tarjeta', icono: 'wallet' },
};
function esDelHogar(mov) {
  return mov.origen === 'pago_hogar' || mov.origen === 'liquidacion_hogar';
}

function cuotasPagadas(compra) {
  return compra.cuotas.filter((c) => c.estado === 'pagado').length;
}
function saldoCompra(compra) {
  return compra.cuotas.filter((c) => c.estado !== 'pagado').reduce((acc, c) => acc + c.monto, 0);
}
</script>

<template>
  <AppLayout title="Personal" subtitle="Tu dinero: disponible, compromisos, límites y ahorros.">
    <template #actions>
      <button type="button" class="btn-secondary" aria-label="Configuración personal" @click="abrirConfig()">
        <AppIcon name="sliders" class="h-4 w-4" />
        <span class="hidden sm:inline">Configuración</span>
      </button>
      <button type="button" class="btn-primary" @click="abrirRegistro('gasto')">
        <AppIcon name="plus" class="h-4 w-4" :stroke-width="2.2" />
        Registrar movimiento
      </button>
    </template>

    <div class="space-y-6">
      <ResumenPersonalSection ref="resumenRef" />
      <ProximosMesesSection ref="proximosRef" />

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section class="card card-pad">
          <div class="flex items-start justify-between gap-3 mb-5">
            <div class="flex items-center gap-3">
              <span class="grid h-9 w-9 place-items-center rounded-xl bg-surface-sunken text-ink-secondary">
                <AppIcon name="gauge" class="h-[18px] w-[18px]" />
              </span>
              <div>
                <h2 class="section-title">Límites</h2>
                <p class="section-hint">Topes de gasto del ciclo actual.</p>
              </div>
            </div>
            <button type="button" class="btn-ghost btn-sm" @click="abrirConfig('limites')">Configurar</button>
          </div>
          <LimitesPersonalesSection ref="limitesRef" />
        </section>

        <section class="card card-pad">
          <div class="flex items-start justify-between gap-3 mb-5">
            <div class="flex items-center gap-3">
              <span class="grid h-9 w-9 place-items-center rounded-xl bg-surface-sunken text-ink-secondary">
                <AppIcon name="piggy" class="h-[18px] w-[18px]" />
              </span>
              <div>
                <h2 class="section-title">Ahorros</h2>
                <p class="section-hint">Metas y aportes del ciclo.</p>
              </div>
            </div>
            <button type="button" class="btn-ghost btn-sm" @click="abrirConfig('ahorros')">Configurar</button>
          </div>
          <AhorrosPersonalesSection ref="ahorrosRef" />
        </section>
      </div>

      <AlertError v-if="!mostrarRegistro" :message="error" />

      <!-- Movimientos -->
      <section class="card">
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
          <div>
            <h2 class="section-title">Movimientos</h2>
            <p class="section-hint">
              La plata que de verdad entró y salió: incluye el total de lo que pagaste del hogar y los cuadres.
            </p>
          </div>
          <div class="tabs" role="tablist" aria-label="Tipo de movimiento">
            <button
              type="button"
              role="tab"
              class="tab"
              :class="{ 'tab-active': tabMovimientos === 'gastos' }"
              :aria-selected="tabMovimientos === 'gastos'"
              @click="cambiarTab('gastos')"
            >
              Gastos <span class="ml-1 text-ink-tertiary">{{ gastosALaFecha.length }}</span>
            </button>
            <button
              type="button"
              role="tab"
              class="tab"
              :class="{ 'tab-active': tabMovimientos === 'ingresos' }"
              :aria-selected="tabMovimientos === 'ingresos'"
              @click="cambiarTab('ingresos')"
            >
              Ingresos <span class="ml-1 text-ink-tertiary">{{ ingresos.length }}</span>
            </button>
            <button
              type="button"
              role="tab"
              class="tab"
              :class="{ 'tab-active': tabMovimientos === 'compras' }"
              :aria-selected="tabMovimientos === 'compras'"
              @click="cambiarTab('compras')"
            >
              A cuotas <span class="ml-1 text-ink-tertiary">{{ compras.length }}</span>
            </button>
          </div>
        </div>

        <div class="px-5 sm:px-6 pb-2">
          <div v-if="loading" class="space-y-3 py-3" aria-busy="true">
            <div v-for="n in 4" :key="n" class="h-10 rounded-lg bg-surface-sunken animate-pulse" />
          </div>

          <div v-else-if="!totalLista" class="empty py-10">
            <AppIcon name="receipt" class="mx-auto mb-2 h-6 w-6" />
            {{
              tabMovimientos === 'gastos'
                ? 'Aún no has registrado gastos personales.'
                : tabMovimientos === 'compras'
                  ? 'No tienes compras a cuotas. Regístralas desde Registrar movimiento, marcando "Es una compra a cuotas".'
                  : 'Aún no has registrado ingresos personales.'
            }}
            <div v-if="tabMovimientos !== 'compras'" class="mt-4">
              <button
                type="button"
                class="btn-secondary btn-sm"
                @click="abrirRegistro(tabMovimientos === 'gastos' ? 'gasto' : 'ingreso')"
              >
                <AppIcon name="plus" class="h-3.5 w-3.5" />
                {{ tabMovimientos === 'gastos' ? 'Registrar gasto' : 'Registrar ingreso' }}
              </button>
            </div>
          </div>

          <!-- Gastos -->
          <ul v-else-if="tabMovimientos === 'gastos'" class="list">
            <li v-for="gasto in listaVisible" :key="gasto.id" class="list-row group">
              <div class="flex min-w-0 items-center gap-3">
                <span class="hidden sm:grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-secondary">
                  <AppIcon :name="ORIGEN_MOVIMIENTO[gasto.origen]?.icono ?? (gasto.origenConfigId ? 'repeat' : 'receipt')" class="h-4 w-4" />
                </span>
                <div class="min-w-0">
                  <p class="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink-primary">
                    <span class="truncate">{{ gasto.descripcion || gasto.categoria?.nombre || 'Gasto personal' }}</span>
                    <span v-if="gasto.estado === 'pendiente'" class="badge-warning">Pendiente</span>
                    <span v-if="gasto.esObligatorio" class="badge-accent">Obligatorio</span>
                    <span v-if="gasto.origenConfigId" class="badge-neutral">Fijo</span>
                    <span v-if="ORIGEN_MOVIMIENTO[gasto.origen]" class="badge-neutral">{{ ORIGEN_MOVIMIENTO[gasto.origen].badge }}</span>
                    <span v-if="gasto.compra" class="badge-neutral">Cuota {{ gasto.numeroCuota }}/{{ gasto.compra.numeroCuotas }}</span>
                  </p>
                  <p class="mt-0.5 text-[13px] text-ink-tertiary">
                    {{ formatDate(gasto.fecha) }}
                    <template v-if="gasto.descripcion && gasto.categoria"> · {{ gasto.categoria.nombre }}</template>
                    <template v-if="gasto.metodoPago"> · {{ gasto.metodoPago.nombre }}</template>
                  </p>
                </div>
              </div>

              <div class="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                <span class="text-sm font-semibold text-ink-primary sm:mr-1">−{{ formatCurrency(gasto.monto) }}</span>
                <div class="flex items-center gap-1">
                  <button
                    v-if="!esDelHogar(gasto)"
                    type="button"
                    class="btn-ghost btn-sm"
                    :class="gasto.estado === 'pendiente' ? '!text-accent' : ''"
                    :disabled="cambiandoEstadoGastoId === gasto.id"
                    @click="onToggleEstadoGasto(gasto)"
                  >
                    <AppIcon v-if="gasto.estado === 'pendiente'" name="check" class="h-3.5 w-3.5" :stroke-width="2.2" />
                    {{ gasto.estado === 'pagado' ? 'Marcar pendiente' : 'Marcar pagado' }}
                  </button>
                  <button
                    v-if="!gasto.origenConfigId && !esDelHogar(gasto) && !gasto.compraId"
                    type="button"
                    class="btn-icon !p-1.5 hover:!text-negative sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                    :disabled="eliminandoGastoId === gasto.id"
                    aria-label="Eliminar gasto"
                    title="Eliminar"
                    @click="onEliminarGasto(gasto.id)"
                  >
                    <AppIcon name="trash" class="h-4 w-4" />
                  </button>
                  <span v-else class="hidden sm:block w-7" aria-hidden="true" />
                </div>
              </div>
            </li>
          </ul>

          <!-- Compras a cuotas -->
          <ul v-else-if="tabMovimientos === 'compras'" class="list">
            <li v-for="compra in listaVisible" :key="compra.id" class="list-row group">
              <div class="flex min-w-0 items-center gap-3">
                <span class="hidden sm:grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-secondary">
                  <AppIcon name="calendar" class="h-4 w-4" />
                </span>
                <div class="min-w-0">
                  <p class="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink-primary">
                    <span class="truncate">{{ compra.descripcion }}</span>
                    <span class="badge-neutral">{{ cuotasPagadas(compra) }}/{{ compra.numeroCuotas }} pagadas</span>
                    <span :class="compra.modoCobro === 'automatico' ? 'badge-accent' : 'badge-warning'">
                      {{ compra.modoCobro === 'automatico' ? 'Automático' : 'Manual' }}
                    </span>
                  </p>
                  <p class="mt-0.5 text-[13px] text-ink-tertiary">
                    {{ formatCurrency(compra.montoTotal) }} en {{ compra.numeroCuotas }} cuotas · desde
                    {{ formatDate(compra.fechaPrimeraCuota) }}
                    <template v-if="compra.metodoPago"> · {{ compra.metodoPago.nombre }}</template>
                  </p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span class="text-right">
                  <span class="block text-sm font-semibold text-ink-primary">{{ formatCurrency(saldoCompra(compra)) }}</span>
                  <span class="block text-xs text-ink-tertiary">por pagar</span>
                </span>
                <button
                  type="button"
                  class="btn-icon !p-1.5"
                  :aria-label="`Editar ${compra.descripcion}`"
                  title="Editar compra"
                  @click="(errorCompra = ''), (editandoCompra = compra)"
                >
                  <AppIcon name="edit" class="h-4 w-4" />
                </button>
                <button
                  v-if="!cuotasPagadas(compra)"
                  type="button"
                  class="btn-icon !p-1.5 hover:!text-negative sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                  :disabled="eliminandoCompraId === compra.id"
                  :aria-label="`Eliminar ${compra.descripcion}`"
                  title="Eliminar compra"
                  @click="onEliminarCompra(compra)"
                >
                  <AppIcon name="trash" class="h-4 w-4" />
                </button>
              </div>
            </li>
          </ul>

          <!-- Ingresos -->
          <ul v-else class="list">
            <li v-for="ingreso in listaVisible" :key="ingreso.id" class="list-row group">
              <div class="flex min-w-0 items-center gap-3">
                <span class="hidden sm:grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-positive/10 text-positive">
                  <AppIcon :name="ingreso.origenConfigId ? 'repeat' : 'arrowDownLeft'" class="h-4 w-4" />
                </span>
                <div class="min-w-0">
                  <p class="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink-primary">
                    <span class="truncate">{{ ingreso.descripcion || ingreso.categoria?.nombre || 'Ingreso personal' }}</span>
                    <span v-if="ingreso.estado === 'pendiente'" class="badge-warning">Pendiente</span>
                    <span v-if="ingreso.origenConfigId" class="badge-neutral">Fijo</span>
                    <span v-if="ingreso.origen === 'liquidacion_hogar'" class="badge-neutral">Reintegro del cuadre</span>
                  </p>
                  <p class="mt-0.5 text-[13px] text-ink-tertiary">
                    {{ formatDate(ingreso.fecha) }}
                    <template v-if="ingreso.descripcion && ingreso.categoria"> · {{ ingreso.categoria.nombre }}</template>
                    <template v-if="ingreso.metodoPago"> · {{ ingreso.metodoPago.nombre }}</template>
                  </p>
                </div>
              </div>

              <div class="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                <span class="text-sm font-semibold text-positive sm:mr-1">+{{ formatCurrency(ingreso.monto) }}</span>
                <div class="flex items-center gap-1">
                  <button
                    v-if="!esDelHogar(ingreso)"
                    type="button"
                    class="btn-ghost btn-sm"
                    :class="ingreso.estado === 'pendiente' ? '!text-accent' : ''"
                    :disabled="cambiandoEstadoIngresoId === ingreso.id"
                    @click="onToggleEstadoIngreso(ingreso)"
                  >
                    <AppIcon v-if="ingreso.estado === 'pendiente'" name="check" class="h-3.5 w-3.5" :stroke-width="2.2" />
                    {{ ingreso.estado === 'recibido' ? 'Marcar pendiente' : 'Marcar recibido' }}
                  </button>
                  <button
                    v-if="!ingreso.origenConfigId && !esDelHogar(ingreso)"
                    type="button"
                    class="btn-icon !p-1.5 hover:!text-negative sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                    :disabled="eliminandoIngresoId === ingreso.id"
                    aria-label="Eliminar ingreso"
                    title="Eliminar"
                    @click="onEliminarIngreso(ingreso.id)"
                  >
                    <AppIcon name="trash" class="h-4 w-4" />
                  </button>
                  <span v-else class="hidden sm:block w-7" aria-hidden="true" />
                </div>
              </div>
            </li>
          </ul>
        </div>

        <div v-if="!loading && totalLista > LIMITE_LISTA" class="border-t border-border px-5 sm:px-6 py-3">
          <button type="button" class="btn-ghost btn-sm -ml-3" @click="verTodo = !verTodo">
            <AppIcon name="chevronDown" class="h-4 w-4 transition-transform" :class="{ 'rotate-180': verTodo }" />
            {{ verTodo ? 'Ver menos' : 'Ver los ' + totalLista }}
          </button>
        </div>
      </section>
    </div>

    <!-- Editar compra a cuotas -->
    <AppModal v-if="editandoCompra" :title="`Editar ${editandoCompra.descripcion}`" size="lg" @close="editandoCompra = null">
      <AlertError :message="errorCompra" class="mb-4" />
      <CompraCuotasForm
        tipo="personal"
        :compra="editandoCompra"
        :metodos="metodos"
        :categorias="categoriasParaGasto"
        :guardando="guardandoCompra"
        @guardar="onGuardarCompra"
        @cancelar="editandoCompra = null"
      />
    </AppModal>

    <!-- Registrar movimiento -->
    <AppModal v-if="mostrarRegistro" title="Registrar movimiento" @close="mostrarRegistro = false">
      <div class="tabs w-full mb-5" role="tablist" aria-label="Tipo de movimiento">
        <button
          type="button"
          role="tab"
          class="tab flex-1"
          :class="{ 'tab-active': tipoRegistro === 'gasto' }"
          :aria-selected="tipoRegistro === 'gasto'"
          @click="tipoRegistro = 'gasto'"
        >
          Gasto
        </button>
        <button
          type="button"
          role="tab"
          class="tab flex-1"
          :class="{ 'tab-active': tipoRegistro === 'ingreso' }"
          :aria-selected="tipoRegistro === 'ingreso'"
          @click="tipoRegistro = 'ingreso'"
        >
          Ingreso
        </button>
      </div>

      <form v-if="tipoRegistro === 'gasto'" class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="guardarRegistro">
        <FormField v-model="gMonto" type="number" label="Monto (COP)" required placeholder="30000" />
        <FormField v-model="gFecha" type="date" label="Fecha" required />
        <div class="sm:col-span-2">
          <FormField v-model="gDescripcion" label="Descripción (opcional)" placeholder="Ej. Mercado, Netflix…" />
        </div>
        <div>
          <label class="label" for="g-categoria">Categoría (opcional)</label>
          <select id="g-categoria" v-model="gCategoriaId" class="field">
            <option value="">Sin definir</option>
            <option v-for="c in categoriasParaGasto" :key="c.id" :value="c.id">{{ c.nombre }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="g-metodo">Método de pago (opcional)</label>
          <select id="g-metodo" v-model="gMetodoPagoId" class="field">
            <option value="">Sin definir</option>
            <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="g-estado">Estado</label>
          <select id="g-estado" v-model="gEstado" class="field">
            <option value="pagado">Ya pagado</option>
            <option value="pendiente">Pendiente</option>
          </select>
        </div>
        <label
          class="flex items-center gap-2.5 self-end rounded-xl border border-border px-3.5 py-2.5 text-sm text-ink-secondary cursor-pointer hover:border-border-strong"
        >
          <input v-model="gEsObligatorio" type="checkbox" class="checkbox" />
          Es un gasto obligatorio
        </label>

        <label class="sm:col-span-2 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
          <input v-model="gACuotas" type="checkbox" class="checkbox" />
          Es una compra a cuotas
        </label>
        <template v-if="gACuotas">
          <FormField v-model="gNumeroCuotas" type="number" label="Número de cuotas" required />
          <FormField
            v-model="gPrimeraCuota"
            type="date"
            label="Primera cuota"
            required
            hint="Sugerida con el día de corte y pago de la tarjeta; puedes cambiarla."
          />
          <div>
            <label class="label" for="g-modo-cobro">Cómo se paga cada cuota</label>
            <select id="g-modo-cobro" v-model="gModoCobro" class="field">
              <option value="automatico">Automático (tarjeta o débito)</option>
              <option value="manual">Manual (la marco yo al pagar)</option>
            </select>
          </div>
          <p class="self-end pb-2.5 text-[13px] text-ink-secondary">
            <template v-if="valorCuota">≈ {{ formatCurrency(valorCuota) }} por cuota</template>
          </p>
          <p class="sm:col-span-2 text-[13px] text-ink-tertiary">
            El monto es el total de la compra y la descripción es obligatoria. Se crean todas las cuotas; las
            automáticas se dan por pagadas en su fecha.
          </p>
        </template>

        <div v-if="error" class="sm:col-span-2"><AlertError :message="error" /></div>

        <div class="sm:col-span-2 flex justify-end gap-2 pt-1">
          <button type="button" class="btn-ghost" @click="mostrarRegistro = false">Cancelar</button>
          <button
            type="submit"
            class="btn-primary"
            :disabled="guardandoGasto || (gACuotas && (!gDescripcion || Number(gNumeroCuotas) < 2))"
          >
            {{ guardandoGasto ? 'Guardando…' : gACuotas ? 'Agregar compra' : 'Agregar gasto' }}
          </button>
        </div>
      </form>

      <form v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="guardarRegistro">
        <FormField v-model="iMonto" type="number" label="Monto (COP)" required placeholder="3000000" />
        <FormField v-model="iFecha" type="date" label="Fecha" required />
        <div class="sm:col-span-2">
          <FormField v-model="iDescripcion" label="Descripción (opcional)" placeholder="Ej. Salario, freelance…" />
        </div>
        <div>
          <label class="label" for="i-categoria">Categoría (opcional)</label>
          <select id="i-categoria" v-model="iCategoriaId" class="field">
            <option value="">Sin definir</option>
            <option v-for="c in categoriasParaIngreso" :key="c.id" :value="c.id">{{ c.nombre }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="i-metodo">Método de pago (opcional)</label>
          <select id="i-metodo" v-model="iMetodoPagoId" class="field">
            <option value="">Sin definir</option>
            <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="i-estado">Estado</label>
          <select id="i-estado" v-model="iEstado" class="field">
            <option value="recibido">Ya recibido</option>
            <option value="pendiente">Pendiente</option>
          </select>
        </div>

        <div v-if="error" class="sm:col-span-2"><AlertError :message="error" /></div>

        <div class="sm:col-span-2 flex justify-end gap-2 pt-1">
          <button type="button" class="btn-ghost" @click="mostrarRegistro = false">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="guardandoIngreso">
            {{ guardandoIngreso ? 'Guardando…' : 'Agregar ingreso' }}
          </button>
        </div>
      </form>
    </AppModal>

    <AppModal v-if="mostrarConfig" title="Configuración personal" size="lg" @close="cerrarConfig">
      <ConfiguracionPersonalSection :tab-inicial="configTab" />
    </AppModal>
  </AppLayout>
</template>
