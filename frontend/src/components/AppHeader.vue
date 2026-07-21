<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const router = useRouter();

async function onLogout() {
  await auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <header class="border-b border-border">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <div class="inline-flex items-center gap-2">
        <span class="h-2 w-2 rounded-full bg-accent"></span>
        <span class="text-sm font-medium tracking-wide text-ink-secondary uppercase">Finanzas</span>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-sm text-ink-secondary hidden sm:inline mr-2">{{ auth.usuario?.nombre }}</span>
        <router-link :to="{ name: 'settings' }" class="btn-ghost !px-3 !py-1.5 text-sm">
          Configuración
        </router-link>
        <button class="btn-ghost !px-3 !py-1.5 text-sm" @click="onLogout">Cerrar sesión</button>
      </div>
    </div>
  </header>
</template>
