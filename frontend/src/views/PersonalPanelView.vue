<script setup>
import { useRoute, useRouter } from 'vue-router';
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { listarGastos, crearGasto, actualizarGasto, eliminarGasto, cambiarMetodoGasto } from '../api/gastosPersonales.js';
import { listarIngresos, crearIngreso, actualizarIngreso, eliminarIngreso, cambiarMetodoIngreso } from '../api/ingresosPersonales.js';
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
import { formatCurrency, formatDate, hoyISO, modoCobroSugerido, formatTasa, formatUsd, aCentavos } from '../utils/format.js';
import AppLayout from '../components/AppLayout.vue';
import FormField from '../components/FormField.vue';
import AlertError from '../components/AlertError.vue';
import AppModal from '../components/AppModal.vue';
import ExportarDatos from '../components/ExportarDatos.vue';
import { useAuthStore } from '../stores/auth.js';
import AvisosPagar from '../components/AvisosPagar.vue';
import EditarMovimientoModal from '../components/personal/EditarMovimientoModal.vue';
import AppIcon from '../components/AppIcon.vue';
import { useAncla } from '../composables/useAncla.js';
import ConfiguracionPersonalSection from '../components/personal/ConfiguracionPersonalSection.vue';
import ResumenPersonalSection from '../components/personal/ResumenPersonalSection.vue';
import AhorrosPersonalesSection from '../components/personal/AhorrosPersonalesSection.vue';
import LimitesPersonalesSection from '../components/personal/LimitesPersonalesSection.vue';
import ProximosMesesSection from '../components/personal/ProximosMesesSection.vue';
import CompraCuotasForm from '../components/CompraCuotasForm.vue';
import CamposDolares from '../components/personal/CamposDolares.vue';

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

// --- Navegación por ciclos (Etapa 6): 0 = el actual, -1 = el anterior… ---
const CICLOS_HACIA_ATRAS = 24;
const ciclo = ref(0);
const infoCiclo = ref(null);
// Al cambiar de ciclo, el filtro de Movimientos pasa a su rango cuando llega.
let sincronizarFiltro = false;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombreCiclo = computed(() => {
  const info = infoCiclo.value;
  if (!info) return '';
  const ini = new Date(info.inicio);
  const fin = new Date(info.fin);
  if (info.frecuencia === 'mensual') return `${MESES[ini.getUTCMonth()]} ${ini.getUTCFullYear()}`;
  const mismoMes = ini.getUTCMonth() === fin.getUTCMonth();
  const desde = mismoMes ? `${ini.getUTCDate()}` : `${ini.getUTCDate()} ${MESES_CORTOS[ini.getUTCMonth()]}`;
  return `${desde}–${fin.getUTCDate()} ${MESES_CORTOS[fin.getUTCMonth()]} ${fin.getUTCFullYear()}`;
});

function moverCiclo(delta) {
  const nuevo = Math.min(0, Math.max(-CICLOS_HACIA_ATRAS, ciclo.value + delta));
  if (nuevo === ciclo.value) return;
  sincronizarFiltro = true;
  ciclo.value = nuevo;
}

function volverAlActual() {
  sincronizarFiltro = true;
  ciclo.value = 0;
}

function onCicloCargado(info) {
  infoCiclo.value = info;
  if (!sincronizarFiltro) return;
  sincronizarFiltro = false;
  verTodo.value = false;
  filtroDesde.value = String(info.inicio).slice(0, 10);
  filtroHasta.value = String(info.fin).slice(0, 10);
}

// Un aporte o retiro de ahorro mueve la caja: Disponible y movimientos al día.
function onCambioAhorro() {
  resumenRef.value?.recargar();
  proximosRef.value?.recargar();
  cargarGastos();
  cargarIngresos();
}

const avisosRef = ref(null);

function recargarResumenes() {
  avisosRef.value?.recargar();
  resumenRef.value?.recargar();
  proximosRef.value?.recargar();
  ahorrosRef.value?.recargar();
  limitesRef.value?.recargar();
}

// Quién soy: para mostrar "Registrado por" en lo que registró otro miembro.
const authPanel = useAuthStore();
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
// Compra en dólares (solo con tarjeta de crédito): el monto en pesos sale de
// los US$ y la tasa, y se puede corregir a mano después.
const gEnDolares = ref(false);
const gUsd = ref('');
const gTrm = ref('');

