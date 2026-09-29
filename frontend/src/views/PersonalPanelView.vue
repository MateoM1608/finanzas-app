<script setup>
import { ref, computed, onMounted } from 'vue';
import { listarGastos, crearGasto, actualizarGasto, eliminarGasto } from '../api/gastosPersonales.js';
import { listarIngresos, crearIngreso, actualizarIngreso, eliminarIngreso } from '../api/ingresosPersonales.js';
import { listarCategorias } from '../api/categoriasPersonales.js';
import { listarMetodosPago } from '../api/metodosPagoPersonales.js';
import { extractErrorMessage } from '../api/client.js';
import { formatCurrency, formatDate, hoyISO } from '../utils/format.js';
import AppHeader from '../components/AppHeader.vue';
import FormField from '../components/FormField.vue';
import AlertError from '../components/AlertError.vue';
import AppModal from '../components/AppModal.vue';
import ConfiguracionPersonalSection from '../components/personal/ConfiguracionPersonalSection.vue';
import ResumenPersonalSection from '../components/personal/ResumenPersonalSection.vue';
import AhorrosPersonalesSection from '../components/personal/AhorrosPersonalesSection.vue';
import LimitesPersonalesSection from '../components/personal/LimitesPersonalesSection.vue';

const mostrarConfig = ref(false);
const loading = ref(true);
const error = ref('');
const resumenRef = ref(null);
const ahorrosRef = ref(null);
const limitesRef = ref(null);

