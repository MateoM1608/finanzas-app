<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { listarMiembros } from '../../api/hogares.js';
import { obtenerSplit, actualizarSplit } from '../../api/splitPorcentaje.js';
import { extractErrorMessage } from '../../api/client.js';
import AlertError from '../AlertError.vue';

const props = defineProps({
  canEdit: { type: Boolean, default: false },
});

const contextos = [
  { id: 'general', label: 'General del hogar' },
  { id: 'gastos_variables', label: 'Gastos variables puntuales' },
];
const contextoActivo = ref('general');

const miembros = ref([]);
const filas = ref([]); // [{ usuarioId, nombre, porcentaje }]
const usandoFallbackGeneral = ref(false);
const loading = ref(true);
const guardando = ref(false);
const error = ref('');
const exito = ref('');

const suma = computed(() =>
  filas.value.reduce((acc, f) => acc + (Number(f.porcentaje) || 0), 0),
);
const sumaValida = computed(() => Math.abs(suma.value - 100) < 0.01);

async function cargar() {
  loading.value = true;
  error.value = '';
  exito.value = '';
  usandoFallbackGeneral.value = false;
  try {
    if (!miembros.value.length) {
      miembros.value = await listarMiembros();
    }

    let split = await obtenerSplit(contextoActivo.value);

    if (!split.length && contextoActivo.value === 'gastos_variables') {
      split = await obtenerSplit('general');
      usandoFallbackGeneral.value = true;
    }

    const splitPorUsuario = new Map(split.map((s) => [s.usuarioId, s.porcentaje]));
    filas.value = miembros.value.map((m) => ({
      usuarioId: m.id,
      nombre: m.nombre,
      porcentaje: splitPorUsuario.get(m.id) ?? 0,
    }));
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onGuardar() {
  error.value = '';
  exito.value = '';
  guardando.value = true;
  try {
    await actualizarSplit(
      filas.value.map((f) => ({ usuarioId: f.usuarioId, porcentaje: Number(f.porcentaje) })),
      contextoActivo.value,
    );
    usandoFallbackGeneral.value = false;
    exito.value = 'Split actualizado';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardando.value = false;
  }
}

watch(contextoActivo, cargar);
onMounted(cargar);
</script>

<template>
  <div class="card p-6 sm:p-8 space-y-6">
    <div>
      <h3 class="text-base font-semibold text-ink-primary mb-1">Split de gastos compartidos</h3>
      <p class="text-sm text-ink-secondary">Debe sumar 100% entre todos los miembros.</p>
    </div>

    <div class="flex gap-1 bg-surface-raised rounded-xl p-1">
      <button
        v-for="c in contextos"
        :key="c.id"
        type="button"
        class="flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        :class="contextoActivo === c.id ? 'bg-accent text-white' : 'text-ink-secondary hover:text-ink-primary'"
        @click="contextoActivo = c.id"
      >
        {{ c.label }}
      </button>
    </div>

    <p v-if="contextoActivo === 'gastos_variables'" class="text-sm text-ink-tertiary -mt-2">
      Este split solo aplica a gastos variables puntuales. Si no lo configuras, se usa el split
      general del hogar.
    </p>

    <AlertError :message="error" />
    <p v-if="exito" class="text-sm text-positive bg-positive/10 border border-positive/20 rounded-xl px-3.5 py-2.5">
      {{ exito }}
    </p>
    <p
      v-if="usandoFallbackGeneral && !loading"
      class="text-sm text-accent bg-accent-muted border border-accent/20 rounded-xl px-3.5 py-2.5"
    >
      Todavía no tienes un split propio para gastos variables — estos valores son los del split
      general. Guárdalos (o edítalos) para dejar uno independiente.
    </p>

    <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>

    <template v-else>
      <div class="space-y-4">
        <div v-for="fila in filas" :key="fila.usuarioId" class="flex items-center justify-between gap-4">
          <span class="text-ink-primary">{{ fila.nombre }}</span>
          <div class="flex items-center gap-2">
            <input
              v-model="fila.porcentaje"
              type="number"
              step="0.1"
              min="0"
              max="100"
              class="field w-28 text-right"
              :disabled="!canEdit"
            />
            <span class="text-ink-secondary">%</span>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-border">
        <span class="text-sm" :class="sumaValida ? 'text-positive' : 'text-negative'">
          Suma: {{ suma.toFixed(1) }}%
        </span>
        <button
          v-if="canEdit"
          class="btn-primary"
          :disabled="guardando || !sumaValida"
          @click="onGuardar"
        >
          {{ guardando ? 'Guardando…' : 'Guardar split' }}
        </button>
      </div>
    </template>
  </div>
</template>
