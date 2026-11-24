<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import {
  listarGastosVariables,
  crearGastoVariable,
  actualizarGastoVariable,
  eliminarGastoVariable,
} from '../../api/gastosVariables.js';
import { listarMiembros } from '../../api/hogares.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, formatDate, formatReparto } from '../../utils/format.js';
import FormField from '../FormField.vue';
import AlertError from '../AlertError.vue';
import AppModal from '../AppModal.vue';
import AppIcon from '../AppIcon.vue';

const gastos = ref([]);
const miembros = ref([]);
const loading = ref(true);
const error = ref('');
const eliminandoId = ref(null);
const mostrarForm = ref(false);

const item = ref('');
const valorTotal = ref('');
const pagoUsuarioId = ref('');
const fechaLimite = ref('');
const creando = ref(false);

const personalizarReparto = ref(false);
const repartoManual = reactive({}); // usuarioId -> string

const editandoRepartoId = ref(null);
const repartoEdicion = reactive({}); // usuarioId -> string
const guardandoRepartoId = ref(null);

function ordenar(lista) {
  return [...lista].sort((a, b) => new Date(a.fechaLimite) - new Date(b.fechaLimite));
}

// Solo presentación: insignia por estado del gasto.
const ESTADO_INFO = {
  pendiente: { label: 'Pendiente', clase: 'badge-warning' },
  incluido_en_corte: { label: 'En corte abierto', clase: 'badge-accent' },
  liquidado: { label: 'Liquidado', clase: 'badge-positive' },
};

function estadoInfo(gasto) {
  return ESTADO_INFO[gasto.estado] ?? null;
}

function esEditable(gasto) {
  return gasto.estado === 'pendiente';
}

function inicializarRepartoManual() {
  for (const m of miembros.value) {
    repartoManual[m.id] = repartoManual[m.id] ?? '';
  }
}

const sumaRepartoManual = computed(() =>
  miembros.value.reduce((acc, m) => acc + (Number(repartoManual[m.id]) || 0), 0),
);
const repartoManualValido = computed(
  () => Number(valorTotal.value) > 0 && sumaRepartoManual.value === Number(valorTotal.value),
);

