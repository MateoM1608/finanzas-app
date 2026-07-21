<script setup>
import { ref, onMounted } from 'vue';
import { obtenerHogarActual, actualizarHogar, actualizarPuntosCorte } from '../../api/hogares.js';
import { extractErrorMessage } from '../../api/client.js';
import FormField from '../FormField.vue';
import AlertError from '../AlertError.vue';

const props = defineProps({
  canEdit: { type: Boolean, default: false },
});

const nombre = ref('');
const frecuenciaCorte = ref('mensual');
const puntosCorte = ref([]);
const loading = ref(true);
const guardandoHogar = ref(false);
const guardandoPuntos = ref(false);
const error = ref('');
const exito = ref('');

async function cargar() {
  loading.value = true;
  try {
    const { hogar, puntosCorte: puntos } = await obtenerHogarActual();
    nombre.value = hogar.nombre;
    frecuenciaCorte.value = hogar.frecuenciaCorte;
    puntosCorte.value = puntos.map((p) => ({ ...p }));
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onGuardarHogar() {
  error.value = '';
  exito.value = '';
  guardandoHogar.value = true;
  try {
    const { puntosCorte: puntos } = await actualizarHogar({
      nombre: nombre.value,
      frecuenciaCorte: frecuenciaCorte.value,
    });
    puntosCorte.value = puntos.map((p) => ({ ...p }));
    exito.value = 'Cambios guardados';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoHogar.value = false;
  }
}

async function onGuardarPuntos() {
  error.value = '';
  exito.value = '';
  guardandoPuntos.value = true;
  try {
    const puntos = await actualizarPuntosCorte(
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
      <div class="card p-6 sm:p-8">
        <h3 class="text-base font-semibold text-ink-primary mb-5">Datos del hogar</h3>
        <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onGuardarHogar">
          <FormField v-model="nombre" label="Nombre del hogar" required :disabled="!canEdit" />
          <div>
            <label class="label">Frecuencia de corte</label>
            <select v-model="frecuenciaCorte" class="field" :disabled="!canEdit">
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          <div class="sm:col-span-2">
            <button v-if="canEdit" type="submit" class="btn-primary" :disabled="guardandoHogar">
              {{ guardandoHogar ? 'Guardando…' : 'Guardar cambios' }}
            </button>
            <p v-else class="text-sm text-ink-tertiary">
              No tienes permiso para editar esta sección.
            </p>
          </div>
        </form>
        <p class="text-xs text-ink-tertiary mt-3">
          Cambiar la frecuencia reemplaza los puntos de corte actuales por los del nuevo ciclo.
        </p>
      </div>

      <div class="card p-6 sm:p-8">
        <h3 class="text-base font-semibold text-ink-primary mb-5">Puntos de corte</h3>
        <div class="space-y-3">
          <div v-for="punto in puntosCorte" :key="punto.id">
            <FormField v-model="punto.referencia" :label="`Punto ${punto.orden}`" :disabled="!canEdit" />
          </div>
        </div>
        <button
          v-if="canEdit"
          type="button"
          class="btn-primary mt-5"
          :disabled="guardandoPuntos"
          @click="onGuardarPuntos"
        >
          {{ guardandoPuntos ? 'Guardando…' : 'Guardar puntos de corte' }}
        </button>
      </div>
    </template>
  </div>
</template>
