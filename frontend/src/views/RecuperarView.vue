<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { api, extractErrorMessage } from '../api/client.js';
import FormField from '../components/FormField.vue';
import AlertError from '../components/AlertError.vue';
import AppIcon from '../components/AppIcon.vue';
import ThemeToggle from '../components/ThemeToggle.vue';

/**
 * "¿Olvidaste tu contraseña?": usuario + uno de sus códigos de recuperación
 * (los que generó en Tu cuenta) + contraseña nueva. Al terminar queda con la
 * sesión iniciada y las demás sesiones se cierran.
 */
const router = useRouter();
const auth = useAuthStore();

const usuario = ref('');
const codigo = ref('');
const nueva = ref('');
const repetir = ref('');
const error = ref('');
const cargando = ref(false);

const puedeEnviar = computed(() => usuario.value && codigo.value && nueva.value.length >= 8 && nueva.value === repetir.value);

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    const { data } = await api.post('/api/auth/recuperar', { usuario: usuario.value, codigo: codigo.value, nueva: nueva.value });
    auth.setUsuario(data.usuario);
    router.push(auth.hasHogar ? { name: 'panel-personal' } : { name: 'onboarding' });
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-canvas">
    <main class="flex min-h-screen flex-col px-4 py-5 sm:px-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-on">
            <AppIcon name="logo" class="h-5 w-5" :stroke-width="2.4" />
          </span>
          <span class="text-[15px] font-semibold tracking-tight text-ink-primary">Finanzas</span>
        </div>
        <ThemeToggle />
      </div>

      <div class="flex flex-1 items-center justify-center py-10">
        <div class="w-full max-w-sm">
          <div class="mb-7">
            <h1 class="page-title">Recupera tu cuenta</h1>
            <p class="mt-1 text-sm text-ink-secondary">
              Usa uno de tus códigos de recuperación. Cada código sirve una sola vez.
            </p>
          </div>

          <form class="card card-pad space-y-5" @submit.prevent="onSubmit">
            <AlertError :message="error" />
            <FormField v-model="usuario" label="Usuario" autocomplete="username" required placeholder="tu_usuario" />
            <FormField v-model="codigo" label="Código de recuperación" required placeholder="ABCD-EFGH" />
            <FormField v-model="nueva" label="Contraseña nueva (mínimo 8)" type="password" autocomplete="new-password" required />
            <FormField v-model="repetir" label="Repite la contraseña nueva" type="password" autocomplete="new-password" required />
            <p v-if="repetir && nueva !== repetir" class="text-[13px] font-medium text-negative">Las contraseñas no coinciden.</p>
            <button type="submit" class="btn-primary w-full" :disabled="cargando || !puedeEnviar">
              {{ cargando ? 'Cambiando…' : 'Cambiar contraseña y entrar' }}
            </button>
          </form>

          <p class="mt-6 text-center text-[13px] leading-relaxed text-ink-tertiary">
            ¿No tienes códigos? Los códigos se crean en Configuración → Tu cuenta, con la sesión iniciada. Si no los
            guardaste, pide que restablezcan tu contraseña directamente en la base.
          </p>
          <p class="mt-4 text-center text-sm">
            <router-link :to="{ name: 'login' }" class="font-medium text-accent hover:text-accent-hover">Volver a iniciar sesión</router-link>
          </p>
        </div>
      </div>
    </main>
  </div>
</template>
