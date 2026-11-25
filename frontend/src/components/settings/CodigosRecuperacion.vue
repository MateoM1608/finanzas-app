<script setup>
import { ref, onMounted } from 'vue';
import { api, extractErrorMessage } from '../../api/client.js';
import { formatDate } from '../../utils/format.js';
import { confirmar } from '../../composables/useConfirm.js';
import AlertError from '../AlertError.vue';
import FormField from '../FormField.vue';

/**
 * Códigos de recuperación: 8 de un solo uso para cambiar la contraseña sin
 * haber iniciado sesión ("¿Olvidaste tu contraseña?"). Se muestran una sola
 * vez; generar unos nuevos invalida los anteriores.
 */
const estado = ref(null);
const password = ref('');
const codigos = ref([]);
const generando = ref(false);
const error = ref('');
const copiado = ref(false);

async function cargar() {
  try {
    estado.value = (await api.get('/api/auth/codigos-recuperacion')).data;
  } catch (e) {
    error.value = extractErrorMessage(e);
  }
}
onMounted(cargar);

async function generar() {
  if (estado.value?.total) {
    const ok = await confirmar('¿Generar códigos nuevos? Los que tienes ahora dejarán de servir.', {
      textoAceptar: 'Generar nuevos',
      peligroso: false,
    });
    if (!ok) return;
  }
  error.value = '';
  generando.value = true;
  try {
    codigos.value = (await api.post('/api/auth/codigos-recuperacion', { password: password.value })).data.codigos;
    password.value = '';
    await cargar();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    generando.value = false;
  }
}

function texto() {
  return `Códigos de recuperación de Finanzas (cada uno sirve una sola vez):\n\n${codigos.value.join('\n')}\n\nÚsalos en "¿Olvidaste tu contraseña?" de la pantalla de inicio de sesión.\n`;
}

async function copiar() {
  try {
    await navigator.clipboard.writeText(texto());
    copiado.value = true;
    setTimeout(() => (copiado.value = false), 2000);
  } catch {
    error.value = 'No se pudieron copiar: anótalos o descárgalos.';
  }
}

function descargar() {
  const url = URL.createObjectURL(new Blob([texto()], { type: 'text/plain;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'codigos-recuperacion-finanzas.txt' });
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <section class="card card-pad">
    <h3 class="section-title">Códigos de recuperación</h3>
    <p class="section-hint mb-4">
      Sirven para cambiar tu contraseña si la olvidas («¿Olvidaste tu contraseña?» al iniciar sesión). Guárdalos fuera
      de la app: en tu gestor de contraseñas, en papel o en una foto privada.
    </p>
    <AlertError :message="error" class="mb-3" />

    <div v-if="codigos.length" class="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-4">
      <p class="mb-3 text-[13px] font-medium text-warning">Guárdalos ahora: no se vuelven a mostrar.</p>
      <ul class="grid grid-cols-2 gap-2 font-mono text-[15px] tracking-wider text-ink-primary">
        <li v-for="c in codigos" :key="c" class="rounded-lg bg-surface px-3 py-2 text-center">{{ c }}</li>
      </ul>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="btn-secondary btn-sm" @click="copiar">{{ copiado ? 'Copiados' : 'Copiar' }}</button>
        <button type="button" class="btn-secondary btn-sm" @click="descargar">Descargar .txt</button>
        <button type="button" class="btn-ghost btn-sm" @click="codigos = []">Ya los guardé</button>
      </div>
    </div>

    <p v-if="estado && !codigos.length" class="mb-4 text-sm" :class="estado.disponibles ? 'text-ink-secondary' : 'text-warning'">
      <template v-if="!estado.total">Todavía no tienes códigos. Si olvidas la contraseña, no podrás recuperarla desde la app.</template>
      <template v-else-if="estado.disponibles">
        Te quedan {{ estado.disponibles }} de {{ estado.total }} códigos (creados el {{ formatDate(estado.creadosEn) }}).
      </template>
      <template v-else>Ya usaste todos tus códigos: genera unos nuevos.</template>
    </p>

    <form class="flex flex-col gap-3 sm:flex-row sm:items-end" @submit.prevent="generar">
      <div class="flex-1">
        <FormField v-model="password" type="password" label="Tu contraseña (para confirmar)" autocomplete="current-password" required />
      </div>
      <button type="submit" class="btn-primary" :disabled="generando || !password">
        {{ generando ? 'Generando…' : estado?.total ? 'Generar códigos nuevos' : 'Generar códigos' }}
      </button>
    </form>
  </section>
</template>
