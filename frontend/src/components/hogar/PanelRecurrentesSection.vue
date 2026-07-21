<script setup>
import { ref, onMounted } from 'vue';
import { obtenerPeriodoActual, actualizarInstancia } from '../../api/gastosRecurrentes.js';
import { listarMiembros } from '../../api/hogares.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import AlertError from '../AlertError.vue';

const periodo = ref(null);
const miembros = ref([]);
const loading = ref(true);
const error = ref('');
const guardandoId = ref(null);
const montosLocales = ref({});

async function cargar() {
  loading.value = true;
  try {
    const [p, m] = await Promise.all([obtenerPeriodoActual(), listarMiembros()]);
    periodo.value = p;
    miembros.value = m;
    for (const { instancia } of p.instancias) {
      montosLocales.value[instancia.id] = instancia.monto ?? '';
    }
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

function actualizarEnMemoria(instanciaId, actualizada) {
  const item = periodo.value.instancias.find((i) => i.instancia.id === instanciaId);
  if (item) item.instancia = actualizada;
}

async function onGuardarMonto(instancia) {
  const nuevoMonto = Number(montosLocales.value[instancia.id]);
  if (!nuevoMonto || nuevoMonto === instancia.monto) return;
  error.value = '';
  guardandoId.value = instancia.id;
  try {
    const actualizada = await actualizarInstancia(instancia.id, { monto: nuevoMonto });
    actualizarEnMemoria(instancia.id, actualizada);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

async function onCambiarPagador(instancia, usuarioId) {
  error.value = '';
  guardandoId.value = instancia.id;
  try {
    const actualizada = await actualizarInstancia(instancia.id, { pagoUsuarioId: usuarioId || null });
    actualizarEnMemoria(instancia.id, actualizada);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

onMounted(cargar);
</script>

<template>
  <div class="card p-6 sm:p-8">
    <h3 class="text-base font-semibold text-ink-primary">Gastos recurrentes</h3>
    <p v-if="periodo" class="text-sm text-ink-secondary mb-5">
      Período {{ formatDate(periodo.periodoInicio) }} – {{ formatDate(periodo.fechaNominal) }}
    </p>

    <AlertError :message="error" />

    <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>
    <p v-else-if="!periodo.instancias.length" class="text-sm text-ink-secondary">
      No hay conceptos recurrentes activos para este período.
    </p>

    <ul v-else class="divide-y divide-border">
      <li v-for="{ concepto, instancia } in periodo.instancias" :key="instancia.id" class="py-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-ink-primary font-medium">{{ concepto.nombre }}</p>
            <p class="text-xs text-ink-tertiary">
              {{ concepto.tipoMonto === 'fijo' ? 'Monto fijo' : 'Monto variable' }}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <input
              v-model="montosLocales[instancia.id]"
              type="number"
              class="field w-32 text-right"
              placeholder="Monto"
              :disabled="guardandoId === instancia.id"
              @change="onGuardarMonto(instancia)"
            />
            <select
              class="field !w-auto text-sm"
              :value="instancia.pagoUsuarioId ?? ''"
              :disabled="guardandoId === instancia.id"
              @change="onCambiarPagador(instancia, $event.target.value)"
            >
              <option value="">¿Quién pagó?</option>
              <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
            </select>
          </div>
        </div>

        <p v-if="instancia.repartos.length" class="text-sm text-ink-tertiary mt-2">
          Reparto:
          {{ instancia.repartos.map((r) => `${r.usuario.nombre} ${formatCurrency(r.monto)}`).join(' · ') }}
        </p>
      </li>
    </ul>
  </div>
</template>
