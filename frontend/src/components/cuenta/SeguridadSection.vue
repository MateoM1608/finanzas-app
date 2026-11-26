<script setup>
import { ref, computed } from 'vue';
import { api, extractErrorMessage } from '../../api/client.js';
import { confirmar } from '../../composables/useConfirm.js';
import AlertError from '../AlertError.vue';
import FormField from '../FormField.vue';
import CodigosRecuperacion from './CodigosRecuperacion.vue';

/**
 * Cuenta → Seguridad: cambiar la contraseña, los códigos de recuperación y
 * cerrar la sesión en los demás dispositivos.
 */

const actual = ref('');
const nueva = ref('');
const repetir = ref('');
const guardando = ref(false);
const errorPassword = ref('');
const okPassword = ref('');

const puedeGuardar = computed(() => actual.value && nueva.value.length >= 8 && nueva.value === repetir.value);

async function cambiarPassword() {
  errorPassword.value = '';
  okPassword.value = '';
  guardando.value = true;
  try {
    await api.post('/api/auth/cambiar-password', { actual: actual.value, nueva: nueva.value });
    actual.value = nueva.value = repetir.value = '';
    okPassword.value = 'Listo: cambiaste tu contraseña y cerramos tu sesión en los demás dispositivos.';
  } catch (e) {
    errorPassword.value = extractErrorMessage(e);
  } finally {
    guardando.value = false;
  }
}

const cerrando = ref(false);
const errorSesiones = ref('');
const okSesiones = ref('');

async function cerrarOtras() {
  const ok = await confirmar('¿Cerrar tu sesión en todos los demás navegadores y teléfonos? Aquí sigues conectado.', {
    textoAceptar: 'Cerrar las demás',
    peligroso: false,
  });
  if (!ok) return;
  errorSesiones.value = '';
  okSesiones.value = '';
  cerrando.value = true;
  try {
    await api.post('/api/auth/cerrar-otras-sesiones');
    okSesiones.value = 'Listo: las demás sesiones se cerraron.';
  } catch (e) {
    errorSesiones.value = extractErrorMessage(e);
  } finally {
    cerrando.value = false;
  }
}

</script>

<template>
  <div class="space-y-6">
    <section class="card card-pad">
      <h3 class="section-title">Cambiar contraseña</h3>
      <p class="section-hint mb-4">Al cambiarla se cierra tu sesión en los demás dispositivos.</p>
      <AlertError :message="errorPassword" class="mb-3" />
      <p v-if="okPassword" class="mb-3 rounded-lg bg-positive/10 px-3 py-2 text-[13px] font-medium text-positive">{{ okPassword }}</p>
      <form class="grid gap-4 sm:grid-cols-3" @submit.prevent="cambiarPassword">
        <FormField v-model="actual" type="password" label="Contraseña actual" autocomplete="current-password" required />
        <FormField v-model="nueva" type="password" label="Nueva (mínimo 8)" autocomplete="new-password" required />
        <FormField v-model="repetir" type="password" label="Repite la nueva" autocomplete="new-password" required />
        <p v-if="repetir && nueva !== repetir" class="text-[13px] font-medium text-negative sm:col-span-3">Las contraseñas nuevas no coinciden.</p>
        <div class="sm:col-span-3">
          <button type="submit" class="btn-primary" :disabled="guardando || !puedeGuardar">
            {{ guardando ? 'Guardando…' : 'Cambiar contraseña' }}
          </button>
        </div>
      </form>
    </section>

    <CodigosRecuperacion />

    <section class="card card-pad">
      <h3 class="section-title">Sesiones abiertas</h3>
      <p class="section-hint mb-4">
        Si perdiste un teléfono o entraste desde un computador ajeno, cierra la sesión en todos los demás dispositivos.
      </p>
      <AlertError :message="errorSesiones" class="mb-3" />
      <p v-if="okSesiones" class="mb-3 rounded-lg bg-positive/10 px-3 py-2 text-[13px] font-medium text-positive">{{ okSesiones }}</p>
      <button type="button" class="btn-secondary" :disabled="cerrando" @click="cerrarOtras">
        Cerrar sesión en los demás dispositivos
      </button>
    </section>

  </div>
</template>
