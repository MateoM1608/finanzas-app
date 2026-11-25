<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { extractErrorMessage } from '../api/client.js';
import FormField from '../components/FormField.vue';
import AlertError from '../components/AlertError.vue';
import AppIcon from '../components/AppIcon.vue';
import ThemeToggle from '../components/ThemeToggle.vue';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const usuario = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

// Puntos de valor del panel de marca (solo presentación).
const beneficios = [
  { icono: 'wallet', titulo: 'Disponible real', texto: 'Ingresos recibidos menos gastos pagados, sin estimaciones.' },
  { icono: 'scale', titulo: 'Cuadre de cuentas', texto: 'Saldo en vivo de quién le debe a quién, y cuadren cuando quieran.' },
  { icono: 'piggy', titulo: 'Ahorros y límites', texto: 'Metas con sugerencias automáticas y alertas por categoría.' },
];

async function onSubmit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login({ usuario: usuario.value, password: password.value });
    router.push(auth.hasHogar ? { name: 'panel-personal' } : { name: 'onboarding' });
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
    <aside class="scope-brand hidden lg:flex flex-col justify-between p-12 xl:p-16">
      <div class="flex items-center gap-2.5">
        <span class="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-on">
          <AppIcon name="logo" class="h-5 w-5" :stroke-width="2.4" />
        </span>
        <span class="text-[15px] font-semibold tracking-tight text-ink-primary">Finanzas</span>
      </div>

      <div class="max-w-md">
        <h2 class="text-display text-ink-primary">Tu dinero y el de tu hogar, <span class="marker">sin enredos.</span></h2>
        <p class="mt-4 text-[15px] leading-relaxed text-ink-secondary">
          Lo personal sigue siendo privado; lo compartido se liquida sin cuentas a mano.
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
            <h1 class="page-title">Bienvenido de nuevo</h1>
            <p class="page-subtitle">Ingresa a tu cuenta para continuar.</p>
          </div>

          <form class="card card-pad space-y-5" @submit.prevent="onSubmit">
            <p v-if="route.query.motivo === 'sesion' && !error" class="rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-sm text-warning">
              Tu sesión terminó. Vuelve a iniciar sesión.
            </p>
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
            <p class="text-center text-[13px]">
              <router-link :to="{ name: 'recuperar' }" class="text-ink-secondary hover:text-accent">¿Olvidaste tu contraseña?</router-link>
            </p>
          </form>

          <p class="mt-6 text-center text-sm text-ink-secondary">
            ¿No tienes cuenta?
            <router-link :to="{ name: 'register' }" class="font-medium text-accent hover:text-accent-hover">
              Regístrate
            </router-link>
          </p>
        </div>
      </div>
    </main>
  </div>
</template>
