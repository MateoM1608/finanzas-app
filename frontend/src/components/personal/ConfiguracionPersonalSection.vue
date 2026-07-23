<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import {
  listarMetodosPago,
  crearMetodoPago,
  eliminarMetodoPago,
} from '../../api/metodosPagoPersonales.js';
import {
  listarCategorias,
  crearCategoria,
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
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency } from '../../utils/format.js';
import FormField from '../FormField.vue';
import AlertError from '../AlertError.vue';

const TABS = [
  { key: 'metodos', label: 'Métodos de pago' },
  { key: 'categorias', label: 'Categorías' },
  { key: 'gastosFijos', label: 'Gastos fijos' },
  { key: 'ingresosFijos', label: 'Ingresos fijos' },
];
const tabActiva = ref('metodos');

const loading = ref(true);
const error = ref('');
const guardandoId = ref(null);
const eliminandoId = ref(null);

const metodos = ref([]);
const categorias = ref([]);
const gastosFijos = ref([]);
const ingresosFijos = ref([]);

async function cargar() {
  loading.value = true;
  try {
    const [m, c, gf, inf] = await Promise.all([
      listarMetodosPago(),
      listarCategorias(),
      listarGastosFijos(),
      listarIngresosFijos(),
    ]);
    metodos.value = m;
    categorias.value = c;
    gastosFijos.value = gf;
    ingresosFijos.value = inf;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(cargar);

// --- Métodos de pago ---
const nuevoMetodoNombre = ref('');
const creandoMetodo = ref(false);

async function onCrearMetodo() {
  error.value = '';
  creandoMetodo.value = true;
  try {
    const metodo = await crearMetodoPago({ nombre: nuevoMetodoNombre.value });
    metodos.value = [...metodos.value, metodo];
    nuevoMetodoNombre.value = '';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    creandoMetodo.value = false;
  }
}

async function onEliminarMetodo(metodo) {
  if (!confirm(`¿Eliminar "${metodo.nombre}"?`)) return;
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
  if (!confirm(`¿Eliminar "${categoria.nombre}"?`)) return;
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

// --- Gastos fijos ---
const gf = reactive({
  nombre: '',
  monto: '',
  frecuencia: 'mensual',
  fechaInicio: new Date().toISOString().slice(0, 10),
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
  if (!confirm(`¿Eliminar "${config.nombre}"? Esta acción no se puede deshacer.`)) return;
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

// --- Ingresos fijos ---
const inf = reactive({
  nombre: '',
  monto: '',
  frecuencia: 'mensual',
  fechaInicio: new Date().toISOString().slice(0, 10),
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
  if (!confirm(`¿Eliminar "${config.nombre}"? Esta acción no se puede deshacer.`)) return;
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

const categoriasParaGasto = computed(() => categorias.value.filter((c) => c.aplicaA.includes('gasto')));
const categoriasParaIngreso = computed(() => categorias.value.filter((c) => c.aplicaA.includes('ingreso')));
</script>

<template>
  <div>
    <AlertError :message="error" />

    <div class="flex flex-wrap gap-2 mb-6">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="!px-3 !py-1.5 text-sm"
        :class="tabActiva === tab.key ? 'btn-primary' : 'btn-ghost'"
        @click="tabActiva = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>

    <template v-else>
      <div v-if="tabActiva === 'metodos'" class="space-y-6">
        <form class="flex gap-3" @submit.prevent="onCrearMetodo">
          <FormField v-model="nuevoMetodoNombre" label="Nuevo método" placeholder="Nequi, Efectivo…" required />
          <button type="submit" class="btn-primary self-end" :disabled="creandoMetodo">
            {{ creandoMetodo ? 'Agregando…' : 'Agregar' }}
          </button>
        </form>

        <p v-if="!metodos.length" class="text-sm text-ink-secondary">No hay métodos de pago todavía.</p>
        <ul v-else class="divide-y divide-border">
          <li v-for="m in metodos" :key="m.id" class="py-3 flex items-center justify-between">
            <span class="text-ink-primary">{{ m.nombre }}</span>
            <button
              class="text-sm text-ink-tertiary hover:text-negative"
              :disabled="eliminandoId === m.id"
              @click="onEliminarMetodo(m)"
            >
              Eliminar
            </button>
          </li>
        </ul>
      </div>

      <div v-else-if="tabActiva === 'categorias'" class="space-y-6">
        <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onCrearCategoria">
          <FormField v-model="nuevaCategoriaNombre" label="Nueva categoría" placeholder="Ocio, Sueldo…" required />
          <div>
            <label class="label">Aplica a</label>
            <div class="flex gap-4 mt-2">
              <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
                <input v-model="nuevaCategoriaAplicaA.gasto" type="checkbox" /> Gasto
              </label>
              <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
                <input v-model="nuevaCategoriaAplicaA.ingreso" type="checkbox" /> Ingreso
              </label>
              <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
                <input v-model="nuevaCategoriaAplicaA.ahorro" type="checkbox" /> Ahorro
              </label>
            </div>
          </div>
          <div class="sm:col-span-2">
            <button type="submit" class="btn-primary" :disabled="creandoCategoria">
              {{ creandoCategoria ? 'Agregando…' : 'Agregar categoría' }}
            </button>
          </div>
        </form>

        <p v-if="!categorias.length" class="text-sm text-ink-secondary">No hay categorías todavía.</p>
        <ul v-else class="divide-y divide-border">
          <li v-for="c in categorias" :key="c.id" class="py-3 flex items-center justify-between">
            <span class="text-ink-primary">
              {{ c.nombre }}
              <span class="text-xs text-ink-tertiary font-normal">({{ c.aplicaA.join(', ') }})</span>
            </span>
            <button
              class="text-sm text-ink-tertiary hover:text-negative"
              :disabled="eliminandoId === c.id"
              @click="onEliminarCategoria(c)"
            >
              Eliminar
            </button>
          </li>
        </ul>
      </div>

      <div v-else-if="tabActiva === 'gastosFijos'" class="space-y-6">
        <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onCrearGastoFijo">
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
          <div class="flex items-end">
            <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
              <input v-model="gf.esObligatorio" type="checkbox" /> Es obligatorio
            </label>
          </div>
          <div class="sm:col-span-2">
            <button type="submit" class="btn-primary" :disabled="creandoGastoFijo">
              {{ creandoGastoFijo ? 'Agregando…' : 'Agregar gasto fijo' }}
            </button>
          </div>
        </form>

        <p v-if="!gastosFijos.length" class="text-sm text-ink-secondary">No hay gastos fijos todavía.</p>
        <ul v-else class="divide-y divide-border">
          <li v-for="c in gastosFijos" :key="c.id" class="py-3">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-ink-primary font-medium" :class="{ 'opacity-50': !c.activo }">
                  {{ c.nombre }}
                  <span v-if="c.esObligatorio" class="text-xs text-accent font-normal">· obligatorio</span>
                </p>
                <p class="text-sm text-ink-tertiary">
                  {{ formatCurrency(c.monto) }} · {{ c.frecuencia }} ·
                  {{ c.modoCobro === 'automatico' ? 'automático' : 'manual' }}
                </p>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
                  <input
                    type="checkbox"
                    :checked="c.activo"
                    :disabled="guardandoId === c.id"
                    @change="onToggleActivoGastoFijo(c)"
                  />
                  Activo
                </label>
                <button
                  class="text-sm text-ink-tertiary hover:text-negative"
                  :disabled="eliminandoId === c.id"
                  @click="onEliminarGastoFijo(c)"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <div v-else class="space-y-6">
        <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onCrearIngresoFijo">
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
          <div class="sm:col-span-2">
            <button type="submit" class="btn-primary" :disabled="creandoIngresoFijo">
              {{ creandoIngresoFijo ? 'Agregando…' : 'Agregar ingreso fijo' }}
            </button>
          </div>
        </form>

        <p v-if="!ingresosFijos.length" class="text-sm text-ink-secondary">No hay ingresos fijos todavía.</p>
        <ul v-else class="divide-y divide-border">
          <li v-for="c in ingresosFijos" :key="c.id" class="py-3">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-ink-primary font-medium" :class="{ 'opacity-50': !c.activo }">{{ c.nombre }}</p>
                <p class="text-sm text-ink-tertiary">
                  {{ formatCurrency(c.monto) }} · {{ c.frecuencia }} ·
                  {{ c.modo === 'automatico' ? 'automático' : 'manual' }}
                </p>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
                  <input
                    type="checkbox"
                    :checked="c.activo"
                    :disabled="guardandoId === c.id"
                    @change="onToggleActivoIngresoFijo(c)"
                  />
                  Activo
                </label>
                <button
                  class="text-sm text-ink-tertiary hover:text-negative"
                  :disabled="eliminandoId === c.id"
                  @click="onEliminarIngresoFijo(c)"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
