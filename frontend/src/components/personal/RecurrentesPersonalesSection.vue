<script setup>
import { ref, reactive, onMounted } from 'vue';
import {
  obtenerConfiguracionPersonal,
  actualizarFrecuenciaPersonal,
  actualizarPuntosCortePersonal,
} from '../../api/configuracionPersonal.js';
import {
  listarConceptosPersonales,
  crearConceptoPersonal,
  actualizarConceptoPersonal,
  eliminarConceptoPersonal,
  asignarPuntosCorteConcepto,
} from '../../api/conceptosRecurrentesPersonales.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency } from '../../utils/format.js';
import FormField from '../FormField.vue';
import AlertError from '../AlertError.vue';

const frecuenciaCortePersonal = ref('mensual');
const puntosCorte = ref([]);
const conceptos = ref([]);
const loading = ref(true);
const error = ref('');
const exito = ref('');

const guardandoFrecuencia = ref(false);
const guardandoPuntos = ref(false);
const guardandoId = ref(null);

const nombre = ref('');
const categoria = ref('');
const tipoMonto = ref('variable');
const montoDefault = ref('');
const creando = ref(false);

const editandoId = ref(null);
const edicion = reactive({ nombre: '', categoria: '', tipoMonto: 'variable', montoDefault: '' });
const eliminandoId = ref(null);

