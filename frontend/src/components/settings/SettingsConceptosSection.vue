<script setup>
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
  if (!confirm(`¿Eliminar "${concepto.nombre}"? Esta acción no se puede deshacer.`)) return;
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

    <div v-if="canEdit" class="card p-6 sm:p-8">
      <h3 class="text-base font-semibold text-ink-primary mb-5">Nuevo concepto recurrente</h3>
      <form class="grid grid-cols-1 sm:grid-cols-3 gap-4" @submit.prevent="onCrearConcepto">
        <FormField v-model="nombre" label="Nombre" required placeholder="Arriendo, Mercado…" />
        <div>
          <label class="label">Tipo de monto</label>
          <select v-model="tipoMonto" class="field">
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
          <label class="label">Pagador por defecto (opcional)</label>
          <select v-model="pagadorDefaultUsuarioId" class="field">
            <option value="">Sin definir</option>
            <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
        </div>
        <div class="sm:col-span-3">
          <button type="submit" class="btn-primary" :disabled="creando">
            {{ creando ? 'Creando…' : 'Agregar concepto' }}
          </button>
        </div>
      </form>
    </div>

    <div class="card p-6 sm:p-8">
      <h3 class="text-base font-semibold text-ink-primary mb-5">Conceptos del hogar</h3>

      <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>
      <p v-else-if="!conceptos.length" class="text-sm text-ink-secondary">
        Aún no hay conceptos recurrentes configurados.
      </p>

      <ul v-else class="divide-y divide-border">
        <li v-for="concepto in conceptos" :key="concepto.id" class="py-4">
          <div v-if="editandoId === concepto.id" class="space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField v-model="edicion.nombre" label="Nombre" required />
              <div>
                <label class="label">Tipo de monto</label>
                <select v-model="edicion.tipoMonto" class="field">
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
            <div class="flex gap-2">
              <button
                class="btn-primary !px-3 !py-1.5 text-sm"
                :disabled="guardandoId === concepto.id"
                @click="onGuardarEdicion(concepto)"
              >
                {{ guardandoId === concepto.id ? 'Guardando…' : 'Guardar' }}
              </button>
              <button class="btn-ghost !px-3 !py-1.5 text-sm" @click="onCancelarEdicion">
                Cancelar
              </button>
            </div>
          </div>

          <div v-else class="flex items-center justify-between gap-4">
            <div>
              <p class="text-ink-primary font-medium" :class="{ 'opacity-50': !concepto.activo }">
                {{ concepto.nombre }}
              </p>
              <p class="text-sm text-ink-tertiary">
                {{ concepto.tipoMonto === 'fijo' ? formatCurrency(concepto.montoDefault) : 'Monto variable' }}
              </p>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <template v-if="canEdit">
                <button class="text-sm text-accent hover:text-accent-hover" @click="onIniciarEdicion(concepto)">
                  Editar
                </button>
                <button
                  class="text-sm text-ink-tertiary hover:text-negative transition-colors"
                  :disabled="eliminandoId === concepto.id"
                  @click="onEliminar(concepto)"
                >
                  Eliminar
                </button>
              </template>
              <label v-if="canEdit" class="inline-flex items-center gap-2 text-sm text-ink-secondary">
                <input
                  type="checkbox"
                  :checked="concepto.activo"
                  :disabled="guardandoId === concepto.id"
                  @change="onToggleActivo(concepto)"
                />
                Activo
              </label>
            </div>
          </div>

          <div v-if="canEdit" class="flex items-center gap-2 mt-3">
            <span class="text-sm text-ink-tertiary shrink-0">Pagador por defecto:</span>
            <select
              class="field !w-auto !py-1.5 text-sm"
              :value="concepto.pagadorDefaultUsuarioId ?? ''"
              :disabled="guardandoId === concepto.id"
              @change="onCambiarPagadorDefault(concepto, $event.target.value)"
            >
              <option value="">Sin definir</option>
              <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
            </select>
          </div>
          <p v-else-if="concepto.pagadorDefaultUsuarioId" class="text-sm text-ink-tertiary mt-2">
            Pagador por defecto: {{ nombrePagador(concepto.pagadorDefaultUsuarioId) }}
          </p>

          <div v-if="canEdit && puntosCorte.length > 1" class="flex flex-wrap gap-4 mt-3">
            <span class="text-sm text-ink-tertiary">Aplica a:</span>
            <label
              v-for="punto in puntosCorte"
              :key="punto.id"
              class="inline-flex items-center gap-2 text-sm text-ink-secondary"
            >
              <input
                type="checkbox"
                :checked="concepto.puntosCorte.length === 0 || aplicaAPunto(concepto, punto.id)"
                :disabled="guardandoId === concepto.id"
                @change="onTogglePunto(concepto, punto.id)"
              />
              {{ punto.referencia }}
            </label>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
