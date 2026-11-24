<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { listarMiembros } from '../../api/hogares.js';
import { obtenerSplit, actualizarSplit } from '../../api/splitPorcentaje.js';
import { extractErrorMessage } from '../../api/client.js';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';

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
    exito.value = 'Reparto actualizado';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardando.value = false;
  }
}

watch(contextoActivo, cargar);
onMounted(cargar);

// Iniciales para el avatar (solo presentación).
function iniciales(nombre = '') {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}
</script>

<template>
  <section class="card card-pad space-y-6">
    <header class="flex items-start gap-3">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
        <AppIcon name="sliders" class="h-[18px] w-[18px]" />
      </span>
      <div>
        <h3 class="section-title">Reparto de gastos compartidos</h3>
        <p class="section-hint">Qué porcentaje asume cada miembro. Debe sumar 100%.</p>
      </div>
    </header>

    <div class="tabs w-full sm:w-auto" role="tablist" aria-label="Contexto del reparto">
      <button
        v-for="c in contextos"
        :key="c.id"
        type="button"
        role="tab"
        class="tab flex-1 sm:flex-none"
        :class="contextoActivo === c.id ? 'tab-active' : ''"
        :aria-selected="contextoActivo === c.id"
        @click="contextoActivo = c.id"
      >
        {{ c.label }}
      </button>
    </div>

    <p
      v-if="contextoActivo === 'gastos_variables'"
      class="-mt-2 flex items-start gap-2 text-[13px] text-ink-tertiary"
    >
      <AppIcon name="info" class="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Este reparto solo aplica a gastos variables puntuales. Si no lo configuras, se usa el reparto
        general del hogar.
      </span>
    </p>

    <AlertError :message="error" />
    <p
      v-if="exito"
      role="status"
      class="flex items-start gap-2.5 rounded-xl border border-positive/20 bg-positive/10 px-3.5 py-2.5 text-sm text-positive"
    >
      <AppIcon name="check" class="mt-0.5 h-4 w-4 shrink-0" />
      <span>{{ exito }}</span>
    </p>
    <p
      v-if="usandoFallbackGeneral && !loading"
      class="flex items-start gap-2.5 rounded-xl border border-accent/20 bg-accent/10 px-3.5 py-2.5 text-sm text-accent"
    >
      <AppIcon name="info" class="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Todavía no tienes un reparto propio para gastos variables: estos valores son los del reparto
        general. Guárdalos (o edítalos) para dejar uno independiente.
      </span>
    </p>

    <p v-if="loading" class="empty">Cargando…</p>

    <template v-else>
      <p v-if="!filas.length" class="empty">No hay miembros en el hogar.</p>

      <ul v-else class="space-y-5">
        <li v-for="fila in filas" :key="fila.usuarioId">
          <div class="flex items-center gap-3">
            <span
              class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-sunken text-xs font-semibold text-ink-secondary"
              aria-hidden="true"
            >
              {{ iniciales(fila.nombre) }}
            </span>
            <label :for="`split-${fila.usuarioId}`" class="min-w-0 flex-1 truncate text-sm font-medium text-ink-primary">
              {{ fila.nombre }}
            </label>
            <div class="relative shrink-0">
              <input
                :id="`split-${fila.usuarioId}`"
                v-model="fila.porcentaje"
                type="number"
                inputmode="decimal"
                step="0.1"
                min="0"
                max="100"
                class="field w-24 pr-8 text-right sm:w-28"
                :disabled="!canEdit"
              />
              <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-tertiary">
                %
              </span>
            </div>
          </div>
          <div class="ml-12 mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
            <div
              class="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
              :style="{ width: `${Math.min(Math.max(Number(fila.porcentaje) || 0, 0), 100)}%` }"
            />
          </div>
        </li>
      </ul>

      <div class="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-3">
          <span
            class="grid h-8 w-8 shrink-0 place-items-center rounded-full"
            :class="sumaValida ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'"
            aria-hidden="true"
          >
            <AppIcon :name="sumaValida ? 'check' : 'alert'" class="h-4 w-4" />
          </span>
          <div aria-live="polite">
            <p class="text-sm font-semibold" :class="sumaValida ? 'text-positive' : 'text-negative'">
              Total: {{ suma.toFixed(1) }}%
            </p>
            <p class="text-[13px] text-ink-tertiary">
              {{
                sumaValida
                  ? 'El reparto está completo.'
                  : suma > 100
                    ? `Sobra ${(suma - 100).toFixed(1)}% por encima del 100%.`
                    : `Falta ${(100 - suma).toFixed(1)}% para llegar a 100%.`
              }}
            </p>
          </div>
        </div>
        <button
          v-if="canEdit"
          type="button"
          class="btn-primary"
          :disabled="guardando || !sumaValida"
          @click="onGuardar"
        >
          {{ guardando ? 'Guardando…' : 'Guardar reparto' }}
        </button>
      </div>
    </template>
  </section>
</template>