async function cargar() {
  loading.value = true;
  try {
    const [listaGastos, listaMiembros] = await Promise.all([
      listarGastosVariables(),
      listarMiembros(),
    ]);
    gastos.value = ordenar(listaGastos);
    miembros.value = listaMiembros;
    inicializarRepartoManual();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onCrear() {
  error.value = '';
  creando.value = true;
  try {
    const payload = {
      item: item.value,
      valorTotal: Number(valorTotal.value),
      pagoUsuarioId: pagoUsuarioId.value,
      fechaLimite: fechaLimite.value,
    };
    if (personalizarReparto.value) {
      payload.repartos = miembros.value.map((m) => ({
        usuarioId: m.id,
        monto: Number(repartoManual[m.id]) || 0,
      }));
    }
    const nuevo = await crearGastoVariable(payload);
    gastos.value = ordenar([...gastos.value, nuevo]);
    item.value = '';
    valorTotal.value = '';
    pagoUsuarioId.value = '';
    fechaLimite.value = '';
    personalizarReparto.value = false;
    for (const m of miembros.value) repartoManual[m.id] = '';
    mostrarForm.value = false;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    creando.value = false;
  }
}

async function onCambiarPagador(gasto, usuarioId) {
  error.value = '';
  try {
    const actualizado = await actualizarGastoVariable(gasto.id, { pagoUsuarioId: usuarioId });
    const idx = gastos.value.findIndex((g) => g.id === gasto.id);
    gastos.value[idx] = actualizado;
  } catch (e) {
    error.value = extractErrorMessage(e);
  }
}

async function onEliminar(gasto) {
  error.value = '';
  eliminandoId.value = gasto.id;
  try {
    await eliminarGastoVariable(gasto.id);
    gastos.value = gastos.value.filter((g) => g.id !== gasto.id);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoId.value = null;
  }
}

function onIniciarEditarReparto(gasto) {
  error.value = '';
  const actuales = new Map(gasto.repartos.map((r) => [r.usuarioId, r.monto]));
  for (const m of miembros.value) {
    repartoEdicion[m.id] = actuales.get(m.id) ?? 0;
  }
  editandoRepartoId.value = gasto.id;
}

function onCancelarEditarReparto() {
  editandoRepartoId.value = null;
}

function sumaRepartoEdicion() {
  return miembros.value.reduce((acc, m) => acc + (Number(repartoEdicion[m.id]) || 0), 0);
}

async function onGuardarReparto(gasto) {
  error.value = '';
  guardandoRepartoId.value = gasto.id;
  try {
    const repartos = miembros.value.map((m) => ({
      usuarioId: m.id,
      monto: Number(repartoEdicion[m.id]) || 0,
    }));
    const actualizado = await actualizarGastoVariable(gasto.id, { repartos });
    const idx = gastos.value.findIndex((g) => g.id === gasto.id);
    gastos.value[idx] = actualizado;
    editandoRepartoId.value = null;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoRepartoId.value = null;
  }
}

onMounted(cargar);
</script>

<template>
  <section class="card card-pad" aria-labelledby="gastos-variables-titulo">
    <div class="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div class="min-w-0">
        <h3 id="gastos-variables-titulo" class="section-title">Gastos variables puntuales</h3>
        <p class="section-hint">Gastos únicos del hogar; entran al próximo corte según su fecha límite.</p>
      </div>
      <button class="btn-primary" @click="mostrarForm = true">
        <AppIcon name="plus" class="h-4 w-4" />
        Agregar gasto variable
      </button>
    </div>

    <AlertError :message="error" class="mb-4" />

    <AppModal v-if="mostrarForm" title="Agregar gasto variable" @close="mostrarForm = false">
      <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onCrear">
        <FormField v-model="item" label="Item" required placeholder="Creta, regalo…" />
        <FormField v-model="valorTotal" type="number" label="Valor total (COP)" required />
        <div>
          <label class="label" for="gasto-variable-pagador">Quién pagó</label>
          <select id="gasto-variable-pagador" v-model="pagoUsuarioId" class="field" required>
            <option value="" disabled>Selecciona</option>
            <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
        </div>
        <FormField v-model="fechaLimite" type="date" label="Fecha límite" required />

        <div class="sm:col-span-2">
          <label class="inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
            <input v-model="personalizarReparto" type="checkbox" class="checkbox" />
            Personalizar el reparto de este gasto
          </label>
        </div>

        <template v-if="personalizarReparto">
          <div v-for="m in miembros" :key="m.id">
            <FormField
              v-model="repartoManual[m.id]"
              type="number"
              :label="`Le toca a ${m.nombre} (COP)`"
            />
          </div>
          <p
            class="sm:col-span-2 flex items-center gap-2 text-[13px] font-medium rounded-lg px-3 py-2"
            :class="repartoManualValido ? 'text-positive bg-positive/10' : 'text-negative bg-negative/10'"
          >
            <AppIcon :name="repartoManualValido ? 'check' : 'alert'" class="h-4 w-4 shrink-0" />
            <span>
              Suma del reparto: {{ formatCurrency(sumaRepartoManual) }}
              <span v-if="valorTotal"> de {{ formatCurrency(Number(valorTotal)) }}</span>
            </span>
          </p>
        </template>

        <div class="sm:col-span-2 pt-1">
          <p v-if="!personalizarReparto" class="text-[13px] text-ink-tertiary mb-3">
            El reparto se calcula automáticamente según el reparto configurado en Configuración.
          </p>
          <button
            type="submit"
            class="btn-primary w-full sm:w-auto"
            :disabled="creando || (personalizarReparto && !repartoManualValido)"
          >
            {{ creando ? 'Agregando…' : 'Agregar gasto' }}
          </button>
        </div>
      </form>
    </AppModal>

    <p v-if="loading" class="text-sm text-ink-tertiary">Cargando…</p>
    <div v-else-if="!gastos.length" class="empty flex flex-col items-center gap-2">
      <AppIcon name="receipt" class="h-6 w-6" />
      No hay gastos variables pendientes.
    </div>

    <ul v-else class="list">
      <li v-for="gasto in gastos" :key="gasto.id" class="py-3.5">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0" :class="{ 'opacity-60': !esEditable(gasto) }">
            <p class="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-primary">
              <span class="break-words">{{ gasto.item }}</span>
              <span v-if="estadoInfo(gasto)" :class="estadoInfo(gasto).clase">
                {{ estadoInfo(gasto).label }}
              </span>
            </p>
            <p class="text-[13px] text-ink-tertiary mt-1">
              Vence {{ formatDate(gasto.fechaLimite) }} · Pagó {{ gasto.pagador.nombre }}
            </p>
          </div>
          <span
            class="shrink-0 text-right text-sm font-medium text-ink-primary"
            :class="{ 'opacity-60': !esEditable(gasto) }"
          >
            {{ formatCurrency(gasto.valorTotal) }}
          </span>
        </div>

        <div
          v-if="!esEditable(gasto) || editandoRepartoId !== gasto.id"
          class="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
        >
          <p class="min-w-0 text-[13px] text-ink-tertiary" :class="{ 'opacity-60': !esEditable(gasto) }">
            Reparto: {{ formatReparto(gasto.repartos) }}
          </p>
          <div v-if="esEditable(gasto)" class="flex items-center gap-1.5 ml-auto">
            <label :for="`pagador-${gasto.id}`" class="sr-only">Quién pagó {{ gasto.item }}</label>
            <select
              :id="`pagador-${gasto.id}`"
              class="field !w-auto !py-1.5 !pl-2.5 !pr-8 !text-[13px] !rounded-lg"
              :value="gasto.pagoUsuarioId"
              @change="onCambiarPagador(gasto, $event.target.value)"
            >
              <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
            </select>
            <button class="btn-ghost btn-sm" @click="onIniciarEditarReparto(gasto)">
              <AppIcon name="edit" class="h-3.5 w-3.5" />
              Editar reparto
            </button>
            <button
              class="btn-icon !p-1.5 hover:!text-negative hover:!bg-negative/10"
              :aria-label="`Eliminar ${gasto.item}`"
              title="Eliminar"
              :disabled="eliminandoId === gasto.id"
              @click="onEliminar(gasto)"
            >
              <AppIcon name="trash" class="h-4 w-4" />
            </button>
          </div>
        </div>

        <div v-else class="panel-sunken mt-3 p-4 space-y-3">
          <p class="text-[13px] font-medium text-ink-secondary">Reparto de este gasto</p>
          <div v-for="m in miembros" :key="m.id" class="flex items-center justify-between gap-4">
            <label :for="`reparto-${gasto.id}-${m.id}`" class="text-sm text-ink-primary truncate">{{ m.nombre }}</label>
            <input
              :id="`reparto-${gasto.id}-${m.id}`"
              v-model="repartoEdicion[m.id]"
              type="number"
              inputmode="numeric"
              class="field !w-36 text-right"
            />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
            <span
              class="text-[13px] font-medium"
              :class="sumaRepartoEdicion() === gasto.valorTotal ? 'text-positive' : 'text-negative'"
            >
              Suma: {{ formatCurrency(sumaRepartoEdicion()) }} de {{ formatCurrency(gasto.valorTotal) }}
            </span>
            <div class="flex gap-2 ml-auto">
              <button class="btn-ghost btn-sm" @click="onCancelarEditarReparto">
                Cancelar
              </button>
              <button
                class="btn-primary btn-sm"
                :disabled="guardandoRepartoId === gasto.id || sumaRepartoEdicion() !== gasto.valorTotal"
                @click="onGuardarReparto(gasto)"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>
