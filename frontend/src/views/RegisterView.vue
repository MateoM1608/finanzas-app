<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { extractErrorMessage } from '../api/client.js';
import FormField from '../components/FormField.vue';
import AlertError from '../components/AlertError.vue';
import AppIcon from '../components/AppIcon.vue';
import ThemeToggle from '../components/ThemeToggle.vue';

const router = useRouter();
const auth = useAuthStore();

const nombre = ref('');
const usuario = ref('');
const password = ref('');
const confirmarPassword = ref('');
const error = ref('');
const loading = ref(false);

// Puntos de valor del panel de marca (solo presentación).
const beneficios = [
  { icono: 'wallet', titulo: 'Disponible real', texto: 'Ingresos recibidos menos gastos pagados, sin estimaciones.' },
  { icono: 'scale', titulo: 'Cortes de hogar', texto: 'Liquida los gastos compartidos y sabe quién le debe a quién.' },
  { icono: 'piggy', titulo: 'Ahorros y límites', texto: 'Metas con sugerencias automáticas y alertas por categoría.' },
];

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
  <div class="min-h-screen bg-canvas lg:grid lg:grid-cols-2">
    <!-- Panel de marca: solo en pantallas grandes -->
    <aside class="hidden lg:flex flex-col justify-between border-r border-border bg-surface-sunken p-12 xl:p-16">
      <div class="flex items-center gap-2.5">
        <span class="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-on">
          <AppIcon name="logo" class="h-5 w-5" :stroke-width="2.4" />
        </span>
        <span class="text-[15px] font-semibold tracking-tight text-ink-primary">Finanzas</span>
      </div>

      <div class="max-w-md">
        <h2 class="text-display text-ink-primary">Ordena tus finanzas y las de tu hogar.</h2>
        <p class="mt-4 text-[15px] leading-relaxed text-ink-secondary">
          Un panel privado para ti y uno compartido para el hogar, conectados entre sí.
        </p>

        <ul class="mt-10 space-y-6">
          <li v-for="b in beneficios" :key="b.titulo" class="flex gap-4">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface text-accent shadow-card">
              <AppIcon :name="b.icono" class="h-5 w-5" />
            </span>
            <div>
              <p class="text-sm font-semibold text-ink-primary">{{ b.titulo }}</p>
              <p class="mt-0.5 text-[13px] leading-relaxed text-ink-secondary">{{ b.texto }}</p>
            </div>
          </li>
        </ul>
      </div>

      <p class="text-xs text-ink-tertiary">Montos en pesos colombianos · datos personales privados por usuario</p>
    </aside>

    <main class="flex min-h-screen flex-col px-4 py-5 sm:px-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5 lg:invisible">
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
            <h1 class="page-title">Crea tu cuenta</h1>
            <p class="page-subtitle">Empieza a organizar tus finanzas en minutos.</p>
          </div>

          <form class="card card-pad space-y-5" @submit.prevent="onSubmit">
            <AlertError :message="error" />

            <FormField v-model="nombre" label="Nombre" autocomplete="name" required placeholder="Tu nombre" />
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

          <p class="mt-6 text-center text-sm text-ink-secondary">
            ¿Ya tienes cuenta?
            <router-link :to="{ name: 'login' }" class="font-medium text-accent hover:text-accent-hover">
              Inicia sesión
            </router-link>
          </p>
        </div>
      </div>
    </main>
  </div>
</template>
