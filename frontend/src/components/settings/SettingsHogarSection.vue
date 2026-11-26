<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth.js';
import { salirDelHogar } from '../../api/hogares.js';
import { confirmar } from '../../composables/useConfirm.js';
import { obtenerHogarActual, actualizarHogar } from '../../api/hogares.js';
import { extractErrorMessage } from '../../api/client.js';
import FormField from '../FormField.vue';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';

defineProps({
  canEdit: { type: Boolean, default: false },
});

const nombre = ref('');
const loading = ref(true);
const guardando = ref(false);
const error = ref('');
const exito = ref('');

async function cargar() {
  loading.value = true;
  try {
    const { hogar } = await obtenerHogarActual();
    nombre.value = hogar.nombre;
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
    await actualizarHogar({ nombre: nombre.value });
    exito.value = 'Cambios guardados';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardando.value = false;
  }
}

onMounted(cargar);

const auth = useAuthStore();
const router = useRouter();
const saliendo = ref(false);
const errorSalir = ref('');

async function salir() {
  const ok = await confirmar(
    '¿Salir del hogar? Dejarás de ver todo lo del hogar: gastos, cuadres, metas, préstamos e inversiones. Tu panel personal sigue igual. Para volver necesitarás un código de invitación nuevo.',
    { textoAceptar: 'Salir del hogar', peligroso: true },
  );
  if (!ok) return;
  errorSalir.value = '';
  saliendo.value = true;
  try {
    await salirDelHogar();
    await auth.fetchMe();
    router.push({ name: 'onboarding' });
  } catch (e) {
    errorSalir.value = extractErrorMessage(e);
  } finally {
    saliendo.value = false;
  }
}
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

    <section v-else class="card card-pad">
      <header class="mb-5">
        <h3 class="section-title">Datos del hogar</h3>
        <p class="section-hint">Nombre visible para los miembros.</p>
      </header>

      <form class="space-y-4" @submit.prevent="onGuardar">
        <FormField v-model="nombre" label="Nombre del hogar" required :disabled="!canEdit" />

        <div class="panel-sunken flex items-start gap-2.5 px-3.5 py-3 text-[13px] text-ink-secondary">
          <AppIcon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-ink-tertiary" />
          <span>
            El hogar no tiene fechas fijas de corte: cada cuenta fija tiene su propio día de pago, y las cuentas
            se cuadran cuando ustedes quieran desde <strong class="font-medium text-ink-primary">Cuadres</strong>.
          </span>
        </div>

        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <p v-if="!canEdit" class="flex items-center gap-2 text-[13px] text-ink-tertiary sm:mr-auto">
            <AppIcon name="info" class="h-4 w-4 shrink-0" />
            No tienes permiso para editar esta sección.
          </p>
          <button v-if="canEdit" type="submit" class="btn-primary" :disabled="guardando">
            {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
    </section>
    <section class="card card-pad">
      <h3 class="section-title">Salir del hogar</h3>
      <p class="section-hint mb-4">
        Se puede cuando no tienes nada del hogar sin cuadrar (gastos, cuotas o compras que pagaste o que te tocan) y no hay
        un cuadre en curso.
        <template v-if="auth.usuario?.esAdmin"> Como eres el administrador, primero pásale la administración a otro miembro en la pestaña Miembros.</template>
      </p>
      <AlertError :message="errorSalir" class="mb-3" />
      <button type="button" class="btn-secondary !text-negative" :disabled="saliendo" @click="salir">Salir del hogar</button>
    </section>
  </div>
</template>
