<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { extractErrorMessage } from '../api/client.js';
import FormField from '../components/FormField.vue';
import AlertError from '../components/AlertError.vue';

const router = useRouter();
const auth = useAuthStore();

const usuario = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function onSubmit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login({ usuario: usuario.value, password: password.value });
    router.push(auth.hasHogar ? { name: 'dashboard' } : { name: 'onboarding' });
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
        <h1 class="text-2xl font-semibold text-ink-primary">Bienvenido de nuevo</h1>
        <p class="text-ink-secondary mt-1.5 text-sm">Ingresa a tu cuenta para continuar</p>
      </div>

      <form class="card p-8 space-y-5" @submit.prevent="onSubmit">
        <AlertError :message="error" />

        <FormField
          v-model="usuario"
          label="Usuario"
          autocomplete="username"
          required
          placeholder="tu_usuario"
        />
        <FormField
          v-model="password"
          label="Contraseña"
          type="password"
          autocomplete="current-password"
          required
          placeholder="••••••••"
        />

        <button type="submit" class="btn-primary w-full" :disabled="loading">
          {{ loading ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>

      <p class="text-center text-sm text-ink-secondary mt-6">
        ¿No tienes cuenta?
        <router-link :to="{ name: 'register' }" class="text-accent hover:text-accent-hover font-medium">
          Regístrate
        </router-link>
      </p>
    </div>
  </div>
</template>
