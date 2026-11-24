<script setup>
import { ref, onMounted } from 'vue';
import { obtenerHogarActual, actualizarHogar, actualizarPuntosCorte } from '../../api/hogares.js';
import { extractErrorMessage } from '../../api/client.js';
import FormField from '../FormField.vue';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';

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
    <p
      v-if="exito"
      role="status"
      class="flex items-start gap-2.5 rounded-xl border border-positive/20 bg-positive/10 px-3.5 py-2.5 text-sm text-positive"
    >
      <AppIcon name="check" class="mt-0.5 h-4 w-4 shrink-0" />
      <span>{{ exito }}</span>
    </p>

    <div v-if="loading" class="card card-pad">
      <p class="empty">Cargando…</p>
    </div>

    <template v-else>
      <section class="card card-pad">
        <header class="mb-5">
          <h3 class="section-title">Datos del hogar</h3>
          <p class="section-hint">Nombre visible para los miembros y cada cuánto se liquidan los gastos compartidos.</p>
        </header>

        <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="onGuardarHogar">
          <FormField v-model="nombre" label="Nombre del hogar" required :disabled="!canEdit" />
          <div>
            <label class="label" for="hogar-frecuencia">Frecuencia de corte</label>
            <select id="hogar-frecuencia" v-model="frecuenciaCorte" class="field" :disabled="!canEdit">
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>

          <div class="panel-sunken flex items-start gap-2.5 px-3.5 py-3 text-[13px] text-ink-secondary sm:col-span-2">
            <AppIcon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-ink-tertiary" />
            <span>Cambiar la frecuencia reemplaza los puntos de corte actuales por los del nuevo ciclo.</span>
          </div>

          <div class="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-end">
            <p v-if="!canEdit" class="flex items-center gap-2 text-[13px] text-ink-tertiary sm:mr-auto">
              <AppIcon name="info" class="h-4 w-4 shrink-0" />
              No tienes permiso para editar esta sección.
            </p>
            <button v-if="canEdit" type="submit" class="btn-primary" :disabled="guardandoHogar">
              {{ guardandoHogar ? 'Guardando…' : 'Guardar cambios' }}
            </button>
          </div>
        </form>
      </section>

      <section class="card card-pad">
        <header class="mb-5 flex items-start gap-3">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
            <AppIcon name="calendar" class="h-[18px] w-[18px]" />
          </span>
          <div>
            <h3 class="section-title">Puntos de corte</h3>
            <p class="section-hint">Días del ciclo en los que se cierra un corte. Ajusta la referencia de cada uno.</p>
          </div>
        </header>

        <p v-if="!puntosCorte.length" class="empty">No hay puntos de corte configurados.</p>

        <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div v-for="punto in puntosCorte" :key="punto.id">
            <FormField v-model="punto.referencia" :label="`Punto ${punto.orden}`" :disabled="!canEdit" />
          </div>
        </div>

        <div v-if="canEdit" class="mt-5 flex justify-end border-t border-border pt-5">
          <button type="button" class="btn-primary" :disabled="guardandoPuntos" @click="onGuardarPuntos">
            {{ guardandoPuntos ? 'Guardando…' : 'Guardar puntos de corte' }}
          </button>
        </div>
      </section>
    </template>
  </div>
</template>
