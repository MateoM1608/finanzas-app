<script setup>
import { confirmar } from '../../composables/useConfirm.js';
import { ref, reactive, computed, onMounted } from 'vue';
import {
  listarMetodosPago,
  crearMetodoPago,
  actualizarMetodoPago,
  eliminarMetodoPago,
} from '../../api/metodosPagoPersonales.js';
import {
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from '../../api/categoriasPersonales.js';
import {
  listarGastosFijos,
  crearGastoFijo,
  actualizarGastoFijo,
  eliminarGastoFijo,
} from '../../api/gastosFijosConfig.js';
import {
  listarIngresosFijos,
  crearIngresoFijo,
  actualizarIngresoFijo,
  eliminarIngresoFijo,
} from '../../api/ingresosFijosConfig.js';
import { obtenerCicloPersonal, actualizarCicloPersonal } from '../../api/cicloPersonal.js';
import {
  listarAhorros,
  crearAhorro,
  actualizarAhorro,
  eliminarAhorro,
} from '../../api/ahorrosPersonales.js';
import {
  listarLimites,
  crearLimite,
  actualizarLimite,
  eliminarLimite,
} from '../../api/limitesPersonales.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, hoyISO, describirMetodo } from '../../utils/format.js';
import FormField from '../FormField.vue';
import MetodoPagoForm from './MetodoPagoForm.vue';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';

const TABS = [
  { key: 'ciclo', label: 'Ciclo personal' },
  { key: 'metodos', label: 'Métodos de pago' },
  { key: 'categorias', label: 'Categorías' },
  { key: 'gastosFijos', label: 'Gastos fijos' },
  { key: 'ingresosFijos', label: 'Ingresos fijos' },
  { key: 'ahorros', label: 'Metas de ahorro' },
  { key: 'limites', label: 'Límites' },
];
const props = defineProps({ tabInicial: { type: String, default: 'ciclo' } });
const tabActiva = ref(props.tabInicial);

const loading = ref(true);
const error = ref('');
const guardandoId = ref(null);
const eliminandoId = ref(null);

const metodos = ref([]);
const categorias = ref([]);
const gastosFijos = ref([]);
const ingresosFijos = ref([]);
const ahorros = ref([]);
const limites = ref([]);
const frecuenciaCicloPersonal = ref('mensual');
const guardandoCiclo = ref(false);

async function onGuardarCiclo() {
  error.value = '';
  guardandoCiclo.value = true;
  try {
    const ciclo = await actualizarCicloPersonal(frecuenciaCicloPersonal.value);
    frecuenciaCicloPersonal.value = ciclo.frecuenciaCicloPersonal;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoCiclo.value = false;
  }
}

async function cargar() {
  loading.value = true;
  try {
    const [m, c, gf, inf, ciclo, ah, lim] = await Promise.all([
      listarMetodosPago(),
      listarCategorias(),
      listarGastosFijos(),
      listarIngresosFijos(),
      obtenerCicloPersonal(),
      listarAhorros(),
      listarLimites(),
    ]);
    metodos.value = m;
    categorias.value = c;
    gastosFijos.value = gf;
    ingresosFijos.value = inf;
    frecuenciaCicloPersonal.value = ciclo.frecuenciaCicloPersonal;
    ahorros.value = ah;
    limites.value = lim;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(cargar);

// --- Métodos de pago ---
const creandoMetodo = ref(false);
const formMetodoKey = ref(0);

async function onCrearMetodo(payload) {
  error.value = '';
  creandoMetodo.value = true;
  try {
    const metodo = await crearMetodoPago(payload);
    metodos.value = [...metodos.value, metodo];
    formMetodoKey.value += 1; // limpia el formulario
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    creandoMetodo.value = false;
  }
}

async function onEliminarMetodo(metodo) {
  if (!(await confirmar(`¿Eliminar "${metodo.nombre}"?`))) return;
  error.value = '';
  eliminandoId.value = metodo.id;
  try {
    await eliminarMetodoPago(metodo.id);
    metodos.value = metodos.value.filter((m) => m.id !== metodo.id);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoId.value = null;
  }
}

const editandoMetodoId = ref(null);

async function onGuardarEditarMetodo(metodo, payload) {
  error.value = '';
  guardandoId.value = metodo.id;
  try {
    const actualizado = await actualizarMetodoPago(metodo.id, payload);
    const idx = metodos.value.findIndex((m) => m.id === metodo.id);
    metodos.value[idx] = actualizado;
    editandoMetodoId.value = null;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

// --- Categorías ---
const nuevaCategoriaNombre = ref('');
const nuevaCategoriaAplicaA = reactive({ gasto: true, ingreso: false, ahorro: false });
const creandoCategoria = ref(false);

async function onCrearCategoria() {
  error.value = '';
  creandoCategoria.value = true;
  try {
    const aplicaA = Object.entries(nuevaCategoriaAplicaA)
      .filter(([, activo]) => activo)
      .map(([tipo]) => tipo);
    const categoria = await crearCategoria({ nombre: nuevaCategoriaNombre.value, aplicaA });
    categorias.value = [...categorias.value, categoria];
    nuevaCategoriaNombre.value = '';
    nuevaCategoriaAplicaA.gasto = true;
    nuevaCategoriaAplicaA.ingreso = false;
    nuevaCategoriaAplicaA.ahorro = false;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    creandoCategoria.value = false;
  }
}

async function onEliminarCategoria(categoria) {
  if (!(await confirmar(`¿Eliminar "${categoria.nombre}"?`))) return;
  error.value = '';
  eliminandoId.value = categoria.id;
  try {
    await eliminarCategoria(categoria.id);
    categorias.value = categorias.value.filter((c) => c.id !== categoria.id);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoId.value = null;
  }
}

const editandoCategoriaId = ref(null);
const editCategoriaNombre = ref('');
const editCategoriaAplicaA = reactive({ gasto: false, ingreso: false, ahorro: false });

function onEditarCategoria(categoria) {
  editandoCategoriaId.value = categoria.id;
  editCategoriaNombre.value = categoria.nombre;
  editCategoriaAplicaA.gasto = categoria.aplicaA.includes('gasto');
  editCategoriaAplicaA.ingreso = categoria.aplicaA.includes('ingreso');
  editCategoriaAplicaA.ahorro = categoria.aplicaA.includes('ahorro');
}

function onCancelarEditarCategoria() {
  editandoCategoriaId.value = null;
}

async function onGuardarEditarCategoria(categoria) {
  error.value = '';
  guardandoId.value = categoria.id;
  try {
    const aplicaA = Object.entries(editCategoriaAplicaA)
      .filter(([, activo]) => activo)
      .map(([tipo]) => tipo);
    const actualizado = await actualizarCategoria(categoria.id, { nombre: editCategoriaNombre.value, aplicaA });
    const idx = categorias.value.findIndex((c) => c.id === categoria.id);
    categorias.value[idx] = actualizado;
    editandoCategoriaId.value = null;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

// --- Gastos fijos ---
const gf = reactive({
  nombre: '',
  monto: '',
  frecuencia: 'mensual',
  fechaInicio: hoyISO(),
  modoCobro: 'automatico',
  esObligatorio: false,
  metodoPagoIdDefault: '',
  categoriaId: '',
});
const creandoGastoFijo = ref(false);

async function onCrearGastoFijo() {
  error.value = '';
  creandoGastoFijo.value = true;
  try {
    const nuevo = await crearGastoFijo({
      nombre: gf.nombre,
      monto: Number(gf.monto),
      frecuencia: gf.frecuencia,
      fechaInicio: gf.fechaInicio,
      modoCobro: gf.modoCobro,
      esObligatorio: gf.esObligatorio,
      metodoPagoIdDefault: gf.metodoPagoIdDefault || undefined,
      categoriaId: gf.categoriaId || undefined,
    });
    gastosFijos.value = [...gastosFijos.value, nuevo];
    gf.nombre = '';
    gf.monto = '';
    gf.esObligatorio = false;
    gf.metodoPagoIdDefault = '';
    gf.categoriaId = '';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    creandoGastoFijo.value = false;
  }
}

async function onToggleActivoGastoFijo(config) {
  error.value = '';
  guardandoId.value = config.id;
  try {
    const actualizado = await actualizarGastoFijo(config.id, { activo: !config.activo });
    const idx = gastosFijos.value.findIndex((c) => c.id === config.id);
    gastosFijos.value[idx] = actualizado;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

async function onEliminarGastoFijo(config) {
  if (!(await confirmar(`¿Eliminar "${config.nombre}"? Esta acción no se puede deshacer.`))) return;
  error.value = '';
  eliminandoId.value = config.id;
  try {
    await eliminarGastoFijo(config.id);
    gastosFijos.value = gastosFijos.value.filter((c) => c.id !== config.id);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoId.value = null;
  }
}

const editandoGastoFijoId = ref(null);
const editGf = reactive({
  nombre: '',
  monto: '',
  frecuencia: 'mensual',
  modoCobro: 'automatico',
  esObligatorio: false,
  metodoPagoIdDefault: '',
  categoriaId: '',
});

function onEditarGastoFijo(config) {
  editandoGastoFijoId.value = config.id;
  editGf.nombre = config.nombre;
  editGf.monto = config.monto;
  editGf.frecuencia = config.frecuencia;
  editGf.modoCobro = config.modoCobro;
  editGf.esObligatorio = config.esObligatorio;
  editGf.metodoPagoIdDefault = config.metodoPagoIdDefault || '';
  editGf.categoriaId = config.categoriaId || '';
}

function onCancelarEditarGastoFijo() {
  editandoGastoFijoId.value = null;
}

async function onGuardarEditarGastoFijo(config) {
  error.value = '';
  guardandoId.value = config.id;
  try {
    const actualizado = await actualizarGastoFijo(config.id, {
      nombre: editGf.nombre,
      monto: Number(editGf.monto),
      frecuencia: editGf.frecuencia,
      modoCobro: editGf.modoCobro,
      esObligatorio: editGf.esObligatorio,
      metodoPagoIdDefault: editGf.metodoPagoIdDefault || null,
      categoriaId: editGf.categoriaId || null,
    });
    const idx = gastosFijos.value.findIndex((c) => c.id === config.id);
    gastosFijos.value[idx] = actualizado;
    editandoGastoFijoId.value = null;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

// --- Ingresos fijos ---
const inf = reactive({
  nombre: '',
  monto: '',
  frecuencia: 'mensual',
  fechaInicio: hoyISO(),
  modo: 'automatico',
  categoriaId: '',
});
const creandoIngresoFijo = ref(false);

async function onCrearIngresoFijo() {
  error.value = '';
  creandoIngresoFijo.value = true;
  try {
    const nuevo = await crearIngresoFijo({
      nombre: inf.nombre,
      monto: Number(inf.monto),
      frecuencia: inf.frecuencia,
      fechaInicio: inf.fechaInicio,
      modo: inf.modo,
      categoriaId: inf.categoriaId || undefined,
    });
    ingresosFijos.value = [...ingresosFijos.value, nuevo];
    inf.nombre = '';
    inf.monto = '';
    inf.categoriaId = '';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    creandoIngresoFijo.value = false;
  }
}

async function onToggleActivoIngresoFijo(config) {
  error.value = '';
  guardandoId.value = config.id;
  try {
    const actualizado = await actualizarIngresoFijo(config.id, { activo: !config.activo });
    const idx = ingresosFijos.value.findIndex((c) => c.id === config.id);
    ingresosFijos.value[idx] = actualizado;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

async function onEliminarIngresoFijo(config) {
  if (!(await confirmar(`¿Eliminar "${config.nombre}"? Esta acción no se puede deshacer.`))) return;
  error.value = '';
  eliminandoId.value = config.id;
  try {
    await eliminarIngresoFijo(config.id);
    ingresosFijos.value = ingresosFijos.value.filter((c) => c.id !== config.id);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoId.value = null;
  }
}

const editandoIngresoFijoId = ref(null);
const editInf = reactive({
  nombre: '',
  monto: '',
  frecuencia: 'mensual',
  modo: 'automatico',
  categoriaId: '',
});

function onEditarIngresoFijo(config) {
  editandoIngresoFijoId.value = config.id;
  editInf.nombre = config.nombre;
  editInf.monto = config.monto;
  editInf.frecuencia = config.frecuencia;
  editInf.modo = config.modo;
  editInf.categoriaId = config.categoriaId || '';
}

function onCancelarEditarIngresoFijo() {
  editandoIngresoFijoId.value = null;
}

async function onGuardarEditarIngresoFijo(config) {
  error.value = '';
  guardandoId.value = config.id;
  try {
    const actualizado = await actualizarIngresoFijo(config.id, {
      nombre: editInf.nombre,
      monto: Number(editInf.monto),
      frecuencia: editInf.frecuencia,
      modo: editInf.modo,
      categoriaId: editInf.categoriaId || null,
    });
    const idx = ingresosFijos.value.findIndex((c) => c.id === config.id);
    ingresosFijos.value[idx] = actualizado;
    editandoIngresoFijoId.value = null;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

// --- Metas de ahorro ---
const ah = reactive({
  nombre: '',
  montoMetaTotal: '',
  reglaTipo: 'porcentaje',
  reglaValor: '',
  baseCalculo: 'ingreso_menos_obligatorios',
  modoTransaccion: 'manual',
  categoriaId: '',
});
const creandoAhorro = ref(false);

async function onCrearAhorro() {
  error.value = '';
  creandoAhorro.value = true;
  try {
    const nuevo = await crearAhorro({
      nombre: ah.nombre,
      montoMetaTotal: ah.montoMetaTotal ? Number(ah.montoMetaTotal) : undefined,
      reglaTipo: ah.reglaTipo,
      reglaValor: Number(ah.reglaValor),
      baseCalculo: ah.baseCalculo,
      modoTransaccion: ah.modoTransaccion,
      categoriaId: ah.categoriaId || undefined,
    });
    ahorros.value = [...ahorros.value, nuevo];
    ah.nombre = '';
    ah.montoMetaTotal = '';
    ah.reglaValor = '';
    ah.categoriaId = '';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    creandoAhorro.value = false;
  }
}

async function onToggleActivoAhorro(meta) {
  error.value = '';
  guardandoId.value = meta.id;
  try {
    const actualizado = await actualizarAhorro(meta.id, { activo: !meta.activo });
    const idx = ahorros.value.findIndex((a) => a.id === meta.id);
    ahorros.value[idx] = actualizado;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

async function onEliminarAhorro(meta) {
  if (!(await confirmar(`¿Eliminar "${meta.nombre}"? Esta acción no se puede deshacer.`))) return;
  error.value = '';
  eliminandoId.value = meta.id;
  try {
    await eliminarAhorro(meta.id);
    ahorros.value = ahorros.value.filter((a) => a.id !== meta.id);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoId.value = null;
  }
}

const editandoAhorroId = ref(null);
const editAh = reactive({
  nombre: '',
  montoMetaTotal: '',
  reglaTipo: 'porcentaje',
  reglaValor: '',
  baseCalculo: 'ingreso_menos_obligatorios',
  modoTransaccion: 'manual',
  categoriaId: '',
});

function onEditarAhorro(meta) {
  editandoAhorroId.value = meta.id;
  editAh.nombre = meta.nombre;
  editAh.montoMetaTotal = meta.montoMetaTotal ?? '';
  editAh.reglaTipo = meta.reglaTipo;
  editAh.reglaValor = meta.reglaValor;
  editAh.baseCalculo = meta.baseCalculo;
  editAh.modoTransaccion = meta.modoTransaccion;
  editAh.categoriaId = meta.categoriaId || '';
}

function onCancelarEditarAhorro() {
  editandoAhorroId.value = null;
}

async function onGuardarEditarAhorro(meta) {
  error.value = '';
  guardandoId.value = meta.id;
  try {
    const actualizado = await actualizarAhorro(meta.id, {
      nombre: editAh.nombre,
      montoMetaTotal: editAh.montoMetaTotal ? Number(editAh.montoMetaTotal) : null,
      reglaTipo: editAh.reglaTipo,
      reglaValor: Number(editAh.reglaValor),
      baseCalculo: editAh.baseCalculo,
      modoTransaccion: editAh.modoTransaccion,
      categoriaId: editAh.categoriaId || null,
    });
    const idx = ahorros.value.findIndex((a) => a.id === meta.id);
    ahorros.value[idx] = actualizado;
    editandoAhorroId.value = null;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

// --- Límites y alertas ---
const li = reactive({
  nombre: '',
  tipoObjetivo: 'categoria',
  categoriaId: '',
  reglaTipo: 'porcentaje',
  reglaValor: '',
});
const creandoLimite = ref(false);

async function onCrearLimite() {
  error.value = '';
  creandoLimite.value = true;
  try {
    const nuevo = await crearLimite({
      nombre: li.nombre,
      tipoObjetivo: li.tipoObjetivo,
      categoriaId: li.tipoObjetivo === 'categoria' ? li.categoriaId || undefined : undefined,
      reglaTipo: li.reglaTipo,
      reglaValor: Number(li.reglaValor),
    });
    limites.value = [...limites.value, nuevo];
    li.nombre = '';
    li.categoriaId = '';
    li.reglaValor = '';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    creandoLimite.value = false;
  }
}

async function onToggleActivoLimite(limite) {
  error.value = '';
  guardandoId.value = limite.id;
  try {
    const actualizado = await actualizarLimite(limite.id, { activo: !limite.activo });
    const idx = limites.value.findIndex((l) => l.id === limite.id);
    limites.value[idx] = actualizado;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

async function onEliminarLimite(limite) {
  if (!(await confirmar(`¿Eliminar "${limite.nombre}"?`))) return;
  error.value = '';
  eliminandoId.value = limite.id;
  try {
    await eliminarLimite(limite.id);
    limites.value = limites.value.filter((l) => l.id !== limite.id);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoId.value = null;
  }
}

const editandoLimiteId = ref(null);
const editLi = reactive({
  nombre: '',
  tipoObjetivo: 'categoria',
  categoriaId: '',
  reglaTipo: 'porcentaje',
  reglaValor: '',
});

function onEditarLimite(limite) {
  editandoLimiteId.value = limite.id;
  editLi.nombre = limite.nombre;
  editLi.tipoObjetivo = limite.tipoObjetivo;
  editLi.categoriaId = limite.categoriaId || '';
  editLi.reglaTipo = limite.reglaTipo;
  editLi.reglaValor = limite.reglaValor;
}

function onCancelarEditarLimite() {
  editandoLimiteId.value = null;
}

async function onGuardarEditarLimite(limite) {
  error.value = '';
  guardandoId.value = limite.id;
  try {
    const actualizado = await actualizarLimite(limite.id, {
      nombre: editLi.nombre,
      tipoObjetivo: editLi.tipoObjetivo,
      categoriaId: editLi.tipoObjetivo === 'categoria' ? editLi.categoriaId || null : null,
      reglaTipo: editLi.reglaTipo,
      reglaValor: Number(editLi.reglaValor),
    });
    const idx = limites.value.findIndex((l) => l.id === limite.id);
    limites.value[idx] = actualizado;
    editandoLimiteId.value = null;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

const TIPO_OBJETIVO_LABEL = {
  categoria: 'Categoría',
  obligatorios: 'Gastos obligatorios',
  no_obligatorios: 'Gastos no obligatorios',
  todo_gasto: 'Todo gasto',
};

const categoriasParaGasto = computed(() => categorias.value.filter((c) => c.aplicaA.includes('gasto')));
const categoriasParaIngreso = computed(() => categorias.value.filter((c) => c.aplicaA.includes('ingreso')));
const categoriasParaAhorro = computed(() => categorias.value.filter((c) => c.aplicaA.includes('ahorro')));
</script>

<template>
  <div>
    <AlertError :message="error" />

    <!-- Pestañas: el scroll horizontal queda contenido en esta fila. -->
    <div class="mb-6 overflow-x-auto">
      <div class="tabs" role="tablist" aria-label="Secciones de configuración">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          type="button"
          role="tab"
          class="tab"
          :class="{ 'tab-active': tabActiva === tab.key }"
          :aria-selected="tabActiva === tab.key"
          @click="tabActiva = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <p v-if="loading" class="empty">Cargando…</p>

    <template v-else>
      <!-- Ciclo personal -->
      <div v-if="tabActiva === 'ciclo'" class="space-y-4">
        <form class="panel-sunken p-4 grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onGuardarCiclo">
          <div>
            <label class="label">Frecuencia</label>
            <select v-model="frecuenciaCicloPersonal" class="field">
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          <div class="flex items-end">
            <button type="submit" class="btn-primary w-full sm:w-auto" :disabled="guardandoCiclo">
              <AppIcon name="check" class="h-4 w-4" />
              {{ guardandoCiclo ? 'Guardando…' : 'Guardar frecuencia' }}
            </button>
          </div>
        </form>
        <p class="flex items-start gap-2 text-[13px] text-ink-tertiary">
          <AppIcon name="info" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Define los períodos que usan "Disponible" y el resto del panel personal (ej. quincenal = del 1 al 15 y
            del 16 a fin de mes) — independiente de los cuadres del hogar.
          </span>
        </p>
      </div>

      <!-- Métodos de pago -->
      <div v-else-if="tabActiva === 'metodos'" class="space-y-5">
        <div class="panel-sunken p-4">
          <p class="mb-3 text-[13px] font-medium text-ink-secondary">Nuevo método de pago</p>
          <MetodoPagoForm
            :key="formMetodoKey"
            id-base="metodo-nuevo"
            :guardando="creandoMetodo"
            texto-guardar="Agregar"
            @guardar="onCrearMetodo"
          />
        </div>

        <p v-if="!metodos.length" class="empty">No hay métodos de pago todavía.</p>
        <ul v-else class="list">
          <li v-for="m in metodos" :key="m.id" :class="editandoMetodoId === m.id ? 'py-3' : 'list-row'">
            <div v-if="editandoMetodoId === m.id" class="panel-sunken p-4">
              <MetodoPagoForm
                :id-base="`metodo-${m.id}`"
                :inicial="m"
                :guardando="guardandoId === m.id"
                @guardar="onGuardarEditarMetodo(m, $event)"
                @cancelar="editandoMetodoId = null"
              />
            </div>
            <template v-else>
              <div class="flex min-w-0 items-center gap-3">
                <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-sunken text-ink-secondary">
                  <AppIcon name="wallet" class="h-4 w-4" />
                </span>
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium text-ink-primary">{{ m.nombre }}</span>
                  <span class="block truncate text-[13px] text-ink-tertiary">{{ describirMetodo(m) }}</span>
                </span>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <button class="btn-icon" :aria-label="`Editar ${m.nombre}`" @click="editandoMetodoId = m.id">
                  <AppIcon name="edit" class="h-4 w-4" />
                </button>
                <button
                  class="btn-icon hover:text-negative hover:bg-negative/10"
                  :aria-label="`Eliminar ${m.nombre}`"
                  :disabled="eliminandoId === m.id"
                  @click="onEliminarMetodo(m)"
                >
                  <AppIcon name="trash" class="h-4 w-4" />
                </button>
              </div>
            </template>
          </li>
        </ul>
      </div>

      <!-- Categorías -->
      <div v-else-if="tabActiva === 'categorias'" class="space-y-5">
        <form class="panel-sunken p-4 grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onCrearCategoria">
          <FormField v-model="nuevaCategoriaNombre" label="Nueva categoría" placeholder="Ocio, Sueldo…" required />
          <div>
            <span class="label">Aplica a</span>
            <div class="flex flex-wrap gap-x-4 gap-y-2 pt-2.5">
              <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
                <input v-model="nuevaCategoriaAplicaA.gasto" type="checkbox" class="checkbox" /> Gasto
              </label>
              <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
                <input v-model="nuevaCategoriaAplicaA.ingreso" type="checkbox" class="checkbox" /> Ingreso
              </label>
              <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
                <input v-model="nuevaCategoriaAplicaA.ahorro" type="checkbox" class="checkbox" /> Ahorro
              </label>
            </div>
          </div>
          <div class="sm:col-span-2 flex justify-end">
            <button type="submit" class="btn-primary w-full sm:w-auto" :disabled="creandoCategoria">
              <AppIcon name="plus" class="h-4 w-4" />
              {{ creandoCategoria ? 'Agregando…' : 'Agregar categoría' }}
            </button>
          </div>
        </form>

        <p v-if="!categorias.length" class="empty">No hay categorías todavía.</p>
        <ul v-else class="list">
          <li v-for="c in categorias" :key="c.id" :class="editandoCategoriaId === c.id ? 'py-3' : 'list-row'">
            <div v-if="editandoCategoriaId === c.id" class="panel-sunken p-4 space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField v-model="editCategoriaNombre" label="Nombre" required />
                <div>
                  <span class="label">Aplica a</span>
                  <div class="flex flex-wrap gap-x-4 gap-y-2 pt-2.5">
                    <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
                      <input v-model="editCategoriaAplicaA.gasto" type="checkbox" class="checkbox" /> Gasto
                    </label>
                    <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
                      <input v-model="editCategoriaAplicaA.ingreso" type="checkbox" class="checkbox" /> Ingreso
                    </label>
                    <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
                      <input v-model="editCategoriaAplicaA.ahorro" type="checkbox" class="checkbox" /> Ahorro
                    </label>
                  </div>
                </div>
              </div>
              <div class="flex items-center justify-end gap-2">
                <button class="btn-ghost btn-sm" @click="onCancelarEditarCategoria">Cancelar</button>
                <button
                  class="btn-primary btn-sm"
                  :disabled="guardandoId === c.id"
                  @click="onGuardarEditarCategoria(c)"
                >
                  Guardar
                </button>
              </div>
            </div>
            <template v-else>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-ink-primary">{{ c.nombre }}</p>
                <div class="mt-1 flex flex-wrap gap-1">
                  <span v-for="a in c.aplicaA" :key="a" class="badge-neutral capitalize">{{ a }}</span>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <button class="btn-icon" :aria-label="`Editar ${c.nombre}`" @click="onEditarCategoria(c)">
                  <AppIcon name="edit" class="h-4 w-4" />
                </button>
                <button
                  class="btn-icon hover:text-negative hover:bg-negative/10"
                  :aria-label="`Eliminar ${c.nombre}`"
                  :disabled="eliminandoId === c.id"
                  @click="onEliminarCategoria(c)"
                >
                  <AppIcon name="trash" class="h-4 w-4" />
                </button>
              </div>
            </template>
          </li>
        </ul>
      </div>

      <!-- Gastos fijos -->
      <div v-else-if="tabActiva === 'gastosFijos'" class="space-y-5">
        <form class="panel-sunken p-4 grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onCrearGastoFijo">
          <FormField v-model="gf.nombre" label="Nombre" placeholder="Netflix, Arriendo…" required />
          <FormField v-model="gf.monto" type="number" label="Monto (COP)" required />
          <div>
            <label class="label">Frecuencia</label>
            <select v-model="gf.frecuencia" class="field">
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          <FormField v-model="gf.fechaInicio" type="date" label="Primera ocurrencia" required />
          <div>
            <label class="label">Modo de cobro</label>
            <select v-model="gf.modoCobro" class="field">
              <option value="automatico">Automático (ya pagado)</option>
              <option value="manual">Manual (queda pendiente)</option>
            </select>
          </div>
          <div>
            <label class="label">Método de pago (opcional)</label>
            <select v-model="gf.metodoPagoIdDefault" class="field">
              <option value="">Sin definir</option>
              <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
            </select>
          </div>
          <div>
            <label class="label">Categoría (opcional)</label>
            <select v-model="gf.categoriaId" class="field">
              <option value="">Sin definir</option>
              <option v-for="c in categoriasParaGasto" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </div>
          <div class="flex items-end sm:pb-2.5">
            <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
              <input v-model="gf.esObligatorio" type="checkbox" class="checkbox" /> Es obligatorio
            </label>
          </div>
          <div class="sm:col-span-2 flex justify-end">
            <button type="submit" class="btn-primary w-full sm:w-auto" :disabled="creandoGastoFijo">
              <AppIcon name="plus" class="h-4 w-4" />
              {{ creandoGastoFijo ? 'Agregando…' : 'Agregar gasto fijo' }}
            </button>
          </div>
        </form>

        <p v-if="!gastosFijos.length" class="empty">No hay gastos fijos todavía.</p>
        <ul v-else class="list">
          <li v-for="c in gastosFijos" :key="c.id" :class="editandoGastoFijoId === c.id ? 'py-3' : 'list-row'">
            <div v-if="editandoGastoFijoId === c.id" class="panel-sunken p-4 space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField v-model="editGf.nombre" label="Nombre" required />
                <FormField v-model="editGf.monto" type="number" label="Monto (COP)" required />
                <div>
                  <label class="label">Frecuencia</label>
                  <select v-model="editGf.frecuencia" class="field">
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
                <div>
                  <label class="label">Modo de cobro</label>
                  <select v-model="editGf.modoCobro" class="field">
                    <option value="automatico">Automático (ya pagado)</option>
                    <option value="manual">Manual (queda pendiente)</option>
                  </select>
                </div>
                <div>
                  <label class="label">Método de pago (opcional)</label>
                  <select v-model="editGf.metodoPagoIdDefault" class="field">
                    <option value="">Sin definir</option>
                    <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
                  </select>
                </div>
                <div>
                  <label class="label">Categoría (opcional)</label>
                  <select v-model="editGf.categoriaId" class="field">
                    <option value="">Sin definir</option>
                    <option v-for="cat in categoriasParaGasto" :key="cat.id" :value="cat.id">{{ cat.nombre }}</option>
                  </select>
                </div>
                <div class="flex items-end sm:pb-2.5">
                  <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
                    <input v-model="editGf.esObligatorio" type="checkbox" class="checkbox" /> Es obligatorio
                  </label>
                </div>
              </div>
              <div class="flex items-center justify-end gap-2">
                <button class="btn-ghost btn-sm" @click="onCancelarEditarGastoFijo">Cancelar</button>
                <button
                  class="btn-primary btn-sm"
                  :disabled="guardandoId === c.id"
                  @click="onGuardarEditarGastoFijo(c)"
                >
                  Guardar
                </button>
              </div>
            </div>
            <template v-else>
              <div class="min-w-0" :class="{ 'opacity-50': !c.activo }">
                <p class="truncate text-sm font-medium text-ink-primary">{{ c.nombre }}</p>
                <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span class="text-[13px] text-ink-tertiary">
                    {{ formatCurrency(c.monto) }} · <span class="capitalize">{{ c.frecuencia }}</span>
                  </span>
                  <span :class="c.modoCobro === 'automatico' ? 'badge-accent' : 'badge-neutral'">
                    {{ c.modoCobro === 'automatico' ? 'Automático' : 'Manual' }}
                  </span>
                  <span v-if="c.esObligatorio" class="badge-warning">Obligatorio</span>
                  <span v-if="!c.activo" class="badge-neutral">Inactivo</span>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <label class="mr-1 inline-flex items-center gap-1.5 text-[13px] text-ink-secondary">
                  <input
                    type="checkbox"
                    class="checkbox"
                    :checked="c.activo"
                    :disabled="guardandoId === c.id"
                    @change="onToggleActivoGastoFijo(c)"
                  />
                  Activo
                </label>
                <button class="btn-icon" :aria-label="`Editar ${c.nombre}`" @click="onEditarGastoFijo(c)">
                  <AppIcon name="edit" class="h-4 w-4" />
                </button>
                <button
                  class="btn-icon hover:text-negative hover:bg-negative/10"
                  :aria-label="`Eliminar ${c.nombre}`"
                  :disabled="eliminandoId === c.id"
                  @click="onEliminarGastoFijo(c)"
                >
                  <AppIcon name="trash" class="h-4 w-4" />
                </button>
              </div>
            </template>
          </li>
        </ul>
      </div>

      <!-- Ingresos fijos -->
      <div v-else-if="tabActiva === 'ingresosFijos'" class="space-y-5">
        <form class="panel-sunken p-4 grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onCrearIngresoFijo">
          <FormField v-model="inf.nombre" label="Nombre" placeholder="Sueldo, Arriendo que recibo…" required />
          <FormField v-model="inf.monto" type="number" label="Monto (COP)" required />
          <div>
            <label class="label">Frecuencia</label>
            <select v-model="inf.frecuencia" class="field">
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          <FormField v-model="inf.fechaInicio" type="date" label="Primera ocurrencia" required />
          <div>
            <label class="label">Modo</label>
            <select v-model="inf.modo" class="field">
              <option value="automatico">Automático (ya recibido)</option>
              <option value="manual">Manual (queda pendiente)</option>
            </select>
          </div>
          <div>
            <label class="label">Categoría (opcional)</label>
            <select v-model="inf.categoriaId" class="field">
              <option value="">Sin definir</option>
              <option v-for="c in categoriasParaIngreso" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </div>
          <div class="sm:col-span-2 flex justify-end">
            <button type="submit" class="btn-primary w-full sm:w-auto" :disabled="creandoIngresoFijo">
              <AppIcon name="plus" class="h-4 w-4" />
              {{ creandoIngresoFijo ? 'Agregando…' : 'Agregar ingreso fijo' }}
            </button>
          </div>
        </form>

        <p v-if="!ingresosFijos.length" class="empty">No hay ingresos fijos todavía.</p>
        <ul v-else class="list">
          <li v-for="c in ingresosFijos" :key="c.id" :class="editandoIngresoFijoId === c.id ? 'py-3' : 'list-row'">
            <div v-if="editandoIngresoFijoId === c.id" class="panel-sunken p-4 space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField v-model="editInf.nombre" label="Nombre" required />
                <FormField v-model="editInf.monto" type="number" label="Monto (COP)" required />
                <div>
                  <label class="label">Frecuencia</label>
                  <select v-model="editInf.frecuencia" class="field">
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
                <div>
                  <label class="label">Modo</label>
                  <select v-model="editInf.modo" class="field">
                    <option value="automatico">Automático (ya recibido)</option>
                    <option value="manual">Manual (queda pendiente)</option>
                  </select>
                </div>
                <div>
                  <label class="label">Categoría (opcional)</label>
                  <select v-model="editInf.categoriaId" class="field">
                    <option value="">Sin definir</option>
                    <option v-for="cat in categoriasParaIngreso" :key="cat.id" :value="cat.id">{{ cat.nombre }}</option>
                  </select>
                </div>
              </div>
              <div class="flex items-center justify-end gap-2">
                <button class="btn-ghost btn-sm" @click="onCancelarEditarIngresoFijo">Cancelar</button>
                <button
                  class="btn-primary btn-sm"
                  :disabled="guardandoId === c.id"
                  @click="onGuardarEditarIngresoFijo(c)"
                >
                  Guardar
                </button>
              </div>
            </div>
            <template v-else>
              <div class="min-w-0" :class="{ 'opacity-50': !c.activo }">
                <p class="truncate text-sm font-medium text-ink-primary">{{ c.nombre }}</p>
                <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span class="text-[13px] text-ink-tertiary">
                    <span class="text-positive">{{ formatCurrency(c.monto) }}</span> ·
                    <span class="capitalize">{{ c.frecuencia }}</span>
                  </span>
                  <span :class="c.modo === 'automatico' ? 'badge-accent' : 'badge-neutral'">
                    {{ c.modo === 'automatico' ? 'Automático' : 'Manual' }}
                  </span>
                  <span v-if="!c.activo" class="badge-neutral">Inactivo</span>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <label class="mr-1 inline-flex items-center gap-1.5 text-[13px] text-ink-secondary">
                  <input
                    type="checkbox"
                    class="checkbox"
                    :checked="c.activo"
                    :disabled="guardandoId === c.id"
                    @change="onToggleActivoIngresoFijo(c)"
                  />
                  Activo
                </label>
                <button class="btn-icon" :aria-label="`Editar ${c.nombre}`" @click="onEditarIngresoFijo(c)">
                  <AppIcon name="edit" class="h-4 w-4" />
                </button>
                <button
                  class="btn-icon hover:text-negative hover:bg-negative/10"
                  :aria-label="`Eliminar ${c.nombre}`"
                  :disabled="eliminandoId === c.id"
                  @click="onEliminarIngresoFijo(c)"
                >
                  <AppIcon name="trash" class="h-4 w-4" />
                </button>
              </div>
            </template>
          </li>
        </ul>
      </div>

      <!-- Metas de ahorro -->
      <div v-else-if="tabActiva === 'ahorros'" class="space-y-5">
        <form class="panel-sunken p-4 grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onCrearAhorro">
          <FormField v-model="ah.nombre" label="Nombre" placeholder="Viaje a España…" required />
          <FormField v-model="ah.montoMetaTotal" type="number" label="Monto meta (opcional)" />
          <div>
            <label class="label">Regla</label>
            <select v-model="ah.reglaTipo" class="field">
              <option value="porcentaje">Porcentaje</option>
              <option value="monto_fijo">Monto fijo</option>
            </select>
          </div>
          <FormField
            v-model="ah.reglaValor"
            type="number"
            :label="ah.reglaTipo === 'porcentaje' ? 'Porcentaje (%)' : 'Monto (COP)'"
            required
          />
          <div>
            <label class="label">Base de cálculo</label>
            <select v-model="ah.baseCalculo" class="field">
              <option value="ingreso_menos_obligatorios">Ingreso menos obligatorios</option>
              <option value="disponible_total">Disponible total</option>
            </select>
          </div>
          <div>
            <label class="label">Modo</label>
            <select v-model="ah.modoTransaccion" class="field">
              <option value="manual">Manual (yo registro los aportes)</option>
              <option value="automatico">Automático (debita el sugerido cada ciclo)</option>
            </select>
          </div>
          <div>
            <label class="label">Categoría (opcional)</label>
            <select v-model="ah.categoriaId" class="field">
              <option value="">Sin definir</option>
              <option v-for="c in categoriasParaAhorro" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </div>
          <div class="sm:col-span-2 flex justify-end">
            <button type="submit" class="btn-primary w-full sm:w-auto" :disabled="creandoAhorro">
              <AppIcon name="plus" class="h-4 w-4" />
              {{ creandoAhorro ? 'Agregando…' : 'Agregar meta' }}
            </button>
          </div>
        </form>

        <p v-if="!ahorros.length" class="empty">No hay metas de ahorro todavía.</p>
        <ul v-else class="list">
          <li v-for="meta in ahorros" :key="meta.id" :class="editandoAhorroId === meta.id ? 'py-3' : 'list-row'">
            <div v-if="editandoAhorroId === meta.id" class="panel-sunken p-4 space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField v-model="editAh.nombre" label="Nombre" required />
                <FormField v-model="editAh.montoMetaTotal" type="number" label="Monto meta (opcional)" />
                <div>
                  <label class="label">Regla</label>
                  <select v-model="editAh.reglaTipo" class="field">
                    <option value="porcentaje">Porcentaje</option>
                    <option value="monto_fijo">Monto fijo</option>
                  </select>
                </div>
                <FormField
                  v-model="editAh.reglaValor"
                  type="number"
                  :label="editAh.reglaTipo === 'porcentaje' ? 'Porcentaje (%)' : 'Monto (COP)'"
                  required
                />
                <div>
                  <label class="label">Base de cálculo</label>
                  <select v-model="editAh.baseCalculo" class="field">
                    <option value="ingreso_menos_obligatorios">Ingreso menos obligatorios</option>
                    <option value="disponible_total">Disponible total</option>
                  </select>
                </div>
                <div>
                  <label class="label">Modo</label>
                  <select v-model="editAh.modoTransaccion" class="field">
                    <option value="manual">Manual (yo registro los aportes)</option>
                    <option value="automatico">Automático (debita el sugerido cada ciclo)</option>
                  </select>
                </div>
                <div>
                  <label class="label">Categoría (opcional)</label>
                  <select v-model="editAh.categoriaId" class="field">
                    <option value="">Sin definir</option>
                    <option v-for="cat in categoriasParaAhorro" :key="cat.id" :value="cat.id">{{ cat.nombre }}</option>
                  </select>
                </div>
              </div>
              <div class="flex items-center justify-end gap-2">
                <button class="btn-ghost btn-sm" @click="onCancelarEditarAhorro">Cancelar</button>
                <button
                  class="btn-primary btn-sm"
                  :disabled="guardandoId === meta.id"
                  @click="onGuardarEditarAhorro(meta)"
                >
                  Guardar
                </button>
              </div>
            </div>
            <template v-else>
              <div class="flex min-w-0 items-start gap-3" :class="{ 'opacity-50': !meta.activo }">
                <span class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                  <AppIcon name="piggy" class="h-4 w-4" />
                </span>
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-ink-primary">{{ meta.nombre }}</p>
                  <p class="mt-0.5 text-[13px] text-ink-tertiary">
                    {{ meta.reglaTipo === 'porcentaje' ? `${meta.reglaValor}%` : formatCurrency(meta.reglaValor) }} ·
                    {{ meta.baseCalculo === 'disponible_total' ? 'Disponible total' : 'Ingreso menos obligatorios' }}
                    <template v-if="meta.montoMetaTotal"> · Meta {{ formatCurrency(meta.montoMetaTotal) }}</template>
                  </p>
                  <div class="mt-1 flex flex-wrap gap-1">
                    <span :class="meta.modoTransaccion === 'automatico' ? 'badge-accent' : 'badge-neutral'">
                      {{ meta.modoTransaccion === 'automatico' ? 'Automático' : 'Manual' }}
                    </span>
                    <span v-if="!meta.activo" class="badge-neutral">Inactiva</span>
                  </div>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <label class="mr-1 inline-flex items-center gap-1.5 text-[13px] text-ink-secondary">
                  <input
                    type="checkbox"
                    class="checkbox"
                    :checked="meta.activo"
                    :disabled="guardandoId === meta.id"
                    @change="onToggleActivoAhorro(meta)"
                  />
                  Activo
                </label>
                <button class="btn-icon" :aria-label="`Editar ${meta.nombre}`" @click="onEditarAhorro(meta)">
                  <AppIcon name="edit" class="h-4 w-4" />
                </button>
                <button
                  class="btn-icon hover:text-negative hover:bg-negative/10"
                  :aria-label="`Eliminar ${meta.nombre}`"
                  :disabled="eliminandoId === meta.id"
                  @click="onEliminarAhorro(meta)"
                >
                  <AppIcon name="trash" class="h-4 w-4" />
                </button>
              </div>
            </template>
          </li>
        </ul>
      </div>

      <!-- Límites -->
      <div v-else class="space-y-5">
        <form class="panel-sunken p-4 grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onCrearLimite">
          <FormField v-model="li.nombre" label="Nombre" placeholder="Comida, Gastos hormiga…" required />
          <div>
            <label class="label">Aplica a</label>
            <select v-model="li.tipoObjetivo" class="field">
              <option value="categoria">Una categoría</option>
              <option value="obligatorios">Gastos obligatorios</option>
              <option value="no_obligatorios">Gastos no obligatorios</option>
              <option value="todo_gasto">Todo gasto</option>
            </select>
          </div>
          <div v-if="li.tipoObjetivo === 'categoria'">
            <label class="label">Categoría</label>
            <select v-model="li.categoriaId" class="field">
              <option value="">Selecciona una categoría</option>
              <option v-for="c in categoriasParaGasto" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </div>
          <div>
            <label class="label">Regla</label>
            <select v-model="li.reglaTipo" class="field">
              <option value="porcentaje">Porcentaje del ingreso del período</option>
              <option value="monto_fijo">Monto fijo</option>
            </select>
          </div>
          <FormField
            v-model="li.reglaValor"
            type="number"
            :label="li.reglaTipo === 'porcentaje' ? 'Porcentaje (%)' : 'Monto (COP)'"
            required
          />
          <div class="sm:col-span-2 flex justify-end">
            <button type="submit" class="btn-primary w-full sm:w-auto" :disabled="creandoLimite">
              <AppIcon name="plus" class="h-4 w-4" />
              {{ creandoLimite ? 'Agregando…' : 'Agregar límite' }}
            </button>
          </div>
        </form>

        <p v-if="!limites.length" class="empty">No hay límites configurados todavía.</p>
        <ul v-else class="list">
          <li v-for="limite in limites" :key="limite.id" :class="editandoLimiteId === limite.id ? 'py-3' : 'list-row'">
            <div v-if="editandoLimiteId === limite.id" class="panel-sunken p-4 space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField v-model="editLi.nombre" label="Nombre" required />
                <div>
                  <label class="label">Aplica a</label>
                  <select v-model="editLi.tipoObjetivo" class="field">
                    <option value="categoria">Una categoría</option>
                    <option value="obligatorios">Gastos obligatorios</option>
                    <option value="no_obligatorios">Gastos no obligatorios</option>
                    <option value="todo_gasto">Todo gasto</option>
                  </select>
                </div>
                <div v-if="editLi.tipoObjetivo === 'categoria'">
                  <label class="label">Categoría</label>
                  <select v-model="editLi.categoriaId" class="field">
                    <option value="">Selecciona una categoría</option>
                    <option v-for="cat in categoriasParaGasto" :key="cat.id" :value="cat.id">{{ cat.nombre }}</option>
                  </select>
                </div>
                <div>
                  <label class="label">Regla</label>
                  <select v-model="editLi.reglaTipo" class="field">
                    <option value="porcentaje">Porcentaje del ingreso del período</option>
                    <option value="monto_fijo">Monto fijo</option>
                  </select>
                </div>
                <FormField
                  v-model="editLi.reglaValor"
                  type="number"
                  :label="editLi.reglaTipo === 'porcentaje' ? 'Porcentaje (%)' : 'Monto (COP)'"
                  required
                />
              </div>
              <div class="flex items-center justify-end gap-2">
                <button class="btn-ghost btn-sm" @click="onCancelarEditarLimite">Cancelar</button>
                <button
                  class="btn-primary btn-sm"
                  :disabled="guardandoId === limite.id"
                  @click="onGuardarEditarLimite(limite)"
                >
                  Guardar
                </button>
              </div>
            </div>
            <template v-else>
              <div class="flex min-w-0 items-start gap-3" :class="{ 'opacity-50': !limite.activo }">
                <span class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-sunken text-ink-secondary">
                  <AppIcon name="gauge" class="h-4 w-4" />
                </span>
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-ink-primary">{{ limite.nombre }}</p>
                  <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span class="text-[13px] text-ink-tertiary">
                      {{
                        limite.reglaTipo === 'porcentaje'
                          ? `${limite.reglaValor}% del ingreso`
                          : formatCurrency(limite.reglaValor)
                      }}
                    </span>
                    <span class="badge-neutral">
                      {{ limite.categoria ? limite.categoria.nombre : TIPO_OBJETIVO_LABEL[limite.tipoObjetivo] }}
                    </span>
                    <span v-if="!limite.activo" class="badge-neutral">Inactivo</span>
                  </div>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <label class="mr-1 inline-flex items-center gap-1.5 text-[13px] text-ink-secondary">
                  <input
                    type="checkbox"
                    class="checkbox"
                    :checked="limite.activo"
                    :disabled="guardandoId === limite.id"
                    @change="onToggleActivoLimite(limite)"
                  />
                  Activo
                </label>
                <button class="btn-icon" :aria-label="`Editar ${limite.nombre}`" @click="onEditarLimite(limite)">
                  <AppIcon name="edit" class="h-4 w-4" />
                </button>
                <button
                  class="btn-icon hover:text-negative hover:bg-negative/10"
                  :aria-label="`Eliminar ${limite.nombre}`"
                  :disabled="eliminandoId === limite.id"
                  @click="onEliminarLimite(limite)"
                >
                  <AppIcon name="trash" class="h-4 w-4" />
                </button>
              </div>
            </template>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
