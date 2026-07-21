<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { extractErrorMessage } from '../api/client.js';
import FormField from '../components/FormField.vue';
import AlertError from '../components/AlertError.vue';

const router = useRouter();
const auth = useAuthStore();

const nombre = ref('');
const usuario = ref('');
const password = ref('');
const confirmarPassword = ref('');
const error = ref('');
const loading = ref(false);

async function onSubmit() {
  error.value = '';

  if (password.value !== confirmarPassword.value) {
    error.value = 'Las contraseñas no coinciden';
    return;
  }

  loading.value = true;
  try {
    await auth.register({ nombre: nombre.value, usuario: usuario.value, password: password.value });
    router.push({ name: 'onboarding' });
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <div class="inline-flex items-center gap-2 mb-6">
          <span class="h-2 w-2 rounded-full bg-accent"></span>
          <span class="text-sm font-medium tracking-wide text-ink-secondary uppercase">Finanzas</span>
        </div>
        <h1 class="text-2xl font-semibold text-ink-primary">Crea tu cuenta</h1>
        <p class="text-ink-secondary mt-1.5 text-sm">Empieza a organizar tus finanzas</p>
      </div>

      <form class="card p-8 space-y-5" @submit.prevent="onSubmit">
        <AlertError :message="error" />

        <FormField v-model="nombre" label="Nombre" required placeholder="Tu nombre" />
        <FormField
          v-model="usuario"
          label="Usuario"
          autocomplete="username"
          required
          placeholder="elige_un_usuario"
        />
        <FormField
          v-model="password"
          label="Contraseña"
          type="password"
          autocomplete="new-password"
          required
          placeholder="Mínimo 8 caracteres"
        />
        <FormField
          v-model="confirmarPassword"
          label="Confirmar contraseña"
          type="password"
          autocomplete="new-password"
          required
          placeholder="Repite tu contraseña"
        />

        <button type="submit" class="btn-primary w-full" :disabled="loading">
          {{ loading ? 'Creando cuenta…' : 'Crear cuenta' }}
        </button>
      </form>

      <p class="text-center text-sm text-ink-secondary mt-6">
        ¿Ya tienes cuenta?
        <router-link :to="{ name: 'login' }" class="text-accent hover:text-accent-hover font-medium">
          Inicia sesión
        </router-link>
      </p>
    </div>
  </div>
</template>