function recargarResumenes() {
  resumenRef.value?.recargar();
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

async function cargarGastos() {
  gastos.value = await listarGastos();
}

async function onAgregarGasto() {
  error.value = '';
  guardandoGasto.value = true;
  try {
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

async function cargarTodo() {
  loading.value = true;
  try {
    const [c, m] = await Promise.all([listarCategorias(), listarMetodosPago()]);
    categorias.value = c;
    metodos.value = m;
    await Promise.all([cargarGastos(), cargarIngresos()]);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

onMounted(cargarTodo);
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <ResumenPersonalSection ref="resumenRef" />

      <section class="card p-6 sm:p-8">
        <h2 class="text-base font-semibold text-ink-primary mb-5">Límites</h2>
        <LimitesPersonalesSection ref="limitesRef" />
      </section>

      <section class="card p-6 sm:p-8">
        <h2 class="text-base font-semibold text-ink-primary mb-5">Ahorros</h2>
        <AhorrosPersonalesSection ref="ahorrosRef" />
      </section>

      <AlertError :message="error" />

      <section class="card p-6 sm:p-8">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 class="text-base font-semibold text-ink-primary">Registrar gasto</h2>
          <button class="btn-secondary" @click="mostrarConfig = true">Configuración personal</button>
        </div>

        <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onAgregarGasto">
          <FormField v-model="gMonto" type="number" label="Monto (COP)" required placeholder="30000" />
          <FormField v-model="gFecha" type="date" label="Fecha" required />
          <FormField v-model="gDescripcion" label="Descripción (opcional)" placeholder="Detalle breve" />
          <div>
            <label class="label">Categoría (opcional)</label>
            <select v-model="gCategoriaId" class="field">
              <option value="">Sin definir</option>
              <option v-for="c in categoriasParaGasto" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </div>
          <div>
            <label class="label">Método de pago (opcional)</label>
            <select v-model="gMetodoPagoId" class="field">
              <option value="">Sin definir</option>
              <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
            </select>
          </div>
          <div>
            <label class="label">Estado</label>
            <select v-model="gEstado" class="field">
              <option value="pagado">Ya pagado</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
          <div class="sm:col-span-2 flex items-center gap-2">
            <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
              <input v-model="gEsObligatorio" type="checkbox" /> Es un gasto obligatorio
            </label>
          </div>

          <div class="sm:col-span-2">
            <button type="submit" class="btn-primary w-full sm:w-auto" :disabled="guardandoGasto">
              {{ guardandoGasto ? 'Guardando…' : 'Agregar gasto' }}
            </button>
          </div>
        </form>
      </section>

      <section class="card p-6 sm:p-8">
        <h2 class="text-base font-semibold text-ink-primary mb-5">Gastos recientes</h2>

        <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>
        <p v-else-if="!gastos.length" class="text-sm text-ink-secondary">
          Aún no has registrado gastos personales.
        </p>

        <ul v-else class="divide-y divide-border">
          <li v-for="gasto in gastos" :key="gasto.id" class="py-4 group">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-ink-primary font-medium flex items-center gap-2 flex-wrap">
                  {{ gasto.descripcion || gasto.categoria?.nombre || 'Gasto personal' }}
                  <span
                    v-if="gasto.estado === 'pendiente'"
                    class="text-xs font-semibold uppercase px-2 py-0.5 rounded-full bg-negative/10 text-negative"
                  >
                    Pendiente
                  </span>
                  <span v-if="gasto.esObligatorio" class="text-xs text-accent">obligatorio</span>
                  <span v-if="gasto.origenConfigId" class="text-xs text-ink-tertiary">(fijo)</span>
                  <span v-if="gasto.origenCorteId" class="text-xs text-ink-tertiary">(hogar)</span>
                </p>
                <p class="text-sm text-ink-tertiary">
                  {{ formatDate(gasto.fecha) }}
                  <template v-if="gasto.descripcion && gasto.categoria"> · {{ gasto.categoria.nombre }}</template>
                  <template v-if="gasto.metodoPago"> · {{ gasto.metodoPago.nombre }}</template>
                </p>
              </div>

              <div class="flex items-center gap-3 shrink-0">
                <span class="text-ink-primary font-medium">{{ formatCurrency(gasto.monto) }}</span>
                <button
                  class="text-sm text-accent hover:text-accent-hover"
                  :disabled="cambiandoEstadoGastoId === gasto.id"
                  @click="onToggleEstadoGasto(gasto)"
                >
                  {{ gasto.estado === 'pagado' ? 'Marcar pendiente' : 'Marcar pagado' }}
                </button>
                <button
                  v-if="!gasto.origenConfigId && !gasto.origenCorteId"
                  class="text-sm text-ink-tertiary hover:text-negative transition-colors opacity-0 group-hover:opacity-100"
                  :disabled="eliminandoGastoId === gasto.id"
                  @click="onEliminarGasto(gasto.id)"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <section class="card p-6 sm:p-8">
        <h2 class="text-base font-semibold text-ink-primary mb-5">Registrar ingreso</h2>

        <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onAgregarIngreso">
          <FormField v-model="iMonto" type="number" label="Monto (COP)" required placeholder="3000000" />
          <FormField v-model="iFecha" type="date" label="Fecha" required />
          <FormField v-model="iDescripcion" label="Descripción (opcional)" placeholder="Ej. Salario, freelance" />
          <div>
            <label class="label">Categoría (opcional)</label>
            <select v-model="iCategoriaId" class="field">
              <option value="">Sin definir</option>
              <option v-for="c in categoriasParaIngreso" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </div>
          <div>
            <label class="label">Método de pago (opcional)</label>
            <select v-model="iMetodoPagoId" class="field">
              <option value="">Sin definir</option>
              <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
            </select>
          </div>
          <div>
            <label class="label">Estado</label>
            <select v-model="iEstado" class="field">
              <option value="recibido">Ya recibido</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>

          <div class="sm:col-span-2">
            <button type="submit" class="btn-primary w-full sm:w-auto" :disabled="guardandoIngreso">
              {{ guardandoIngreso ? 'Guardando…' : 'Agregar ingreso' }}
            </button>
          </div>
        </form>
      </section>

      <section class="card p-6 sm:p-8">
        <h2 class="text-base font-semibold text-ink-primary mb-5">Ingresos recientes</h2>

        <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>
        <p v-else-if="!ingresos.length" class="text-sm text-ink-secondary">
          Aún no has registrado ingresos personales.
        </p>

        <ul v-else class="divide-y divide-border">
          <li v-for="ingreso in ingresos" :key="ingreso.id" class="py-4 group">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-ink-primary font-medium flex items-center gap-2 flex-wrap">
                  {{ ingreso.descripcion || ingreso.categoria?.nombre || 'Ingreso personal' }}
                  <span
                    v-if="ingreso.estado === 'pendiente'"
                    class="text-xs font-semibold uppercase px-2 py-0.5 rounded-full bg-negative/10 text-negative"
                  >
                    Pendiente
                  </span>
                  <span v-if="ingreso.origenConfigId" class="text-xs text-ink-tertiary">(fijo)</span>
                </p>
                <p class="text-sm text-ink-tertiary">
                  {{ formatDate(ingreso.fecha) }}
                  <template v-if="ingreso.descripcion && ingreso.categoria"> · {{ ingreso.categoria.nombre }}</template>
                  <template v-if="ingreso.metodoPago"> · {{ ingreso.metodoPago.nombre }}</template>
                </p>
              </div>

              <div class="flex items-center gap-3 shrink-0">
                <span class="text-ink-primary font-medium">{{ formatCurrency(ingreso.monto) }}</span>
                <button
                  class="text-sm text-accent hover:text-accent-hover"
                  :disabled="cambiandoEstadoIngresoId === ingreso.id"
                  @click="onToggleEstadoIngreso(ingreso)"
                >
                  {{ ingreso.estado === 'recibido' ? 'Marcar pendiente' : 'Marcar recibido' }}
                </button>
                <button
                  v-if="!ingreso.origenConfigId"
                  class="text-sm text-ink-tertiary hover:text-negative transition-colors opacity-0 group-hover:opacity-100"
                  :disabled="eliminandoIngresoId === ingreso.id"
                  @click="onEliminarIngreso(ingreso.id)"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </main>

    <AppModal v-if="mostrarConfig" title="Configuración personal" @close="mostrarConfig = false">
      <ConfiguracionPersonalSection />
    </AppModal>
  </div>
</template>
