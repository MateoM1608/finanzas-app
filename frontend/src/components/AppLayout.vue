<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import AppIcon from './AppIcon.vue';
import ThemeToggle from './ThemeToggle.vue';

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
});

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const NAV = [
  { name: 'panel-personal', label: 'Personal', icon: 'wallet' },
  { name: 'panel-hogar', label: 'Hogar', icon: 'home' },
  { name: 'cuadres', label: 'Cuadres', icon: 'scale' },
  { name: 'settings', label: 'Configuración', short: 'Ajustes', icon: 'settings' },
];

const iniciales = computed(() =>
  (auth.usuario?.nombre || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join(''),
);

function activo(item) {
  return route.name === item.name;
}

async function onLogout() {
  await auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="min-h-screen lg:pl-64">
    <!-- Barra lateral (escritorio) -->
    <aside
      class="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-surface/70 backdrop-blur-sm"
    >
      <div class="h-16 flex items-center gap-2.5 px-5">
        <span class="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-on">
          <AppIcon name="logo" class="h-[18px] w-[18px]" :stroke-width="2.4" />
        </span>
        <span class="text-[15px] font-semibold tracking-tight">Finanzas</span>
      </div>

      <nav class="flex-1 px-3 pt-4 space-y-0.5" aria-label="Principal">
        <router-link
          v-for="item in NAV"
          :key="item.name"
          :to="{ name: item.name }"
          class="relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
          :class="activo(item) ? 'bg-accent/10 text-accent' : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'"
          :aria-current="activo(item) ? 'page' : undefined"
        >
          <AppIcon :name="item.icon" class="h-[18px] w-[18px]" />
          {{ item.label }}
        </router-link>
      </nav>

      <div class="p-3 space-y-1 border-t border-border">
        <ThemeToggle variant="full" />
        <div class="flex items-center gap-3 rounded-xl px-3 py-2">
          <span
            class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-[12px] font-semibold text-ink-secondary"
            aria-hidden="true"
          >
            {{ iniciales }}
          </span>
          <span class="min-w-0 flex-1 truncate text-[13px] font-medium">{{ auth.usuario?.nombre }}</span>
          <button type="button" class="btn-icon !p-1.5" aria-label="Cerrar sesión" title="Cerrar sesión" @click="onLogout">
            <AppIcon name="logout" class="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Barra superior (móvil y tablet) -->
    <header
      class="lg:hidden sticky top-0 z-30 h-14 flex items-center justify-between px-4 border-b border-border bg-canvas/85 backdrop-blur-md"
      style="padding-top: env(safe-area-inset-top)"
    >
      <div class="flex items-center gap-2">
        <span class="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-on">
          <AppIcon name="logo" class="h-4 w-4" :stroke-width="2.4" />
        </span>
        <span class="text-[15px] font-semibold tracking-tight">Finanzas</span>
      </div>
      <div class="flex items-center gap-1">
        <ThemeToggle />
        <button type="button" class="btn-icon" aria-label="Cerrar sesión" title="Cerrar sesión" @click="onLogout">
          <AppIcon name="logout" class="h-5 w-5" />
        </button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10 pt-6 sm:pt-8 lg:pt-10 pb-28 lg:pb-16">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-6 sm:mb-8">
        <div class="min-w-0">
          <h1 class="page-title">{{ title }}</h1>
          <p v-if="subtitle" class="page-subtitle">{{ subtitle }}</p>
        </div>
        <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
          <slot name="actions" />
        </div>
      </div>

      <slot />
    </main>

    <!-- Navegación inferior (móvil y tablet) -->
    <nav
      class="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 backdrop-blur-md"
      style="padding-bottom: env(safe-area-inset-bottom)"
      aria-label="Principal"
    >
      <div class="grid grid-cols-4">
        <router-link
          v-for="item in NAV"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors"
          :class="activo(item) ? 'text-accent' : 'text-ink-tertiary hover:text-ink-primary'"
          :aria-current="activo(item) ? 'page' : undefined"
        >
          <AppIcon :name="item.icon" class="h-[22px] w-[22px]" />
          {{ item.short || item.label }}
        </router-link>
      </div>
    </nav>
  </div>
</template>
