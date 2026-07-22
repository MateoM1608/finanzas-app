<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { crearHogar, unirseHogar } from '../api/hogares.js';
import { extractErrorMessage } from '../api/client.js';
import FormField from '../components/FormField.vue';
import AlertError from '../components/AlertError.vue';

const router = useRouter();
const auth = useAuthStore();

const modo = ref('crear'); // 'crear' | 'unirse'
const error = ref('');
const loading = ref(false);

const nombreHogar = ref('');
const frecuenciaCorte = ref('quincenal');
const codigo = ref('');

async function onCrear() {
  error.value = '';
  loading.value = true;
  try {
    const { usuario } = await crearHogar({
      nombre: nombreHogar.value,
      frecuenciaCorte: frecuenciaCorte.value,
    });
    auth.setUsuario(usuario);
    router.push({ name: 'dashboard' });
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onUnirse() {
  error.value = '';
  loading.value = true;
  try {
    const { usuario } = await unirseHogar(codigo.value.trim().toUpperCase());
    auth.setUsuario(usuario);
    router.push({ name: 'dashboard' });
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

function cambiarModo(nuevo) {
  modo.value = nuevo;
  error.value = '';
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <div class="inline-flex items-center gap-2 mb-6">
          <span class="h-2 w-2 rounded-full bg-accent"></span>
          <span class="text-sm font-medium tracking-wide text-ink-secondary uppercase">Finanzas</span>
        </div>
        <h1 class="text-2xl font-semibold text-ink-primary">Un último paso</h1>
        <p class="text-ink-secondary mt-1.5 text-sm">Crea tu hogar o únete a uno existente</p>
      </div>

      <div class="card p-2 flex gap-1 mb-4">
        <button
          class="flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
          :class="modo === 'crear' ? 'bg-accent text-white' : 'text-ink-secondary hover:text-ink-primary'"
          @click="cambiarModo('crear')"
        >
          Crear hogar
        </button>
        <button
          class="flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
          :class="modo === 'unirse' ? 'bg-accent text-white' : 'text-ink-secondary hover:text-ink-primary'"
          @click="cambiarModo('unirse')"
        >
          Unirme con código
        </button>
      </div>

      <form v-if="modo === 'crear'" class="card p-8 space-y-5" @submit.prevent="onCrear">
        <AlertError :message="error" />

        <FormField v-model="nombreHogar" label="Nombre del hogar" required placeholder="Casa de Mateo y Dani" />

        <div>
          <label class="label">Frecuencia de corte</label>
          <select v-model="frecuenciaCorte" class="field">
            <option value="semanal">Semanal</option>
            <option value="quincenal">Quincenal</option>
            <option value="mensual">Mensual</option>
          </select>
        </div>

        <button type="submit" class="btn-primary w-full" :disabled="loading">
          {{ loading ? 'Creando…' : 'Crear hogar' }}
        </button>
      </form>

      <form v-else class="card p-8 space-y-5" @submit.prevent="onUnirse">
        <AlertError :message="error" />

        <FormField v-model="codigo" label="Código de invitación" required placeholder="ABCD1234" />

        <button type="submit" class="btn-primary w-full" :disabled="loading">
          {{ loading ? 'Uniéndote…' : 'Unirme al hogar' }}
        </button>
      </form>
    </div>
  </div>
</template>