// --- Compra a cuotas (opción del formulario de gasto) ---
const gACuotas = ref(false);
const gNumeroCuotas = ref('3');
const gPrimeraCuota = ref('');
const gModoCobro = ref('automatico');
// Compra que ya venía en curso: cuántas cuotas se pagaron antes de empezar a usar la app.
const gEnCurso = ref(false);
const gCuotasPagadas = ref('');
// Interés de la compra: el de la tarjeta (por defecto si tiene), sin interés u otra tasa.
const gInteres = ref('sin');
const gTasa = ref('');
const gSistema = ref('capital_fijo');
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
  gInteres.value = metodo?.tasaMensual > 0 ? 'tarjeta' : 'sin';
  try {
    gPrimeraCuota.value = await sugerirPrimeraCuota(gFecha.value, gMetodoPagoId.value || undefined);
  } catch {
    // sin sugerencia: el usuario la escribe
  }
}
watch([gACuotas, gMetodoPagoId, gFecha], actualizarSugerenciaCuota);

const metodoSeleccionado = computed(() => metodos.value.find((m) => m.id === gMetodoPagoId.value));
const conTarjeta = computed(() => metodoSeleccionado.value?.tipo === 'tarjeta_credito');
watch(conTarjeta, (si) => {
  if (!si) gEnDolares.value = false;
});
watch([gEnDolares, gUsd, gTrm], () => {
  if (!gEnDolares.value) return;
  const usd = Number(String(gUsd.value).replace(',', '.'));
  const trm = Number(String(gTrm.value).replace(',', '.'));
  if (usd > 0 && trm > 0) gMonto.value = String(Math.round(usd * trm));
});
const dolaresGasto = () =>
  gEnDolares.value ? { montoUsd: aCentavos(gUsd.value), trm: Number(String(gTrm.value).replace(',', '.')) } : {};
function limpiarDolares() {
  gEnDolares.value = false;
  gUsd.value = '';
}

const valorCuota = computed(() => {
  const n = Number(gNumeroCuotas.value);
  const total = Number(gMonto.value);
  return n >= 1 && total > 0 ? Math.floor(total / n) : null;
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
    ...(gEnCurso.value ? { cuotasPagadasAntes: Number(gCuotasPagadas.value) || 0 } : {}),
    ...(gInteres.value === 'tarjeta'
      ? {}
      : { tasaMensual: gInteres.value === 'otra' ? Number(gTasa.value) || 0 : 0, sistemaInteres: gSistema.value }),
    metodoPagoId: gMetodoPagoId.value || undefined,
    categoriaId: gCategoriaId.value || undefined,
    esObligatorio: gEsObligatorio.value,
    ...dolaresGasto(),
  });
  gTasa.value = '';
  gEnCurso.value = false;
  gCuotasPagadas.value = '';
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
      limpiarDolares();
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
      ...dolaresGasto(),
    });
    gastos.value = [nuevo, ...gastos.value];
    limpiarDolares();
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
  const gasto = gastos.value.find((g) => g.id === id);
  const nombre = gasto?.descripcion || gasto?.categoria?.nombre || 'este gasto';
  if (!(await confirmar(`¿Eliminar "${nombre}" de ${formatCurrency(gasto?.monto ?? 0)}? No se puede deshacer.`))) return;
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
  const ingreso = ingresos.value.find((i) => i.id === id);
  const nombre = ingreso?.descripcion || ingreso?.categoria?.nombre || 'este ingreso';
  if (!(await confirmar(`¿Eliminar "${nombre}" de ${formatCurrency(ingreso?.monto ?? 0)}? No se puede deshacer.`))) return;
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
const tabMovimientos = ref('todos');
const LIMITE_LISTA = 8;
const verTodo = ref(false);

function abrirRegistro(tipo = 'gasto') {
  tipoRegistro.value = tipo;
  error.value = '';
  mostrarRegistro.value = true;
}

// "+ Registrar" de la barra del celular: /personal?registrar=gasto abre el modal.
const routeActual = useRoute();
const routerPanel = useRouter();
watch(
  () => routeActual.query.registrar,
  (tipo) => {
    if (!tipo) return;
    abrirRegistro(tipo === 'ingreso' ? 'ingreso' : 'gasto');
    routerPanel.replace({ query: { ...routeActual.query, registrar: undefined } });
  },
  { immediate: true },
);

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
  return gastos.value.filter((g) => (!g.compraId && !g.prestamoId) || g.fecha.slice(0, 10) <= hoy);
});

// --- Filtro por fechas (Todos, Gastos, Ingresos) ---
// Editar un gasto o ingreso suelto (los del hogar, préstamos, cuotas,
// ahorros o inversiones se editan en su pantalla).
const editandoMov = ref(null); // { tipo, mov }
function esEditableAqui(mov, tipo) {
  if (esDelHogar(mov) || esDeOtraPantalla(mov)) return false;
  if (tipo === 'gasto') return !mov.compraId && mov.origen !== 'pago_tarjeta';
  return mov.origen !== 'desembolso_prestamo';
}
function onMovimientoEditado(actualizado) {
  const lista = editandoMov.value.tipo === 'gasto' ? gastos : ingresos;
  const i = lista.value.findIndex((x) => x.id === actualizado.id);
  if (i >= 0) lista.value[i] = actualizado;
  editandoMov.value = null;
  recargarResumenes();
}

