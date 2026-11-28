<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { listarGastos, actualizarGasto, eliminarGasto, cambiarMetodoGasto } from '../api/gastosPersonales.js';
import { listarIngresos, actualizarIngreso, eliminarIngreso, cambiarMetodoIngreso } from '../api/ingresosPersonales.js';
import { listarCategorias } from '../api/categoriasPersonales.js';
import { listarMetodosPago } from '../api/metodosPagoPersonales.js';
import { listarComprasPersonales, eliminarCompraPersonal } from '../api/comprasCuotas.js';
import { confirmar } from '../composables/useConfirm.js';
import { extractErrorMessage } from '../api/client.js';
import { formatCurrency, formatDate, formatUsd, hoyISO } from '../utils/format.js';
import { registro, abrirRegistro, editarGastoPersonal, editarCompraPersonal } from '../stores/registro.js';
import { useAuthStore } from '../stores/auth.js';
import { useAncla } from '../composables/useAncla.js';
import AppLayout from '../components/AppLayout.vue';
import AppModal from '../components/AppModal.vue';
import AlertError from '../components/AlertError.vue';
import AppIcon from '../components/AppIcon.vue';
import ExportarDatos from '../components/ExportarDatos.vue';
import EditarMovimientoModal from '../components/personal/EditarMovimientoModal.vue';
import { ORIGEN_MOVIMIENTO, esDelHogar, esDeOtraPantalla, tituloMovimiento } from '../utils/movimientos.js';

/**
 * Movimientos: toda la caja personal (lo que de verdad entró y salió), con
 * búsqueda y filtros. Cada fila abre su detalle con las acciones (marcar
 * pagado, editar, eliminar, con qué se pagó); las compras a cuotas tienen su
 * propia pestaña.
 */
const auth = useAuthStore();
const route = useRoute();

const loading = ref(true);
const error = ref('');
const gastos = ref([]);
const ingresos = ref([]);
const compras = ref([]);
const categorias = ref([]);
const metodos = ref([]);

