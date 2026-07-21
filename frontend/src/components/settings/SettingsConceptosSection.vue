<script setup>
import { ref, onMounted } from 'vue';
import { obtenerHogarActual } from '../../api/hogares.js';
import {
  listarConceptos,
  crearConcepto,
  actualizarConcepto,
  asignarPuntosCorte,
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
const loading = ref(true);
const error = ref('');
const guardandoId = ref(null);

const nombre = ref('');
const tipoMonto = ref('variable');
const montoDefault = ref('');
const creando = ref(false);

async function cargar() {
  loading.value = true;
  try {
    const [listaConceptos, { puntosCorte: puntos }] = await Promise.all([
      listarConceptos(),
      obtenerHogarActual(),
    ]);
    conceptos.value = listaConceptos;
    puntosCorte.value = puntos;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onCrearConcepto() {
  error.value = '';
  creando.value = true;
  try {
    const payload = { nombre: nombre.value, tipoMonto: tipoMonto.value };
    if (tipoMonto.value === 'fijo') {
      payload.montoDefault = Number(montoDefault.value);
    }
    const concepto = await crearConcepto(payload);
    conceptos.value = [...conceptos.value, { ...concepto, puntosCorte: [] }];
    nombre.value = '';
    montoDefault.value = '';
    tipoMonto.value = 'variable';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    creando.value = false;
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
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-ink-primary font-medium" :class="{ 'opacity-50': !concepto.activo }">
                {{ concepto.nombre }}
              </p>
              <p class="text-sm text-ink-tertiary">
                {{ concepto.tipoMonto === 'fijo' ? formatCurrency(concepto.montoDefault) : 'Monto variable' }}
              </p>
            </div>
            <label v-if="canEdit" class="inline-flex items-center gap-2 text-sm text-ink-secondary shrink-0">
              <input
                type="checkbox"
                :checked="concepto.activo"
                :disabled="guardandoId === concepto.id"
                @change="onToggleActivo(concepto)"
              />
              Activo
            </label>
          </div>

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