// Exportar con el rango de fechas que tenga puesto el filtro.
const exportando = ref(false);
const filtroDesde = ref('');
const filtroHasta = ref('');
// Búsqueda por texto (descripción, categoría, cuenta o valor) y filtros por
// categoría y cuenta ('' = todas, 'sin' = sin definir). Se suman a las fechas.
const busqueda = ref('');
const filtroCategoria = ref('');
const filtroCuenta = ref('');
const hayFiltro = computed(() => Boolean(filtroDesde.value || filtroHasta.value));
const hayFiltroExtra = computed(() => Boolean(busqueda.value.trim() || filtroCategoria.value || filtroCuenta.value));
watch([busqueda, filtroCategoria, filtroCuenta], () => {
  verTodo.value = false;
});

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function coincide(m) {
  if (filtroCategoria.value && (filtroCategoria.value === 'sin' ? m.categoriaId : m.categoriaId !== filtroCategoria.value)) return false;
  if (filtroCuenta.value && (filtroCuenta.value === 'sin' ? m.metodoPagoId : m.metodoPagoId !== filtroCuenta.value)) return false;
  const q = normalizar(busqueda.value.trim());
  if (!q) return true;
  const digitos = q.replace(/[$.\s]/g, '');
  if (/^\d+$/.test(digitos) && String(m.monto).includes(digitos)) return true;
  return [m.descripcion, m.categoria?.nombre, m.metodoPago?.nombre].some((t) => normalizar(t).includes(q));
}

function limpiarFiltros() {
  busqueda.value = '';
  filtroCategoria.value = '';
  filtroCuenta.value = '';
  aplicarRango('todo');
}

function enRango(fecha) {
  const f = String(fecha).slice(0, 10);
  return (!filtroDesde.value || f >= filtroDesde.value) && (!filtroHasta.value || f <= filtroHasta.value);
}