async function cargar() {
  loading.value = true;
  try {
    const [config, listaConceptos] = await Promise.all([
      obtenerConfiguracionPersonal(),
      listarConceptosPersonales(),
    ]);
    frecuenciaCortePersonal.value = config.frecuenciaCortePersonal;
    puntosCorte.value = config.puntosCorte.map((p) => ({ ...p }));
    conceptos.value = listaConceptos;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onGuardarFrecuencia() {
  error.value = '';
  exito.value = '';
  guardandoFrecuencia.value = true;
  try {
    const config = await actualizarFrecuenciaPersonal(frecuenciaCortePersonal.value);
    puntosCorte.value = config.puntosCorte.map((p) => ({ ...p }));
    exito.value = 'Frecuencia actualizada';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoFrecuencia.value = false;
  }
}

async function onGuardarPuntos() {
  error.value = '';
  exito.value = '';
  guardandoPuntos.value = true;
  try {
    const puntos = await actualizarPuntosCortePersonal(
      puntosCorte.value.map((p) => ({ id: p.id, referencia: p.referencia })),
    );
    puntosCorte.value = puntos.map((p) => ({ ...p }));
    exito.value = 'Puntos de corte actualizados';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoPuntos.value = false;
  }
}

async function onCrearConcepto() {
  error.value = '';
  creando.value = true;
  try {
    const payload = { nombre: nombre.value, tipoMonto: tipoMonto.value };
    if (categoria.value) payload.categoria = categoria.value;
    if (tipoMonto.value === 'fijo') payload.montoDefault = Number(montoDefault.value);
    const concepto = await crearConceptoPersonal(payload);
    conceptos.value = [...conceptos.value, { ...concepto, puntosCorte: [] }];
    nombre.value = '';
    categoria.value = '';
    montoDefault.value = '';
    tipoMonto.value = 'variable';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    creando.value = false;
  }
}

function onIniciarEdicion(concepto) {
  error.value = '';
  edicion.nombre = concepto.nombre;
  edicion.categoria = concepto.categoria ?? '';
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
    const payload = {
      nombre: edicion.nombre,
      categoria: edicion.categoria || null,
      tipoMonto: edicion.tipoMonto,
    };
    if (edicion.tipoMonto === 'fijo') payload.montoDefault = Number(edicion.montoDefault);
    const actualizado = await actualizarConceptoPersonal(concepto.id, payload);
    const idx = conceptos.value.findIndex((c) => c.id === concepto.id);
    conceptos.value[idx] = { ...conceptos.value[idx], ...actualizado };
    editandoId.value = null;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

async function onToggleActivo(concepto) {
  error.value = '';
  guardandoId.value = concepto.id;
  try {
    const actualizado = await actualizarConceptoPersonal(concepto.id, { activo: !concepto.activo });
    const idx = conceptos.value.findIndex((c) => c.id === concepto.id);
    conceptos.value[idx] = { ...conceptos.value[idx], activo: actualizado.activo };
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
    await eliminarConceptoPersonal(concepto.id);
    conceptos.value = conceptos.value.filter((c) => c.id !== concepto.id);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoId.value = null;
  }
}

function aplicaAPunto(concepto, puntoId) {
  return concepto.puntosCorte.some((cp) => cp.puntoCorteId === puntoId);
}

async function onTogglePunto(concepto, puntoId) {
  error.value = '';
  guardandoId.value = concepto.id;
  try {
    const aplicaTodos = concepto.puntosCorte.length === 0;
    const idsActuales = aplicaTodos
      ? puntosCorte.value.map((p) => p.id)
      : concepto.puntosCorte.map((cp) => cp.puntoCorteId);

    const nuevosIds = idsActuales.includes(puntoId)
      ? idsActuales.filter((id) => id !== puntoId)
      : [...idsActuales, puntoId];

    const payload = nuevosIds.length === puntosCorte.value.length ? [] : nuevosIds;

    const actualizado = await asignarPuntosCorteConcepto(concepto.id, payload);
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
    <p v-if="exito" class="text-sm text-positive bg-positive/10 border border-positive/20 rounded-xl px-3.5 py-2.5">
      {{ exito }}
    </p>

    <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>

    <template v-else>
      <div>
        <h3 class="text-base font-semibold text-ink-primary mb-5">Frecuencia de corte personal</h3>
        <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onGuardarFrecuencia">
          <div>
            <label class="label">Frecuencia</label>
            <select v-model="frecuenciaCortePersonal" class="field">
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          <div class="sm:col-span-2">
            <button type="submit" class="btn-primary" :disabled="guardandoFrecuencia">
              {{ guardandoFrecuencia ? 'Guardando…' : 'Guardar frecuencia' }}
            </button>
          </div>
        </form>
        <p class="text-xs text-ink-tertiary mt-3">
          Cambiar la frecuencia reemplaza tus puntos de corte actuales por los del nuevo ciclo. Es
          independiente de la frecuencia de corte del hogar.
        </p>
      </div>

      <div>
        <h3 class="text-base font-semibold text-ink-primary mb-5">Puntos de corte</h3>
        <div class="space-y-3">
          <div v-for="punto in puntosCorte" :key="punto.id">
            <FormField v-model="punto.referencia" :label="`Punto ${punto.orden}`" />
          </div>
        </div>
        <button type="button" class="btn-primary mt-5" :disabled="guardandoPuntos" @click="onGuardarPuntos">
          {{ guardandoPuntos ? 'Guardando…' : 'Guardar puntos de corte' }}
        </button>
      </div>

      <div>
        <h3 class="text-base font-semibold text-ink-primary mb-5">Nuevo concepto recurrente</h3>
        <form class="grid grid-cols-1 sm:grid-cols-3 gap-4" @submit.prevent="onCrearConcepto">
          <FormField v-model="nombre" label="Nombre" required placeholder="Netflix, Gimnasio…" />
          <FormField v-model="categoria" label="Categoría (opcional)" placeholder="Suscripciones…" />
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

      <div>
        <h3 class="text-base font-semibold text-ink-primary mb-5">Tus conceptos recurrentes</h3>

        <p v-if="!conceptos.length" class="text-sm text-ink-secondary">
          Aún no tienes conceptos recurrentes personales configurados.
        </p>

        <ul v-else class="divide-y divide-border">
          <li v-for="concepto in conceptos" :key="concepto.id" class="py-4">
            <div v-if="editandoId === concepto.id" class="space-y-3">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField v-model="edicion.nombre" label="Nombre" required />
                <FormField v-model="edicion.categoria" label="Categoría (opcional)" />
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
                  <span v-if="concepto.categoria" class="text-xs text-ink-tertiary font-normal">
                    ({{ concepto.categoria }})
                  </span>
                </p>
                <p class="text-sm text-ink-tertiary">
                  {{ concepto.tipoMonto === 'fijo' ? formatCurrency(concepto.montoDefault) : 'Monto variable' }}
                </p>
              </div>
              <div class="flex items-center gap-3 shrink-0">
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
                <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
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

            <div v-if="puntosCorte.length > 1" class="flex flex-wrap gap-4 mt-3">
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
    </template>
  </div>
</template>