async function cargar() {
  try {
    const [g, i, c, cat, met] = await Promise.all([
      listarGastos(),
      listarIngresos(),
      listarComprasPersonales(),
      listarCategorias(),
      listarMetodosPago(),
    ]);
    gastos.value = g;
    ingresos.value = i;
    compras.value = c;
    categorias.value = cat;
    metodos.value = met;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(cargar);
// Lo que se registra o edita desde "Registrar movimiento" (en cualquier pantalla).
watch(() => registro.version, cargar);

// --- Pestañas y filtros ---
const tab = ref('todos');
const busqueda = ref('');
const filtroCategoria = ref('');
const filtroCuenta = ref('');
const filtroDesde = ref(typeof route.query.desde === 'string' ? route.query.desde : '');
const filtroHasta = ref(typeof route.query.hasta === 'string' ? route.query.hasta : '');
const mostrarFiltros = ref(false);
const exportando = ref(false);

const cantidadFiltros = computed(
  () => [filtroCategoria.value, filtroCuenta.value, filtroDesde.value || filtroHasta.value].filter(Boolean).length,
);
const hayFiltro = computed(() => Boolean(busqueda.value.trim()) || cantidadFiltros.value > 0);

function isoDe(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const RANGOS = [
  { id: 'mes', texto: 'Este mes' },
  { id: 'mesAnterior', texto: 'Mes anterior' },
  { id: '30dias', texto: 'Últimos 30 días' },
  { id: 'todo', texto: 'Todo' },
];
function aplicarRango(tipo) {
  const hoy = new Date();
  if (tipo === 'mes') {
    filtroDesde.value = isoDe(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    filtroHasta.value = isoDe(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
  } else if (tipo === 'mesAnterior') {
    filtroDesde.value = isoDe(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
    filtroHasta.value = isoDe(new Date(hoy.getFullYear(), hoy.getMonth(), 0));
  } else if (tipo === '30dias') {
    filtroDesde.value = isoDe(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 29));
    filtroHasta.value = isoDe(hoy);
  } else {
    filtroDesde.value = '';
    filtroHasta.value = '';
  }
}
function limpiarFiltros() {
  busqueda.value = '';
  filtroCategoria.value = '';
  filtroCuenta.value = '';
  aplicarRango('todo');
}

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
function coincide(m) {
  if (filtroCategoria.value && (filtroCategoria.value === 'sin' ? m.categoriaId : m.categoriaId !== filtroCategoria.value)) return false;
  if (filtroCuenta.value && (filtroCuenta.value === 'sin' ? m.metodoPagoId : m.metodoPagoId !== filtroCuenta.value)) return false;
  const f = String(m.fecha).slice(0, 10);
  if (filtroDesde.value && f < filtroDesde.value) return false;
  if (filtroHasta.value && f > filtroHasta.value) return false;
  const q = normalizar(busqueda.value.trim());
  if (!q) return true;
  const digitos = q.replace(/[$.\s]/g, '');
  if (/^\d+$/.test(digitos) && String(m.monto).includes(digitos)) return true;
  return [m.descripcion, m.categoria?.nombre, m.metodoPago?.nombre].some((t) => normalizar(t).includes(q));
}

// Las cuotas futuras de una compra no se listan hasta su fecha (están en A cuotas).
const gastosALaFecha = computed(() => {
  const hoy = hoyISO();
  return gastos.value.filter((g) => (!g.compraId && !g.prestamoId) || g.fecha.slice(0, 10) <= hoy);
});

function porFechaDesc(a, b) {
  const fa = String(a.mov.fecha).slice(0, 10);
  const fb = String(b.mov.fecha).slice(0, 10);
  if (fa !== fb) return fa < fb ? 1 : -1;
  return String(b.mov.creadoEn ?? '').localeCompare(String(a.mov.creadoEn ?? ''));
}
const filas = computed(() => {
  const g = tab.value === 'ingresos' ? [] : gastosALaFecha.value.filter(coincide).map((mov) => ({ tipo: 'gasto', mov }));
  const i = tab.value === 'gastos' ? [] : ingresos.value.filter(coincide).map((mov) => ({ tipo: 'ingreso', mov }));
  return [...g, ...i].sort(porFechaDesc);
});

// Agrupadas por día, como un extracto.
function etiquetaDia(iso) {
  const hoy = hoyISO();
  const ayer = isoDe(new Date(Date.now() - 86400000));
  if (iso === hoy) return 'Hoy';
  if (iso === ayer) return 'Ayer';
  return formatDate(iso);
}
const POR_PAGINA = 40;
const limite = ref(POR_PAGINA);
watch([tab, busqueda, filtroCategoria, filtroCuenta, filtroDesde, filtroHasta], () => {
  limite.value = POR_PAGINA;
});
const grupos = computed(() => {
  const res = [];
  for (const fila of filas.value.slice(0, limite.value)) {
    const dia = String(fila.mov.fecha).slice(0, 10);
    let g = res[res.length - 1];
    if (!g || g.dia !== dia) {
      g = { dia, etiqueta: etiquetaDia(dia), filas: [] };
      res.push(g);
    }
    g.filas.push(fila);
  }
  return res;
});

const totales = computed(() => {
  let entradas = 0;
  let salidas = 0;
  for (const { tipo, mov } of filas.value) {
    if (tipo === 'ingreso' && mov.estado === 'recibido') entradas += mov.monto;
    if (tipo === 'gasto' && mov.estado === 'pagado') salidas += mov.monto;
  }
  return { entradas, salidas };
});

// --- Compras a cuotas ---
const cuotasPagadas = (c) => c.cuotas.filter((q) => q.estado === 'pagado').length;
const cuotasPagadasTotal = (c) => (c.cuotasPagadasAntes ?? 0) + cuotasPagadas(c);
const saldoCompra = (c) => c.cuotas.filter((q) => q.estado !== 'pagado').reduce((a, q) => a + q.monto, 0);
const comprasVisibles = computed(() => {
  const q = normalizar(busqueda.value.trim());
  return q ? compras.value.filter((c) => normalizar(c.descripcion).includes(q)) : compras.value;
});

// --- Detalle de un movimiento ---
const detalle = ref(null); // { tipo, mov } | { tipo: 'compra', mov: compra }
const ocupado = ref(false);
const editandoIngreso = ref(null);

function abrirDetalle(fila) {
  error.value = '';
  detalle.value = fila;
}

const compraDelDetalle = computed(() =>
  detalle.value?.tipo === 'gasto' && detalle.value.mov.compraId
    ? compras.value.find((c) => c.id === detalle.value.mov.compraId)
    : null,
);

function puedeEditar(tipo, mov) {
  if (esDelHogar(mov) || esDeOtraPantalla(mov)) return false;
  if (tipo === 'gasto') return !mov.compraId && mov.origen !== 'pago_tarjeta';
  return mov.origen !== 'desembolso_prestamo';
}
function puedeEliminar(mov) {
  return !mov.origenConfigId && !esDelHogar(mov) && !mov.compraId && !esDeOtraPantalla(mov);
}
function puedeCambiarEstado(mov) {
  return !esDelHogar(mov) && !esDeOtraPantalla(mov);
}

async function onCambiarEstado() {
  const { tipo, mov } = detalle.value;
  ocupado.value = true;
  error.value = '';
  try {
    const actualizado =
      tipo === 'gasto'
        ? await actualizarGasto(mov.id, { estado: mov.estado === 'pagado' ? 'pendiente' : 'pagado' })
        : await actualizarIngreso(mov.id, { estado: mov.estado === 'recibido' ? 'pendiente' : 'recibido' });
    detalle.value = { tipo, mov: actualizado };
    await cargar();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    ocupado.value = false;
  }
}

async function onCambiarMetodo(metodoPagoId) {
  const { tipo, mov } = detalle.value;
  error.value = '';
  try {
    const actualizado =
      tipo === 'gasto'
        ? await cambiarMetodoGasto(mov.id, metodoPagoId || null)
        : await cambiarMetodoIngreso(mov.id, metodoPagoId || null);
    detalle.value = { tipo, mov: actualizado };
    await cargar();
  } catch (e) {
    error.value = extractErrorMessage(e);
  }
}

async function onEliminar() {
  const { tipo, mov } = detalle.value;
  const nombre = tituloMovimiento(mov, tipo);
  if (!(await confirmar(`¿Eliminar "${nombre}" de ${formatCurrency(mov.monto)}? No se puede deshacer.`))) return;
  ocupado.value = true;
  error.value = '';
  try {
    if (tipo === 'gasto') await eliminarGasto(mov.id);
    else await eliminarIngreso(mov.id);
    detalle.value = null;
    await cargar();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    ocupado.value = false;
  }
}

async function onEliminarCompra(compra) {
  const ok = await confirmar(`¿Eliminar la compra "${compra.descripcion}" con sus ${compra.numeroCuotas} cuotas?`, {
    textoAceptar: 'Eliminar',
    peligroso: true,
  });
  if (!ok) return;
  ocupado.value = true;
  error.value = '';
  try {
    await eliminarCompraPersonal(compra.id);
    detalle.value = null;
    await cargar();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    ocupado.value = false;
  }
}

function onEditar() {
  const { tipo, mov } = detalle.value;
  detalle.value = null;
  if (tipo === 'compra') editarCompraPersonal(mov);
  else if (tipo === 'gasto') editarGastoPersonal(mov);
  else editandoIngreso.value = mov;
}
function onEditarCompraDeCuota() {
  const compra = compraDelDetalle.value;
  detalle.value = null;
  if (compra) editarCompraPersonal(compra);
}
async function onIngresoEditado() {
  editandoIngreso.value = null;
  await cargar();
}

// "Ir" desde "Para pagar", una notificación o Inicio: /movimientos#gasto-<id> (o #ingreso-<id>).
useAncla(
  async (hash) => {
    const mi = /^#ingreso-(.+)$/.exec(hash);
    if (mi) {
      if (!ingresos.value.some((i) => i.id === mi[1])) return null;
      if (tab.value === 'gastos' || tab.value === 'compras') tab.value = 'todos';
      if (!filas.value.some((f) => f.tipo === 'ingreso' && f.mov.id === mi[1])) limpiarFiltros();
      const idx = filas.value.findIndex((f) => f.tipo === 'ingreso' && f.mov.id === mi[1]);
      if (idx >= limite.value) limite.value = idx + 1;
      await nextTick();
      return `ingreso-${mi[1]}`;
    }
    const m = /^#gasto-(.+)$/.exec(hash);
    if (!m) return null;
    const gasto = gastos.value.find((g) => g.id === m[1]);
    if (!gasto) return null;
    if (!gastosALaFecha.value.some((g) => g.id === gasto.id)) {
      if (!gasto.compraId) return null;
      tab.value = 'compras';
      await nextTick();
      return `compra-${gasto.compraId}`;
    }
    if (tab.value !== 'todos') tab.value = 'todos';
    if (!filas.value.some((f) => f.tipo === 'gasto' && f.mov.id === gasto.id)) limpiarFiltros();
    const idx = filas.value.findIndex((f) => f.tipo === 'gasto' && f.mov.id === gasto.id);
    if (idx >= limite.value) limite.value = idx + 1;
    await nextTick();
    return `gasto-${gasto.id}`;
  },
  () => !loading.value,
);

function iconoDe(tipo, mov) {
  if (tipo === 'ingreso') return mov.origenConfigId ? 'repeat' : 'arrowDownLeft';
  return ORIGEN_MOVIMIENTO[mov.origen]?.icono ?? (mov.origenConfigId ? 'repeat' : mov.compraId ? 'calendar' : 'receipt');
}
</script>

<template>
  <AppLayout title="Movimientos" subtitle="La plata que de verdad entró y salió de tus cuentas.">
    <template #actions>
      <button type="button" class="btn-secondary" aria-label="Exportar" @click="exportando = true">
        <AppIcon name="arrowDownLeft" class="h-4 w-4" />
        <span class="hidden sm:inline">Exportar</span>
      </button>
      <button type="button" class="btn-primary" aria-label="Registrar movimiento" @click="abrirRegistro('gasto')">
        <AppIcon name="plus" class="h-4 w-4" :stroke-width="2.2" />
        <span class="hidden sm:inline">Registrar</span>
      </button>
    </template>

    <div class="space-y-4">
      <!-- Buscar y filtrar -->
      <div class="flex items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <AppIcon name="search" class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
          <label class="sr-only" for="mov-buscar">Buscar</label>
          <input
            id="mov-buscar"
            v-model="busqueda"
            type="search"
            class="field !pl-10"
            placeholder="Buscar: mercado, Nequi, 45000…"
            autocomplete="off"
          />
        </div>
        <button
          v-if="tab !== 'compras'"
          type="button"
          class="btn-secondary relative shrink-0"
          :aria-label="cantidadFiltros ? `Filtros (${cantidadFiltros} activos)` : 'Filtros'"
          @click="mostrarFiltros = true"
        >
          <AppIcon name="sliders" class="h-4 w-4" />
          <span class="hidden sm:inline">Filtrar</span>
          <span
            v-if="cantidadFiltros"
            class="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-on"
          >{{ cantidadFiltros }}</span>
        </button>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="tabs" role="tablist" aria-label="Tipo de movimiento">
          <button
            v-for="t in [
              { id: 'todos', texto: 'Todos' },
              { id: 'gastos', texto: 'Gastos' },
              { id: 'ingresos', texto: 'Ingresos' },
              { id: 'compras', texto: 'A cuotas' },
            ]"
            :key="t.id"
            type="button"
            role="tab"
            class="tab"
            :class="{ 'tab-active': tab === t.id }"
            :aria-selected="tab === t.id"
            @click="tab = t.id"
          >
            {{ t.texto }}
          </button>
        </div>
        <p v-if="tab !== 'compras' && !loading" class="text-[13px] text-ink-secondary">
          <span v-if="tab !== 'gastos'" class="whitespace-nowrap">
            Entró <span class="font-semibold text-positive">+{{ formatCurrency(totales.entradas) }}</span>
          </span>
          <span v-if="tab === 'todos'" class="mx-1.5 text-ink-tertiary" aria-hidden="true">/</span>
          <span v-if="tab !== 'ingresos'" class="whitespace-nowrap">
            Salió <span class="font-semibold text-ink-primary">−{{ formatCurrency(totales.salidas) }}</span>
          </span>
        </p>
      </div>

      <p v-if="hayFiltro && tab !== 'compras'" class="flex flex-wrap items-center gap-2 text-[13px] text-ink-secondary">
        <span>{{ filas.length }} {{ filas.length === 1 ? 'movimiento' : 'movimientos' }}</span>
        <span v-if="filtroDesde || filtroHasta" class="badge-neutral">
          {{ filtroDesde ? formatDate(filtroDesde) : 'Inicio' }} – {{ filtroHasta ? formatDate(filtroHasta) : 'hoy' }}
        </span>
        <button type="button" class="font-medium text-accent hover:underline" @click="limpiarFiltros">Quitar filtros</button>
      </p>

      <AlertError v-if="!detalle" :message="error" />

      <!-- Lista -->
      <div v-if="loading" class="card card-pad space-y-3" aria-busy="true">
        <div v-for="n in 6" :key="n" class="h-11 rounded-lg bg-surface-sunken animate-pulse" />
      </div>

      <template v-else-if="tab !== 'compras'">
        <div v-if="!filas.length" class="card empty py-12">
          <AppIcon name="receipt" class="mx-auto mb-2 h-6 w-6" />
          <template v-if="hayFiltro">Nada coincide con la búsqueda o los filtros.</template>
          <template v-else>Aún no tienes movimientos.</template>
          <div v-if="!hayFiltro" class="mt-4">
            <button type="button" class="btn-secondary btn-sm" @click="abrirRegistro(tab === 'ingresos' ? 'ingreso' : 'gasto')">
              <AppIcon name="plus" class="h-3.5 w-3.5" />
              {{ tab === 'ingresos' ? 'Registrar ingreso' : 'Registrar movimiento' }}
            </button>
          </div>
        </div>

        <section v-for="grupo in grupos" :key="grupo.dia" :aria-label="grupo.etiqueta">
          <h2 class="mb-1.5 px-1 text-[13px] font-semibold text-ink-tertiary">{{ grupo.etiqueta }}</h2>
          <ul class="card divide-y divide-border overflow-hidden">
            <li v-for="fila in grupo.filas" :id="`${fila.tipo}-${fila.mov.id}`" :key="`${fila.tipo}-${fila.mov.id}`">
              <button
                type="button"
                class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none sm:px-5"
                @click="abrirDetalle(fila)"
              >
                <span
                  class="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                  :class="fila.tipo === 'ingreso' ? 'bg-positive/10 text-positive' : 'bg-surface-sunken text-ink-secondary'"
                >
                  <AppIcon :name="iconoDe(fila.tipo, fila.mov)" class="h-[18px] w-[18px]" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold text-ink-primary">{{ tituloMovimiento(fila.mov, fila.tipo) }}</span>
                  <span class="block truncate text-[13px] text-ink-tertiary">
                    <template v-if="fila.mov.estado === 'pendiente'"><span class="font-medium text-warning">Pendiente</span> · </template>
                    <template v-if="ORIGEN_MOVIMIENTO[fila.mov.origen]">{{ ORIGEN_MOVIMIENTO[fila.mov.origen].badge }}</template>
                    <template v-else-if="fila.mov.compra">Cuota {{ fila.mov.numeroCuota }}/{{ fila.mov.compra.numeroCuotas }}</template>
                    <template v-else>{{ fila.mov.categoria?.nombre ?? (fila.tipo === 'ingreso' ? 'Ingreso' : 'Gasto') }}</template>
                    <template v-if="fila.mov.metodoPago"> · {{ fila.mov.metodoPago.nombre }}</template>
                  </span>
                </span>
                <span class="shrink-0 text-right">
                  <span class="block text-sm font-bold" :class="fila.tipo === 'ingreso' ? 'text-positive' : 'text-ink-primary'">
                    {{ fila.tipo === 'ingreso' ? '+' : '−' }}{{ formatCurrency(fila.mov.monto) }}
                  </span>
                  <span v-if="fila.mov.montoUsd" class="block text-xs text-ink-tertiary">{{ formatUsd(fila.mov.montoUsd) }}</span>
                </span>
              </button>
            </li>
          </ul>
        </section>

        <div v-if="filas.length > limite" class="text-center">
          <button type="button" class="btn-secondary btn-sm" @click="limite += POR_PAGINA">
            Ver más ({{ filas.length - limite }})
          </button>
        </div>
      </template>

      <!-- Compras a cuotas -->
      <template v-else>
        <div v-if="!comprasVisibles.length" class="card empty py-12">
          <AppIcon name="calendar" class="mx-auto mb-2 h-6 w-6" />
          No tienes compras a cuotas. Regístralas desde Registrar, marcando "Es una compra a cuotas".
        </div>
        <ul v-else class="card divide-y divide-border overflow-hidden">
          <li v-for="compra in comprasVisibles" :id="`compra-${compra.id}`" :key="compra.id">
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none sm:px-5"
              @click="abrirDetalle({ tipo: 'compra', mov: compra })"
            >
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-sunken text-ink-secondary">
                <AppIcon name="calendar" class="h-[18px] w-[18px]" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-ink-primary">{{ compra.descripcion }}</span>
                <span class="block truncate text-[13px] text-ink-tertiary">
                  {{ cuotasPagadasTotal(compra) }}/{{ compra.numeroCuotas }} pagadas
                  <template v-if="compra.metodoPago"> · {{ compra.metodoPago.nombre }}</template>
                </span>
              </span>
              <span class="shrink-0 text-right">
                <span class="block text-sm font-bold text-ink-primary">{{ formatCurrency(saldoCompra(compra)) }}</span>
                <span class="block text-xs text-ink-tertiary">por pagar</span>
              </span>
            </button>
          </li>
        </ul>
      </template>
    </div>

    <!-- Filtros -->
    <AppModal v-if="mostrarFiltros" title="Filtrar movimientos" @close="mostrarFiltros = false">
      <div class="space-y-5">
        <div>
          <p class="label">Período</p>
          <div class="flex flex-wrap gap-2">
            <button v-for="r in RANGOS" :key="r.id" type="button" class="btn-secondary btn-sm" @click="aplicarRango(r.id)">
              {{ r.texto }}
            </button>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label class="label" for="mov-desde">Desde</label>
              <input id="mov-desde" v-model="filtroDesde" type="date" class="field" />
            </div>
            <div>
              <label class="label" for="mov-hasta">Hasta</label>
              <input id="mov-hasta" v-model="filtroHasta" type="date" class="field" />
            </div>
          </div>
        </div>
        <div>
          <label class="label" for="mov-categoria">Categoría</label>
          <select id="mov-categoria" v-model="filtroCategoria" class="field">
            <option value="">Todas</option>
            <option value="sin">Sin categoría</option>
            <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nombre }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="mov-cuenta">Cuenta o tarjeta</label>
          <select id="mov-cuenta" v-model="filtroCuenta" class="field">
            <option value="">Todas</option>
            <option value="sin">Sin cuenta</option>
            <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
        </div>
        <div class="flex justify-between gap-2 pt-1">
          <button type="button" class="btn-ghost" @click="limpiarFiltros">Quitar filtros</button>
          <button type="button" class="btn-primary" @click="mostrarFiltros = false">Ver {{ filas.length }}</button>
        </div>
      </div>
    </AppModal>

    <!-- Detalle -->
    <AppModal
      v-if="detalle"
      :title="detalle.tipo === 'compra' ? 'Compra a cuotas' : detalle.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'"
      @close="detalle = null"
    >
      <!-- Compra a cuotas -->
      <div v-if="detalle.tipo === 'compra'" class="space-y-5">
        <div class="text-center">
          <p class="text-sm font-medium text-ink-secondary">{{ detalle.mov.descripcion }}</p>
          <p class="mt-1 text-[2rem] font-extrabold tracking-tight text-ink-primary">{{ formatCurrency(saldoCompra(detalle.mov)) }}</p>
          <p class="text-[13px] text-ink-tertiary">por pagar de {{ formatCurrency(detalle.mov.montoTotal) }}</p>
        </div>
        <dl class="panel-sunken divide-y divide-border text-sm">
          <div class="flex justify-between gap-3 px-4 py-2.5">
            <dt class="text-ink-secondary">Cuotas pagadas</dt>
            <dd class="font-medium text-ink-primary">{{ cuotasPagadasTotal(detalle.mov) }} de {{ detalle.mov.numeroCuotas }}</dd>
          </div>
          <div class="flex justify-between gap-3 px-4 py-2.5">
            <dt class="text-ink-secondary">{{ detalle.mov.cuotasPagadasAntes ? 'Próxima cuota registrada' : 'Primera cuota' }}</dt>
            <dd class="font-medium text-ink-primary">{{ formatDate(detalle.mov.fechaPrimeraCuota) }}</dd>
          </div>
          <div class="flex justify-between gap-3 px-4 py-2.5">
            <dt class="text-ink-secondary">Cobro</dt>
            <dd class="font-medium text-ink-primary">{{ detalle.mov.modoCobro === 'automatico' ? 'Automático' : 'Manual' }}</dd>
          </div>
          <div v-if="detalle.mov.metodoPago" class="flex justify-between gap-3 px-4 py-2.5">
            <dt class="text-ink-secondary">Cuenta</dt>
            <dd class="font-medium text-ink-primary">{{ detalle.mov.metodoPago.nombre }}</dd>
          </div>
          <div v-if="detalle.mov.montoUsd" class="flex justify-between gap-3 px-4 py-2.5">
            <dt class="text-ink-secondary">En dólares</dt>
            <dd class="font-medium text-ink-primary">{{ formatUsd(detalle.mov.montoUsd) }}</dd>
          </div>
        </dl>
        <AlertError :message="error" />
        <div class="space-y-2">
          <button type="button" class="btn-primary w-full" @click="onEditar">
            <AppIcon name="edit" class="h-4 w-4" /> Editar compra
          </button>
          <button
            v-if="detalle.mov.modoCobro !== 'manual' || !cuotasPagadas(detalle.mov)"
            type="button"
            class="btn-danger w-full"
            :disabled="ocupado"
            @click="onEliminarCompra(detalle.mov)"
          >
            <AppIcon name="trash" class="h-4 w-4" /> Eliminar
          </button>
        </div>
      </div>

      <!-- Gasto o ingreso -->
      <div v-else class="space-y-5">
        <div class="text-center">
          <span
            class="mx-auto grid h-12 w-12 place-items-center rounded-full"
            :class="detalle.tipo === 'ingreso' ? 'bg-positive/10 text-positive' : 'bg-surface-sunken text-ink-secondary'"
          >
            <AppIcon :name="iconoDe(detalle.tipo, detalle.mov)" class="h-5 w-5" />
          </span>
          <p class="mt-3 text-sm font-medium text-ink-secondary">{{ tituloMovimiento(detalle.mov, detalle.tipo) }}</p>
          <p class="mt-1 text-[2rem] font-extrabold tracking-tight" :class="detalle.tipo === 'ingreso' ? 'text-positive' : 'text-ink-primary'">
            {{ detalle.tipo === 'ingreso' ? '+' : '−' }}{{ formatCurrency(detalle.mov.monto) }}
          </p>
          <p v-if="detalle.mov.montoUsd" class="text-[13px] text-ink-tertiary">
            {{ formatUsd(detalle.mov.montoUsd) }}<template v-if="detalle.mov.trm"> a {{ formatCurrency(detalle.mov.trm) }}</template>
          </p>
          <div class="mt-2 flex flex-wrap justify-center gap-1.5">
            <span v-if="detalle.mov.estado === 'pendiente'" class="badge-warning">Pendiente</span>
            <span v-if="detalle.mov.esObligatorio" class="badge-accent">Obligatorio</span>
            <span v-if="detalle.mov.origenConfigId" class="badge-neutral">Fijo</span>
            <span v-if="ORIGEN_MOVIMIENTO[detalle.mov.origen]" class="badge-neutral">
              {{ detalle.mov.origen === 'liquidacion_hogar' && detalle.tipo === 'ingreso' ? 'Reintegro del cuadre' : ORIGEN_MOVIMIENTO[detalle.mov.origen].badge }}
            </span>
            <span v-if="detalle.mov.compra" class="badge-neutral">Cuota {{ detalle.mov.numeroCuota }}/{{ detalle.mov.compra.numeroCuotas }}</span>
          </div>
        </div>

        <dl class="panel-sunken divide-y divide-border text-sm">
          <div class="flex justify-between gap-3 px-4 py-2.5">
            <dt class="text-ink-secondary">Fecha</dt>
            <dd class="font-medium text-ink-primary">{{ formatDate(detalle.mov.fecha) }}</dd>
          </div>
          <div class="flex justify-between gap-3 px-4 py-2.5">
            <dt class="text-ink-secondary">Categoría</dt>
            <dd class="font-medium text-ink-primary">{{ detalle.mov.categoria?.nombre ?? 'Sin categoría' }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt class="text-ink-secondary">{{ detalle.tipo === 'ingreso' ? 'Dónde entró' : 'Con qué se pagó' }}</dt>
            <dd class="min-w-0 font-medium text-ink-primary">
              <template v-if="esDelHogar(detalle.mov)">
                <label for="det-metodo" class="sr-only">Cuenta</label>
                <select
                  id="det-metodo"
                  class="field !w-auto !py-1.5 !text-[13px]"
                  :value="detalle.mov.metodoPagoId ?? ''"
                  @change="onCambiarMetodo($event.target.value)"
                >
                  <option value="">Sin definir</option>
                  <option
                    v-for="m in detalle.tipo === 'ingreso' ? metodos.filter((x) => x.tipo !== 'tarjeta_credito') : metodos"
                    :key="m.id"
                    :value="m.id"
                  >
                    {{ m.nombre }}
                  </option>
                </select>
              </template>
              <template v-else>{{ detalle.mov.metodoPago?.nombre ?? 'Sin definir' }}</template>
            </dd>
          </div>
          <div v-if="detalle.mov.registradoPor && detalle.mov.registradoPor.id !== auth.usuario?.id" class="flex justify-between gap-3 px-4 py-2.5">
            <dt class="text-ink-secondary">Registrado por</dt>
            <dd class="font-medium text-ink-primary">{{ detalle.mov.registradoPor.nombre }}</dd>
          </div>
        </dl>
        <p v-if="esDelHogar(detalle.mov)" class="text-[13px] text-ink-tertiary">
          Viene del hogar: se edita en Hogar. Aquí solo eliges con qué cuenta salió o entró (solo lo ves tú).
        </p>
        <p v-else-if="esDeOtraPantalla(detalle.mov)" class="text-[13px] text-ink-tertiary">
          Se maneja desde su propia pantalla (préstamos, inversiones, ahorros o la cuenta).
        </p>

        <AlertError :message="error" />

        <div class="space-y-2">
          <div class="flex gap-2">
            <button v-if="puedeCambiarEstado(detalle.mov)" type="button" class="btn-secondary flex-1" :disabled="ocupado" @click="onCambiarEstado">
              <AppIcon v-if="detalle.mov.estado === 'pendiente'" name="check" class="h-4 w-4" :stroke-width="2.2" />
              <template v-if="detalle.tipo === 'gasto'">{{ detalle.mov.estado === 'pagado' ? 'Marcar pendiente' : 'Marcar pagado' }}</template>
              <template v-else>{{ detalle.mov.estado === 'recibido' ? 'Marcar pendiente' : 'Marcar recibido' }}</template>
            </button>
            <button v-if="compraDelDetalle" type="button" class="btn-primary flex-1" @click="onEditarCompraDeCuota">
              <AppIcon name="edit" class="h-4 w-4" /> Editar la compra
            </button>
            <button v-else-if="puedeEditar(detalle.tipo, detalle.mov)" type="button" class="btn-primary flex-1" @click="onEditar">
              <AppIcon name="edit" class="h-4 w-4" /> Editar
            </button>
          </div>
          <button v-if="puedeEliminar(detalle.mov)" type="button" class="btn-danger w-full" :disabled="ocupado" @click="onEliminar">
            <AppIcon name="trash" class="h-4 w-4" /> Eliminar
          </button>
        </div>
      </div>
    </AppModal>

    <AppModal v-if="exportando" title="Exportar" @close="exportando = false">
      <ExportarDatos :desde-inicial="filtroDesde" :hasta-inicial="filtroHasta" />
    </AppModal>
    <EditarMovimientoModal
      v-if="editandoIngreso"
      tipo="ingreso"
      :movimiento="editandoIngreso"
      :categorias="categorias"
      :metodos="metodos"
      @cerrar="editandoIngreso = null"
      @guardado="onIngresoEditado"
    />
  </AppLayout>
</template>
