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
import { formatCurrency, formatDate } from '../../utils/format.js';
import FormField from '../FormField.vue';
import AlertError from '../AlertError.vue';
import AppModal from '../AppModal.vue';

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

const ESTADO_INFO = {
  incluido_en_corte: { label: 'En corte abierto', clase: 'bg-accent-muted text-accent' },
  liquidado: { label: 'Liquidado', clase: 'bg-surface-raised text-ink-tertiary' },
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
  <div class="card p-6 sm:p-8">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <h3 class="text-base font-semibold text-ink-primary">Gastos variables puntuales</h3>
      <button class="btn-primary" @click="mostrarForm = true">Agregar gasto variable</button>
    </div>

    <AlertError :message="error" />

    <AppModal v-if="mostrarForm" title="Agregar gasto variable" @close="mostrarForm = false">
      <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onCrear">
        <FormField v-model="item" label="Item" required placeholder="Creta, regalo…" />
        <FormField v-model="valorTotal" type="number" label="Valor total (COP)" required />
        <div>
          <label class="label">Quién pagó</label>
          <select v-model="pagoUsuarioId" class="field" required>
            <option value="" disabled>Selecciona</option>
            <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
        </div>
        <FormField v-model="fechaLimite" type="date" label="Fecha límite" required />

        <div class="sm:col-span-2">
          <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
            <input v-model="personalizarReparto" type="checkbox" />
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
            class="sm:col-span-2 text-sm"
            :class="repartoManualValido ? 'text-positive' : 'text-negative'"
          >
            Suma del reparto: {{ formatCurrency(sumaRepartoManual) }}
            <span v-if="valorTotal"> de {{ formatCurrency(Number(valorTotal)) }}</span>
          </p>
        </template>

        <div class="sm:col-span-2">
          <button
            type="submit"
            class="btn-primary"
            :disabled="creando || (personalizarReparto && !repartoManualValido)"
          >
            {{ creando ? 'Agregando…' : 'Agregar gasto' }}
          </button>
          <p v-if="!personalizarReparto" class="text-xs text-ink-tertiary mt-2">
            El reparto se calcula automáticamente según el split configurado en Settings.
          </p>
        </div>
      </form>
    </AppModal>

    <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>
    <p v-else-if="!gastos.length" class="text-sm text-ink-secondary">No hay gastos variables pendientes.</p>

    <ul v-else class="divide-y divide-border">
      <li
        v-for="gasto in gastos"
        :key="gasto.id"
        class="py-4 group"
        :class="{ 'opacity-50': !esEditable(gasto) }"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-ink-primary font-medium flex items-center gap-2">
              {{ gasto.item }}
              <span
                v-if="estadoInfo(gasto)"
                class="text-xs font-semibold uppercase px-2 py-0.5 rounded-full"
                :class="estadoInfo(gasto).clase"
              >
                {{ estadoInfo(gasto).label }}
              </span>
            </p>
            <p class="text-sm text-ink-tertiary">Vence {{ formatDate(gasto.fechaLimite) }}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-ink-primary font-medium">{{ formatCurrency(gasto.valorTotal) }}</span>
            <select
              v-if="esEditable(gasto)"
              class="field !w-auto text-sm"
              :value="gasto.pagoUsuarioId"
              @change="onCambiarPagador(gasto, $event.target.value)"
            >
              <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
            </select>
            <span v-else class="text-sm text-ink-tertiary">{{ gasto.pagador.nombre }}</span>
            <button
              v-if="esEditable(gasto)"
              class="text-sm text-ink-tertiary hover:text-negative transition-colors opacity-0 group-hover:opacity-100"
              :disabled="eliminandoId === gasto.id"
              @click="onEliminar(gasto)"
            >
              Eliminar
            </button>
          </div>
        </div>

        <div v-if="!esEditable(gasto) || editandoRepartoId !== gasto.id" class="flex items-center justify-between mt-2">
          <p class="text-sm text-ink-tertiary">
            Pagó {{ gasto.pagador.nombre }} · Reparto:
            {{ gasto.repartos.map((r) => `${r.usuario.nombre} ${formatCurrency(r.monto)}`).join(' · ') }}
          </p>
          <button
            v-if="esEditable(gasto)"
            class="text-sm text-accent hover:text-accent-hover shrink-0"
            @click="onIniciarEditarReparto(gasto)"
          >
            Editar reparto
          </button>
        </div>

        <div v-else class="mt-3 p-4 bg-surface-raised rounded-xl space-y-3">
          <div v-for="m in miembros" :key="m.id" class="flex items-center justify-between gap-4">
            <span class="text-sm text-ink-secondary">{{ m.nombre }}</span>
            <input
              v-model="repartoEdicion[m.id]"
              type="number"
              class="field w-32 text-right"
            />
          </div>
          <div class="flex items-center justify-between pt-1">
            <span
              class="text-sm"
              :class="sumaRepartoEdicion() === gasto.valorTotal ? 'text-positive' : 'text-negative'"
            >
              Suma: {{ formatCurrency(sumaRepartoEdicion()) }} de {{ formatCurrency(gasto.valorTotal) }}
            </span>
            <div class="flex gap-2">
              <button class="btn-ghost !px-3 !py-1.5 text-sm" @click="onCancelarEditarReparto">
                Cancelar
              </button>
              <button
                class="btn-primary !px-3 !py-1.5 text-sm"
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
  </div>
</template>
