<script setup>
import { ref, onMounted } from 'vue';
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

const gastos = ref([]);
const miembros = ref([]);
const loading = ref(true);
const error = ref('');
const eliminandoId = ref(null);

const item = ref('');
const valorTotal = ref('');
const pagoUsuarioId = ref('');
const fechaLimite = ref('');
const creando = ref(false);

function ordenar(lista) {
  return [...lista].sort((a, b) => new Date(a.fechaLimite) - new Date(b.fechaLimite));
}

async function cargar() {
  loading.value = true;
  try {
    const [listaGastos, listaMiembros] = await Promise.all([
      listarGastosVariables(),
      listarMiembros(),
    ]);
    gastos.value = ordenar(listaGastos);
    miembros.value = listaMiembros;
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
    const nuevo = await crearGastoVariable({
      item: item.value,
      valorTotal: Number(valorTotal.value),
      pagoUsuarioId: pagoUsuarioId.value,
      fechaLimite: fechaLimite.value,
    });
    gastos.value = ordenar([...gastos.value, nuevo]);
    item.value = '';
    valorTotal.value = '';
    pagoUsuarioId.value = '';
    fechaLimite.value = '';
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

onMounted(cargar);
</script>

<template>
  <div class="card p-6 sm:p-8">
    <h3 class="text-base font-semibold text-ink-primary mb-5">Gastos variables puntuales</h3>

    <AlertError :message="error" />

    <form class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 mt-4" @submit.prevent="onCrear">
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
        <button type="submit" class="btn-primary" :disabled="creando">
          {{ creando ? 'Agregando…' : 'Agregar gasto' }}
        </button>
        <p class="text-xs text-ink-tertiary mt-2">
          El reparto se calcula automáticamente según el split configurado en Settings.
        </p>
      </div>
    </form>

    <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>
    <p v-else-if="!gastos.length" class="text-sm text-ink-secondary">No hay gastos variables pendientes.</p>

    <ul v-else class="divide-y divide-border">
      <li v-for="gasto in gastos" :key="gasto.id" class="py-4 group">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-ink-primary font-medium">{{ gasto.item }}</p>
            <p class="text-sm text-ink-tertiary">Vence {{ formatDate(gasto.fechaLimite) }}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-ink-primary font-medium">{{ formatCurrency(gasto.valorTotal) }}</span>
            <select
              class="field !w-auto text-sm"
              :value="gasto.pagoUsuarioId"
              @change="onCambiarPagador(gasto, $event.target.value)"
            >
              <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
            </select>
            <button
              class="text-sm text-ink-tertiary hover:text-negative transition-colors opacity-0 group-hover:opacity-100"
              :disabled="eliminandoId === gasto.id"
              @click="onEliminar(gasto)"
            >
              Eliminar
            </button>
          </div>
        </div>
        <p class="text-sm text-ink-tertiary mt-2">
          Pagó {{ gasto.pagador.nombre }} · Reparto:
          {{ gasto.repartos.map((r) => `${r.usuario.nombre} ${formatCurrency(r.monto)}`).join(' · ') }}
        </p>
      </li>
    </ul>
  </div>
</template>