function isoDe(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function aplicarRango(tipo) {
  const hoy = new Date();
  verTodo.value = false;
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

// Filas de la lista: { tipo: 'gasto' | 'ingreso', mov }, más recientes primero.
function filas(lista, tipo) {
  return lista.filter((m) => enRango(m.fecha) && coincide(m)).map((mov) => ({ tipo, mov }));
}
function porFechaDesc(a, b) {
  const fa = String(a.mov.fecha).slice(0, 10);
  const fb = String(b.mov.fecha).slice(0, 10);
  if (fa !== fb) return fa < fb ? 1 : -1;
  return String(b.mov.creadoEn ?? '').localeCompare(String(a.mov.creadoEn ?? ''));
}
const filasMovimientos = computed(() => {
  if (tabMovimientos.value === 'gastos') return filas(gastosALaFecha.value, 'gasto').sort(porFechaDesc);
  if (tabMovimientos.value === 'ingresos') return filas(ingresos.value, 'ingreso').sort(porFechaDesc);
  return [...filas(gastosALaFecha.value, 'gasto'), ...filas(ingresos.value, 'ingreso')].sort(porFechaDesc);
});

// Totales de caja de lo que se está viendo (solo lo ya pagado/recibido).
const totalesFiltro = computed(() => {
  let entradas = 0;
  let salidas = 0;
  for (const { tipo, mov } of filasMovimientos.value) {
    if (tipo === 'ingreso' && mov.estado === 'recibido') entradas += mov.monto;
    if (tipo === 'gasto' && mov.estado === 'pagado') salidas += mov.monto;
  }
  return { entradas, salidas };
});

function listaDeTab() {
  if (tabMovimientos.value === 'compras') return compras.value;
  return filasMovimientos.value;
}
const listaVisible = computed(() => (verTodo.value ? listaDeTab() : listaDeTab().slice(0, LIMITE_LISTA)));
const totalLista = computed(() => listaDeTab().length);

// "Ir" desde "Para pagar" o una notificación: /personal#gasto-<id> muestra el
// movimiento (quita filtros si lo ocultan) y lo resalta. Una cuota futura no
// está en la lista: se resalta su compra en la pestaña A cuotas.
useAncla(
  async (hash) => {
    const m = /^#gasto-(.+)$/.exec(hash);
    if (!m) return null;
    const gasto = gastos.value.find((g) => g.id === m[1]);
    if (!gasto) return null;
    if (!gastosALaFecha.value.some((g) => g.id === gasto.id)) {
      if (!gasto.compraId) return null;
      tabMovimientos.value = 'compras';
      await nextTick();
      verTodo.value = true;
      return `compra-${gasto.compraId}`;
    }
    const enLista = () => filasMovimientos.value.findIndex((f) => f.tipo === 'gasto' && f.mov.id === gasto.id);
    if (tabMovimientos.value === 'ingresos' || tabMovimientos.value === 'compras') tabMovimientos.value = 'todos';
    if (enLista() === -1) limpiarFiltros();
    await nextTick();
    if (enLista() >= LIMITE_LISTA) verTodo.value = true;
    return `gasto-${gasto.id}`;
  },
  () => !loading.value,
);

// Movimientos de caja que se manejan desde Hogar/Cuadres/Métodos de pago.
const ORIGEN_MOVIMIENTO = {
  pago_hogar: { badge: 'Pago del hogar', icono: 'home' },
  liquidacion_hogar: { badge: 'Cuadre', icono: 'scale' },
  pago_tarjeta: { badge: 'Pago de tarjeta', icono: 'wallet' },
  abono_prestamo: { badge: 'Abono a préstamo', icono: 'receipt' },
  desembolso_prestamo: { badge: 'Desembolso', icono: 'receipt' },
  aporte_inversion: { badge: 'Inversión', icono: 'trendingUp' },
  retiro_inversion: { badge: 'Inversión', icono: 'trendingUp' },
  aporte_meta_hogar: { badge: 'Meta del hogar', icono: 'piggy' },
  retiro_meta_hogar: { badge: 'Meta del hogar', icono: 'piggy' },
  aporte_ahorro: { badge: 'Ahorro', icono: 'piggy' },
  retiro_ahorro: { badge: 'Ahorro', icono: 'piggy' },
  saldo_inicial: { badge: 'Punto de partida', icono: 'wallet' },
};
function esDelHogar(mov) {
  return mov.origen === 'pago_hogar' || mov.origen === 'liquidacion_hogar';
}
// Movimientos que se manejan desde Patrimonio (préstamos, inversiones) o la meta del hogar.
const ORIGENES_DE_OTRA_PANTALLA = [
  'abono_prestamo',
  'aporte_inversion',
  'retiro_inversion',
  'aporte_meta_hogar',
  'retiro_meta_hogar',
  'aporte_ahorro',
  'retiro_ahorro',
  // Saldo o deuda inicial: se cambia en Configuración → Métodos de pago.
  'saldo_inicial',
];
function esDeOtraPantalla(mov) {
  return Boolean(mov.prestamoId) || ORIGENES_DE_OTRA_PANTALLA.includes(mov.origen);
}

// En los movimientos del hogar solo se puede cambiar el método (con qué se
// pagó o dónde entró): se puede definir después de pagar o de cuadrar.
const metodoEditando = ref(null);
async function onCambiarMetodo(tipo, mov, metodoPagoId) {
  error.value = '';
  try {
    if (tipo === 'gasto') {
      const actualizado = await cambiarMetodoGasto(mov.id, metodoPagoId || null);
      gastos.value[gastos.value.findIndex((g) => g.id === mov.id)] = actualizado;
    } else {
      const actualizado = await cambiarMetodoIngreso(mov.id, metodoPagoId || null);
      ingresos.value[ingresos.value.findIndex((i) => i.id === mov.id)] = actualizado;
    }
    metodoEditando.value = null;
    recargarResumenes();
  } catch (e) {
    error.value = extractErrorMessage(e);
  }
}

function cuotasPagadas(compra) {
  return compra.cuotas.filter((c) => c.estado === 'pagado').length;
}
// Para mostrar: incluye las que se pagaron antes de registrar la compra (en curso).
function cuotasPagadasTotal(compra) {
  return (compra.cuotasPagadasAntes ?? 0) + cuotasPagadas(compra);
}
function saldoCompra(compra) {
  return compra.cuotas.filter((c) => c.estado !== 'pagado').reduce((acc, c) => acc + c.monto, 0);
}
</script>

<template>
  <AppLayout title="Personal" subtitle="Tu dinero: disponible, compromisos, límites y ahorros.">
    <template #actions>
      <router-link :to="{ name: 'tarjetas' }" class="btn-secondary" aria-label="Tarjetas y cuentas">
        <AppIcon name="wallet" class="h-4 w-4" />
        <span class="hidden sm:inline">Tarjetas</span>
      </router-link>
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
      <!-- Ciclo que se está viendo -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="btn-icon"
            aria-label="Ciclo anterior"
            :disabled="ciclo <= -CICLOS_HACIA_ATRAS"
            @click="moverCiclo(-1)"
          >
            <AppIcon name="chevronLeft" class="h-4 w-4" />
          </button>
          <span class="min-w-[10rem] text-center text-sm font-medium capitalize text-ink-primary" aria-live="polite">
            {{ nombreCiclo || '…' }}
          </span>
          <button type="button" class="btn-icon" aria-label="Ciclo siguiente" :disabled="ciclo >= 0" @click="moverCiclo(1)">
            <AppIcon name="chevronRight" class="h-4 w-4" />
          </button>
        </div>
        <div v-if="ciclo < 0" class="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-1.5 text-[13px] text-ink-secondary">
          <AppIcon name="clock" class="h-4 w-4 text-accent" />
          Estás viendo un ciclo pasado.
          <button type="button" class="btn-ghost btn-sm !py-0.5" @click="volverAlActual">Volver al actual</button>
        </div>
      </div>

      <AvisosPagar v-if="ciclo === 0" ref="avisosRef" ambito="personal" />
      <ResumenPersonalSection ref="resumenRef" :ciclo="ciclo" @ciclo="onCicloCargado" />
      <ProximosMesesSection v-if="ciclo === 0" ref="proximosRef" />

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section class="card card-pad">
          <div class="flex items-start justify-between gap-3 mb-4 sm:mb-5">
            <div class="flex items-center gap-3">
              <span class="hidden sm:grid h-9 w-9 place-items-center rounded-xl bg-surface-sunken text-ink-secondary">
                <AppIcon name="gauge" class="h-[18px] w-[18px]" />
              </span>
              <div>
                <h2 class="section-title">Límites</h2>
                <p class="section-hint">{{ ciclo === 0 ? 'Topes de gasto del ciclo actual.' : 'Cómo te fue con tus topes en ese ciclo.' }}</p>
              </div>
            </div>
            <button type="button" class="btn-ghost btn-sm" @click="abrirConfig('limites')">Configurar</button>
          </div>
          <LimitesPersonalesSection ref="limitesRef" :ciclo="ciclo" />
        </section>

        <section class="card card-pad">
          <div class="flex items-start justify-between gap-3 mb-4 sm:mb-5">
            <div class="flex items-center gap-3">
              <span class="hidden sm:grid h-9 w-9 place-items-center rounded-xl bg-surface-sunken text-ink-secondary">
                <AppIcon name="piggy" class="h-[18px] w-[18px]" />
              </span>
              <div>
                <h2 class="section-title">Ahorros</h2>
                <p class="section-hint">{{ ciclo === 0 ? 'Metas y aportes del ciclo.' : 'Metas y aportes de ese ciclo.' }}</p>
              </div>
            </div>
            <button type="button" class="btn-ghost btn-sm" @click="abrirConfig('ahorros')">Configurar</button>
          </div>
          <AhorrosPersonalesSection ref="ahorrosRef" :ciclo="ciclo" @cambio="onCambioAhorro" />
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
              :class="{ 'tab-active': tabMovimientos === 'todos' }"
              :aria-selected="tabMovimientos === 'todos'"
              @click="cambiarTab('todos')"
            >
              Todos <span class="ml-1 text-ink-tertiary">{{ gastosALaFecha.length + ingresos.length }}</span>
            </button>
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

        <div
          v-if="tabMovimientos !== 'compras'"
          class="mx-5 sm:mx-6 mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface-sunken/60 p-3"
        >
          <div class="grid w-full grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div class="col-span-2 sm:col-span-1">
              <label class="sr-only" for="mov-buscar">Buscar</label>
              <input
                id="mov-buscar"
                v-model="busqueda"
                type="search"
                class="field !py-1.5"
                placeholder="Buscar: mercado, Nequi, 45000…"
                autocomplete="off"
              />
            </div>
            <div>
              <label class="sr-only" for="mov-categoria">Categoría</label>
              <select id="mov-categoria" v-model="filtroCategoria" class="field !py-1.5 sm:!w-auto sm:!text-[13px]">
                <option value="">Todas las categorías</option>
                <option value="sin">Sin categoría</option>
                <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nombre }}</option>
              </select>
            </div>
            <div>
              <label class="sr-only" for="mov-cuenta">Cuenta</label>
              <select id="mov-cuenta" v-model="filtroCuenta" class="field !py-1.5 sm:!w-auto sm:!text-[13px]">
                <option value="">Todas las cuentas</option>
                <option value="sin">Sin cuenta</option>
                <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
              </select>
            </div>
          </div>
          <div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-3">
            <div class="min-w-0">
              <label class="label !mb-1" for="mov-desde">Desde</label>
              <input id="mov-desde" v-model="filtroDesde" type="date" class="field !py-1.5 sm:!w-auto sm:!text-[13px]" @change="verTodo = false" />
            </div>
            <div class="min-w-0">
              <label class="label !mb-1" for="mov-hasta">Hasta</label>
              <input id="mov-hasta" v-model="filtroHasta" type="date" class="field !py-1.5 sm:!w-auto sm:!text-[13px]" @change="verTodo = false" />
            </div>
          </div>
          <div class="flex flex-wrap gap-1">
            <button type="button" class="btn-ghost btn-sm" @click="aplicarRango('mes')">Este mes</button>
            <button type="button" class="btn-ghost btn-sm" @click="aplicarRango('mesAnterior')">Mes anterior</button>
            <button type="button" class="btn-ghost btn-sm" @click="aplicarRango('30dias')">Últimos 30 días</button>
            <button v-if="hayFiltro || hayFiltroExtra" type="button" class="btn-ghost btn-sm" @click="limpiarFiltros">Quitar filtros</button>
            <button type="button" class="btn-ghost btn-sm" @click="exportando = true">
              <AppIcon name="arrowDownLeft" class="h-4 w-4" /> Exportar
            </button>
          </div>
          <p class="ml-auto text-[13px] text-ink-secondary">
            <span v-if="tabMovimientos !== 'gastos'" class="whitespace-nowrap">
              Entró <span class="font-semibold text-positive">+{{ formatCurrency(totalesFiltro.entradas) }}</span>
            </span>
            <span v-if="tabMovimientos === 'todos'" class="mx-1.5 text-ink-tertiary">·</span>
            <span v-if="tabMovimientos !== 'ingresos'" class="whitespace-nowrap">
              Salió <span class="font-semibold text-ink-primary">−{{ formatCurrency(totalesFiltro.salidas) }}</span>
            </span>
          </p>
        </div>

        <div class="px-5 sm:px-6 pb-2">
          <div v-if="loading" class="space-y-3 py-3" aria-busy="true">
            <div v-for="n in 4" :key="n" class="h-10 rounded-lg bg-surface-sunken animate-pulse" />
          </div>

          <div v-else-if="!totalLista" class="empty py-10">
            <AppIcon name="receipt" class="mx-auto mb-2 h-6 w-6" />
            {{
              hayFiltroExtra && tabMovimientos !== 'compras'
                ? 'Nada coincide con la búsqueda o los filtros.'
                : hayFiltro && tabMovimientos !== 'compras'
                ? 'No hay movimientos entre esas fechas.'
                : tabMovimientos === 'gastos'
                  ? 'Aún no has registrado gastos personales.'
                  : tabMovimientos === 'compras'
                    ? 'No tienes compras a cuotas. Regístralas desde Registrar movimiento, marcando "Es una compra a cuotas".'
                    : tabMovimientos === 'ingresos'
                      ? 'Aún no has registrado ingresos personales.'
                      : 'Aún no tienes movimientos.'
            }}
            <div v-if="tabMovimientos !== 'compras' && !hayFiltro && !hayFiltroExtra" class="mt-4">
              <button
                type="button"
                class="btn-secondary btn-sm"
                @click="abrirRegistro(tabMovimientos === 'ingresos' ? 'ingreso' : 'gasto')"
              >
                <AppIcon name="plus" class="h-3.5 w-3.5" />
                {{ tabMovimientos === 'ingresos' ? 'Registrar ingreso' : 'Registrar movimiento' }}
              </button>
            </div>
          </div>

          <!-- Todos / Gastos / Ingresos (una sola lista, más recientes primero) -->
          <ul v-else-if="tabMovimientos !== 'compras'" class="list">
            <template v-for="fila in listaVisible" :key="`${fila.tipo}-${fila.mov.id}`">
            <template v-if="fila.tipo === 'gasto'">
            <li v-for="gasto in [fila.mov]" :id="`gasto-${gasto.id}`" :key="gasto.id" class="list-row group">
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
                    <span v-if="gasto.registradoPor && gasto.registradoPor.id !== authPanel.usuario?.id" class="badge-accent">
                      Registrado por {{ gasto.registradoPor.nombre.split(' ')[0] }}
                    </span>
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
                <span class="text-right sm:mr-1">
                  <span class="block text-sm font-semibold text-ink-primary">−{{ formatCurrency(gasto.monto) }}</span>
                  <span v-if="gasto.montoUsd" class="block text-xs text-ink-tertiary">{{ formatUsd(gasto.montoUsd) }}</span>
                </span>
                <div v-if="metodoEditando === `gasto-${gasto.id}`" class="flex items-center gap-1">
                  <label :for="`metodo-gasto-${gasto.id}`" class="sr-only">Método de pago</label>
                  <select
                    :id="`metodo-gasto-${gasto.id}`"
                    class="field !w-auto !py-1.5 !text-[13px]"
                    :value="gasto.metodoPagoId ?? ''"
                    @change="onCambiarMetodo('gasto', gasto, $event.target.value)"
                  >
                    <option value="">Sin definir</option>
                    <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
                  </select>
                  <button type="button" class="btn-ghost btn-sm" @click="metodoEditando = null">Listo</button>
                </div>
                <div v-else class="flex items-center gap-1">
                  <button
                    v-if="esDelHogar(gasto)"
                    type="button"
                    class="btn-ghost btn-sm"
                    title="Con qué se pagó (solo lo ves tú)"
                    @click="metodoEditando = `gasto-${gasto.id}`"
                  >
                    {{ gasto.metodoPago ? 'Cambiar método' : 'Elegir método' }}
                  </button>
                  <button
                    v-if="!esDelHogar(gasto) && !esDeOtraPantalla(gasto)"
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
                    v-if="esEditableAqui(gasto, 'gasto')"
                    type="button"
                    class="btn-icon !p-1.5"
                    aria-label="Editar gasto"
                    title="Editar"
                    @click="editandoMov = { tipo: 'gasto', mov: gasto }"
                  >
                    <AppIcon name="edit" class="h-4 w-4" />
                  </button>
                  <button
                    v-if="!gasto.origenConfigId && !esDelHogar(gasto) && !gasto.compraId && !esDeOtraPantalla(gasto)"
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
            </template>
            <template v-else>
            <li v-for="ingreso in [fila.mov]" :key="ingreso.id" class="list-row group">
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
                    <span v-else-if="ORIGEN_MOVIMIENTO[ingreso.origen]" class="badge-neutral">{{ ORIGEN_MOVIMIENTO[ingreso.origen].badge }}</span>
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
                <div v-if="metodoEditando === `ingreso-${ingreso.id}`" class="flex items-center gap-1">
                  <label :for="`metodo-ingreso-${ingreso.id}`" class="sr-only">Dónde entró</label>
                  <select
                    :id="`metodo-ingreso-${ingreso.id}`"
                    class="field !w-auto !py-1.5 !text-[13px]"
                    :value="ingreso.metodoPagoId ?? ''"
                    @change="onCambiarMetodo('ingreso', ingreso, $event.target.value)"
                  >
                    <option value="">Sin definir</option>
                    <option v-for="m in metodos.filter((x) => x.tipo !== 'tarjeta_credito')" :key="m.id" :value="m.id">
                      {{ m.nombre }}
                    </option>
                  </select>
                  <button type="button" class="btn-ghost btn-sm" @click="metodoEditando = null">Listo</button>
                </div>
                <div v-else class="flex items-center gap-1">
                  <button
                    v-if="esDelHogar(ingreso)"
                    type="button"
                    class="btn-ghost btn-sm"
                    title="Dónde entró la plata (solo lo ves tú)"
                    @click="metodoEditando = `ingreso-${ingreso.id}`"
                  >
                    {{ ingreso.metodoPago ? 'Cambiar dónde entró' : 'Elegir dónde entró' }}
                  </button>
                  <button
                    v-if="!esDelHogar(ingreso) && !esDeOtraPantalla(ingreso)"
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
                    v-if="esEditableAqui(ingreso, 'ingreso')"
                    type="button"
                    class="btn-icon !p-1.5"
                    aria-label="Editar ingreso"
                    title="Editar"
                    @click="editandoMov = { tipo: 'ingreso', mov: ingreso }"
                  >
                    <AppIcon name="edit" class="h-4 w-4" />
                  </button>
                  <button
                    v-if="!ingreso.origenConfigId && !esDelHogar(ingreso) && !esDeOtraPantalla(ingreso)"
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
            </template>
            </template>
          </ul>

          <!-- Compras a cuotas -->
          <ul v-else-if="tabMovimientos === 'compras'" class="list">
            <li v-for="compra in listaVisible" :id="`compra-${compra.id}`" :key="compra.id" class="list-row group">
              <div class="flex min-w-0 items-center gap-3">
                <span class="hidden sm:grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-secondary">
                  <AppIcon name="calendar" class="h-4 w-4" />
                </span>
                <div class="min-w-0">
                  <p class="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink-primary">
                    <span class="truncate">{{ compra.descripcion }}</span>
                    <span class="badge-neutral">{{ cuotasPagadasTotal(compra) }}/{{ compra.numeroCuotas }} pagadas</span>
                    <span :class="compra.modoCobro === 'automatico' ? 'badge-accent' : 'badge-warning'">
                      {{ compra.modoCobro === 'automatico' ? 'Automático' : 'Manual' }}
                    </span>
                  </p>
                  <p class="mt-0.5 text-[13px] text-ink-tertiary">
                    <template v-if="compra.montoUsd">{{ formatUsd(compra.montoUsd) }} (≈ {{ formatCurrency(compra.montoTotal) }})</template>
                    <template v-else>{{ formatCurrency(compra.montoTotal) }}</template>
                    en {{ compra.numeroCuotas }} cuotas ·
                    <template v-if="compra.cuotasPagadasAntes">registrada en curso, desde la cuota {{ compra.cuotasPagadasAntes + 1 }} ({{ formatDate(compra.fechaPrimeraCuota) }})</template>
                    <template v-else>desde {{ formatDate(compra.fechaPrimeraCuota) }}</template>
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
                  v-if="compra.modoCobro !== 'manual' || !cuotasPagadas(compra)"
                  type="button"
                  class="btn-icon !p-1.5 hover:!text-negative"
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
        <FormField
          v-model="gMonto"
          type="number"
          :label="gEnDolares ? 'Valor en pesos (COP)' : 'Monto (COP)'"
          required
          placeholder="30000"
          :hint="gEnDolares ? 'Sale de los dólares y la tasa; corrígelo si tu banco lo pasó distinto.' : ''"
        />
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
        <template v-if="conTarjeta">
          <label class="sm:col-span-2 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
            <input v-model="gEnDolares" type="checkbox" class="checkbox" />
            Compra en dólares (va a la deuda en US$ de la tarjeta)
          </label>
          <CamposDolares
            v-if="gEnDolares"
            v-model:usd="gUsd"
            v-model:trm="gTrm"
            class="sm:col-span-2"
            :fecha="gFecha"
            :etiqueta-usd="gACuotas ? 'Valor total en dólares (US$)' : 'Valor en dólares (US$)'"
          />
        </template>
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
          <label class="sm:col-span-2 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
            <input v-model="gEnCurso" type="checkbox" class="checkbox" />
            La compra ya va en curso (ya pagué algunas cuotas)
          </label>
          <FormField
            v-model="gNumeroCuotas"
            type="number"
            :label="gEnCurso ? 'Total de cuotas de la compra' : 'Número de cuotas'"
            hint="1 si la pagas completa con el extracto de la tarjeta."
            required
          />
          <FormField
            v-if="gEnCurso"
            v-model="gCuotasPagadas"
            type="number"
            label="Cuotas que ya pagaste"
            required
            hint="No se registran: no bajan tu Disponible ni cuentan como gasto. La app crea solo las que faltan."
          />
          <FormField
            v-model="gPrimeraCuota"
            type="date"
            :label="gEnCurso ? 'Fecha de la próxima cuota' : 'Primera cuota'"
            required
            :hint="gEnCurso ? 'La de la próxima cuota que vas a pagar.' : 'Sugerida con el día de corte y pago de la tarjeta; puedes cambiarla.'"
          />
          <div>
            <label class="label" for="g-modo-cobro">Cómo se paga cada cuota</label>
            <select id="g-modo-cobro" v-model="gModoCobro" class="field">
              <option value="automatico">Automático (tarjeta o débito)</option>
              <option value="manual">Manual (la marco yo al pagar)</option>
            </select>
          </div>
          <p class="self-end pb-2.5 text-[13px] text-ink-secondary">
            <template v-if="valorCuota">≈ {{ formatCurrency(valorCuota) }} de capital por cuota</template>
          </p>
          <div class="sm:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="label" for="g-interes">Interés</label>
              <select id="g-interes" v-model="gInteres" class="field">
                <option v-if="metodoSeleccionado?.tasaMensual > 0" value="tarjeta">
                  El de la tarjeta ({{ formatTasa(metodoSeleccionado.tasaMensual) }})
                </option>
                <option value="sin">Sin interés</option>
                <option value="otra">Otra tasa</option>
              </select>
            </div>
            <template v-if="gInteres === 'otra'">
              <FormField v-model="gTasa" type="number" step="0.01" label="Tasa mensual (%)" required />
              <div class="sm:col-span-2 sm:max-w-sm">
                <label class="label" for="g-sistema">Cómo se calcula</label>
                <select id="g-sistema" v-model="gSistema" class="field">
                  <option value="capital_fijo">Capital fijo + interés sobre lo que falta (cuotas bajan)</option>
                  <option value="cuota_fija">Cuota fija (todas iguales)</option>
                </select>
              </div>
            </template>
          </div>
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
            :disabled="
              guardandoGasto ||
              (gEnDolares && (!aCentavos(gUsd) || !(Number(gTrm) > 0))) ||
              (gACuotas &&
                (!gDescripcion ||
                  Number(gNumeroCuotas) < 1 ||
                  (gEnCurso && !(Number(gCuotasPagadas) >= 1 && Number(gCuotasPagadas) < Number(gNumeroCuotas)))))
            "
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
    <AppModal v-if="exportando" title="Exportar" @close="exportando = false">
      <ExportarDatos :desde-inicial="filtroDesde" :hasta-inicial="filtroHasta" />
    </AppModal>
    <EditarMovimientoModal
      v-if="editandoMov"
      :tipo="editandoMov.tipo"
      :movimiento="editandoMov.mov"
      :categorias="categorias"
      :metodos="metodos"
      @cerrar="editandoMov = null"
      @guardado="onMovimientoEditado"
    />
  </AppLayout>
</template>
