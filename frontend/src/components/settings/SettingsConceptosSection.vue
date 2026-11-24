<script setup>
import { confirmar } from '../../composables/useConfirm.js';
import { ref, reactive, onMounted } from 'vue';
import { obtenerHogarActual, listarMiembros } from '../../api/hogares.js';
import {
  listarConceptos,
  crearConcepto,
  actualizarConcepto,
  asignarPuntosCorte,
  eliminarConcepto,
} from '../../api/conceptosRecurrentes.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency } from '../../utils/format.js';
import FormField from '../FormField.vue';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';

const props = defineProps({
  canEdit: { type: Boolean, default: false },
});

const conceptos = ref([]);
const puntosCorte = ref([]);
const miembros = ref([]);
const loading = ref(true);
const error = ref('');
const guardandoId = ref(null);

const nombre = ref('');
const tipoMonto = ref('variable');
const montoDefault = ref('');
const pagadorDefaultUsuarioId = ref('');
const creando = ref(false);

const editandoId = ref(null);
const edicion = reactive({ nombre: '', tipoMonto: 'variable', montoDefault: '' });
const eliminandoId = ref(null);

async function cargar() {
  loading.value = true;
  try {
    const [listaConceptos, { puntosCorte: puntos }, listaMiembros] = await Promise.all([
      listarConceptos(),
      obtenerHogarActual(),
      listarMiembros(),
    ]);
    conceptos.value = listaConceptos;
    puntosCorte.value = puntos;
    miembros.value = listaMiembros;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

function nombrePagador(usuarioId) {
  return miembros.value.find((m) => m.id === usuarioId)?.nombre ?? '';
}

async function onCrearConcepto() {
  error.value = '';
  creando.value = true;
  try {
    const payload = { nombre: nombre.value, tipoMonto: tipoMonto.value };
    if (tipoMonto.value === 'fijo') {
      payload.montoDefault = Number(montoDefault.value);
    }
    if (pagadorDefaultUsuarioId.value) {
      payload.pagadorDefaultUsuarioId = pagadorDefaultUsuarioId.value;
    }
    const concepto = await crearConcepto(payload);
    conceptos.value = [...conceptos.value, { ...concepto, puntosCorte: [] }];
    nombre.value = '';
    montoDefault.value = '';
    tipoMonto.value = 'variable';
    pagadorDefaultUsuarioId.value = '';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    creando.value = false;
  }
}

async function onCambiarPagadorDefault(concepto, usuarioId) {
  error.value = '';
  guardandoId.value = concepto.id;
  try {
    const actualizado = await actualizarConcepto(concepto.id, {
      pagadorDefaultUsuarioId: usuarioId || null,
    });
    const idx = conceptos.value.findIndex((c) => c.id === concepto.id);
    conceptos.value[idx] = { ...conceptos.value[idx], pagadorDefaultUsuarioId: actualizado.pagadorDefaultUsuarioId };
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

function onIniciarEdicion(concepto) {
  error.value = '';
  edicion.nombre = concepto.nombre;
  edicion.tipoMonto = concepto.tipoMonto;
  edicion.montoDefault = concepto.montoDefault ?? '';
  editandoId.value = concepto.id;
}

function onCancelarEdicion() {
  editandoId.value = null;
}

async function onGuardarEdicion(concepto) {
  error.value = '';
  guardandoId.value = concepto.id;
  try {
    const payload = { nombre: edicion.nombre, tipoMonto: edicion.tipoMonto };
    if (edicion.tipoMonto === 'fijo') {
      payload.montoDefault = Number(edicion.montoDefault);
    }
    const actualizado = await actualizarConcepto(concepto.id, payload);
    const idx = conceptos.value.findIndex((c) => c.id === concepto.id);
    conceptos.value[idx] = { ...conceptos.value[idx], ...actualizado };
    editandoId.value = null;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

async function onEliminar(concepto) {
  if (!(await confirmar(`¿Eliminar "${concepto.nombre}"? Esta acción no se puede deshacer.`))) return;
  error.value = '';
  eliminandoId.value = concepto.id;
  try {
    await eliminarConcepto(concepto.id);
    conceptos.value = conceptos.value.filter((c) => c.id !== concepto.id);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoId.value = null;
  }
}

async function onToggleActivo(concepto) {
  error.value = '';
  guardandoId.value = concepto.id;
  try {
    const actualizado = await actualizarConcepto(concepto.id, { activo: !concepto.activo });
    const idx = conceptos.value.findIndex((c) => c.id === concepto.id);
    conceptos.value[idx] = { ...conceptos.value[idx], activo: actualizado.activo };
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

function aplicaAPunto(concepto, puntoId) {
  return concepto.puntosCorte.some((cp) => cp.puntoCorteId === puntoId);
}

async function onTogglePunto(concepto, puntoId) {
  error.value = '';
  guardandoId.value = concepto.id;
  try {
    // Lista vacía significa "aplica a todos"; hay que expandirla antes de
    // quitar un punto, si no, desmarcar termina dejando solo ese punto.
    const aplicaTodos = concepto.puntosCorte.length === 0;
    const idsActuales = aplicaTodos
      ? puntosCorte.value.map((p) => p.id)
      : concepto.puntosCorte.map((cp) => cp.puntoCorteId);

    const nuevosIds = idsActuales.includes(puntoId)
      ? idsActuales.filter((id) => id !== puntoId)
      : [...idsActuales, puntoId];

    // Si vuelve a cubrir todos los puntos, lo colapsamos a [] para mantener
    // la convención del backend (vacío = todos).
    const payload = nuevosIds.length === puntosCorte.value.length ? [] : nuevosIds;

    const actualizado = await asignarPuntosCorte(concepto.id, payload);
    const idx = conceptos.value.findIndex((c) => c.id === concepto.id);
    conceptos.value[idx] = actualizado;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

onMounted(cargar);
</script>

<template>
  <div class="space-y-6">
    <AlertError :message="error" />

    <section v-if="canEdit" class="card card-pad">
      <header class="mb-5 flex items-start gap-3">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <AppIcon name="plus" class="h-[18px] w-[18px]" />
        </span>
        <div>
          <h3 class="section-title">Nuevo concepto recurrente</h3>
          <p class="section-hint">Gastos que se repiten en cada corte, como arriendo o servicios.</p>
        </div>
      </header>

      <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="onCrearConcepto">
        <FormField v-model="nombre" label="Nombre" required placeholder="Arriendo, Mercado…" />
        <div>
          <label class="label" for="concepto-nuevo-tipo">Tipo de monto</label>
          <select id="concepto-nuevo-tipo" v-model="tipoMonto" class="field">
            <option value="variable">Variable</option>
            <option value="fijo">Fijo</option>
          </select>
        </div>
        <FormField
          v-if="tipoMonto === 'fijo'"
          v-model="montoDefault"
          type="number"
          label="Monto por defecto (COP)"
          required
        />
        <div>
          <label class="label" for="concepto-nuevo-pagador">Pagador por defecto (opcional)</label>
          <select id="concepto-nuevo-pagador" v-model="pagadorDefaultUsuarioId" class="field">
            <option value="">Sin definir</option>
            <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
        </div>
        <div class="flex justify-end sm:col-span-2">
          <button type="submit" class="btn-primary" :disabled="creando">
            <AppIcon v-if="!creando" name="plus" class="h-4 w-4" />
            {{ creando ? 'Creando…' : 'Agregar concepto' }}
          </button>
        </div>
      </form>
    </section>

    <section class="card card-pad">
      <header class="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 class="section-title">Conceptos del hogar</h3>
          <p class="section-hint">Su monto y pagador de cada período se completan en el corte.</p>
        </div>
        <span v-if="!loading && conceptos.length" class="badge-neutral shrink-0">{{ conceptos.length }}</span>
      </header>

      <p v-if="loading" class="empty">Cargando…</p>
      <p v-else-if="!conceptos.length" class="empty">Aún no hay conceptos recurrentes configurados.</p>

      <ul v-else class="list">
        <li v-for="concepto in conceptos" :key="concepto.id" class="py-4">
          <!-- Edición en línea -->
          <div v-if="editandoId === concepto.id" class="panel-sunken space-y-4 p-4">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField v-model="edicion.nombre" label="Nombre" required />
              <div>
                <label class="label" :for="`concepto-${concepto.id}-tipo`">Tipo de monto</label>
                <select :id="`concepto-${concepto.id}-tipo`" v-model="edicion.tipoMonto" class="field">
                  <option value="variable">Variable</option>
                  <option value="fijo">Fijo</option>
                </select>
              </div>
              <FormField
                v-if="edicion.tipoMonto === 'fijo'"
                v-model="edicion.montoDefault"
                type="number"
                label="Monto por defecto (COP)"
                required
              />
            </div>
            <div class="flex justify-end gap-2">
              <button type="button" class="btn-ghost btn-sm" @click="onCancelarEdicion">Cancelar</button>
              <button
                type="button"
                class="btn-primary btn-sm"
                :disabled="guardandoId === concepto.id"
                @click="onGuardarEdicion(concepto)"
              >
                {{ guardandoId === concepto.id ? 'Guardando…' : 'Guardar' }}
              </button>
            </div>
          </div>

          <!-- Vista normal -->
          <div v-else class="flex items-start gap-3">
            <span
              class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-secondary"
              :class="{ 'opacity-50': !concepto.activo }"
              aria-hidden="true"
            >
              <AppIcon name="repeat" class="h-4 w-4" />
            </span>

            <div class="min-w-0 flex-1" :class="{ 'opacity-60': !concepto.activo }">
              <p class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span class="truncate text-sm font-medium text-ink-primary">{{ concepto.nombre }}</span>
                <span :class="concepto.tipoMonto === 'fijo' ? 'badge-accent' : 'badge-neutral'">
                  {{ concepto.tipoMonto === 'fijo' ? 'Fijo' : 'Variable' }}
                </span>
                <span v-if="!concepto.activo" class="badge-warning">Inactivo</span>
              </p>
              <p class="mt-0.5 text-[13px] text-ink-secondary">
                {{ concepto.tipoMonto === 'fijo' ? formatCurrency(concepto.montoDefault) : 'Monto variable' }}
              </p>
            </div>

            <div v-if="canEdit" class="flex shrink-0 items-center gap-1">
              <label
                class="mr-1 inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-secondary hover:text-ink-primary"
              >
                <input
                  type="checkbox"
                  class="checkbox"
                  :checked="concepto.activo"
                  :disabled="guardandoId === concepto.id"
                  @change="onToggleActivo(concepto)"
                />
                <span class="sr-only sm:not-sr-only">Activo</span>
              </label>
              <button
                type="button"
                class="btn-icon"
                :aria-label="`Editar ${concepto.nombre}`"
                :title="`Editar ${concepto.nombre}`"
                @click="onIniciarEdicion(concepto)"
              >
                <AppIcon name="edit" class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="btn-icon hover:!text-negative hover:!bg-negative/10"
                :aria-label="`Eliminar ${concepto.nombre}`"
                :title="`Eliminar ${concepto.nombre}`"
                :disabled="eliminandoId === concepto.id"
                @click="onEliminar(concepto)"
              >
                <AppIcon name="trash" class="h-4 w-4" />
              </button>
            </div>
          </div>

          <!-- Pagador y puntos de corte -->
          <div
            v-if="canEdit"
            class="mt-3 grid grid-cols-1 gap-3 sm:ml-12"
            :class="puntosCorte.length > 1 ? 'sm:grid-cols-2' : ''"
          >
            <div class="flex min-w-0 items-center gap-2">
              <label class="shrink-0 text-[13px] text-ink-tertiary" :for="`concepto-${concepto.id}-pagador`">
                Pagador por defecto
              </label>
              <select
                :id="`concepto-${concepto.id}-pagador`"
                class="field !w-auto min-w-0 flex-1 !py-1.5 text-[13px] sm:flex-none"
                :value="concepto.pagadorDefaultUsuarioId ?? ''"
                :disabled="guardandoId === concepto.id"
                @change="onCambiarPagadorDefault(concepto, $event.target.value)"
              >
                <option value="">Sin definir</option>
                <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
              </select>
            </div>

            <fieldset v-if="puntosCorte.length > 1" class="flex flex-wrap items-center gap-x-4 gap-y-2">
              <legend class="sr-only">Puntos de corte a los que aplica</legend>
              <span class="text-[13px] text-ink-tertiary" aria-hidden="true">Aplica a</span>
              <label
                v-for="punto in puntosCorte"
                :key="punto.id"
                class="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-secondary hover:text-ink-primary"
              >
                <input
                  type="checkbox"
                  class="checkbox"
                  :checked="concepto.puntosCorte.length === 0 || aplicaAPunto(concepto, punto.id)"
                  :disabled="guardandoId === concepto.id"
                  @change="onTogglePunto(concepto, punto.id)"
                />
                {{ punto.referencia }}
              </label>
            </fieldset>
          </div>
          <p v-else-if="concepto.pagadorDefaultUsuarioId" class="ml-12 mt-2 text-[13px] text-ink-tertiary">
            Pagador por defecto:
            <span class="text-ink-secondary">{{ nombrePagador(concepto.pagadorDefaultUsuarioId) }}</span>
          </p>
        </li>
      </ul>
    </section>
  </div>
</template>
