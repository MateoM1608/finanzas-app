<script setup>
import { computed, ref, watch } from 'vue';
import { contarNotificaciones } from '../api/avisos.js';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import AppIcon from './AppIcon.vue';
import AppModal from './AppModal.vue';
import ThemeToggle from './ThemeToggle.vue';
import { confirmar } from '../composables/useConfirm.js';
import { abrirRegistro } from '../stores/registro.js';
import RegistrarMovimientoModal from './personal/RegistrarMovimientoModal.vue';

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
});

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const NAV = [
  { name: 'inicio', label: 'Inicio', icon: 'wallet' },
  { name: 'movimientos', label: 'Movimientos', icon: 'list' },
  { name: 'panel-hogar', label: 'Hogar', icon: 'home', incluye: ['configuracion-hogar', 'hogar-seccion'] },
  { name: 'analisis', label: 'Análisis', icon: 'chart', incluye: ['configuracion-personal'] },
  { name: 'patrimonio', label: 'Patrimonio', icon: 'trendingUp', incluye: ['tarjetas'] },
  { name: 'cuadres', label: 'Cuadres', icon: 'scale' },
  { name: 'cuenta', label: 'Cuenta', icon: 'user' },
];
// Celular: lo de todos los días en la barra, el resto en "Más".
const NAV_MOVIL_IZQ = NAV.slice(0, 2);
const NAV_MOVIL_DER = [NAV[2]];
const NAV_MAS = [
  { name: 'analisis', label: 'Análisis', texto: 'Neto, límites, ahorros y próximos meses', icon: 'chart' },
  { name: 'patrimonio', label: 'Patrimonio', texto: 'Préstamos, inversiones y ahorros', icon: 'trendingUp' },
  { name: 'tarjetas', label: 'Tarjetas y cuentas', texto: 'Deuda, pagos y extractos', icon: 'creditCard' },
  { name: 'cuadres', label: 'Cuadres', texto: 'Cuadrar cuentas del hogar', icon: 'scale' },
  { name: 'configuracion-personal', label: 'Configuración personal', texto: 'Ciclo, cuentas, categorías, fijos', icon: 'sliders' },
  { name: 'cuenta', label: 'Cuenta', texto: 'Perfil, seguridad y exportar', icon: 'user' },
];
const RUTAS_MAS = ['analisis', 'configuracion-personal', 'patrimonio', 'tarjetas', 'cuadres', 'cuenta', 'notificaciones'];
const enMas = computed(() => RUTAS_MAS.includes(route.name));
const menuMas = ref(false);

// "+": un menú corto con lo que se registra más seguido. El gasto del hogar
// solo aparece con permiso para editar gastos del hogar.
const menuRegistrar = ref(false);
const puedeGastoHogar = computed(() =>
  Boolean(auth.usuario?.hogarId && (auth.usuario?.esAdmin || auth.usuario?.puedeEditarGastos)),
);
function registrar(tipo) {
  menuRegistrar.value = false;
  if (tipo === 'variable') router.push({ name: 'hogar-seccion', params: { seccion: 'gastos' }, query: { registrar: 'variable' } });
  else abrirRegistro(tipo);
}
watch(() => route.fullPath, () => {
  menuRegistrar.value = false;
  menuMas.value = false;
});
// Enlaces viejos con ?registrar=gasto|ingreso abren el formulario donde estés.
watch(
  () => route.query.registrar,
  (tipo) => {
    if (tipo !== 'gasto' && tipo !== 'ingreso') return;
    abrirRegistro(tipo);
    router.replace({ query: { ...route.query, registrar: undefined } });
  },
  { immediate: true },
);

const iniciales = computed(() =>
  (auth.usuario?.nombre || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join(''),
);

// Notificaciones sin leer: se consultan al abrir cada pantalla.
const noLeidas = ref(0);
watch(
  () => route.fullPath,
  async () => {
    if (!auth.usuario) return;
    try {
      noLeidas.value = await contarNotificaciones();
    } catch {
      // Es informativo: si falla, la pantalla sigue.
    }
  },
  { immediate: true },
);
const textoCampana = computed(() => (noLeidas.value ? `Notificaciones: ${noLeidas.value} sin leer` : 'Notificaciones'));

function activo(item) {
  return route.name === item.name || Boolean(item.incluye?.includes(route.name));
}

async function onLogout() {
  const ok = await confirmar('¿Cerrar sesión en este dispositivo?', { textoAceptar: 'Cerrar sesión', peligroso: false });
  if (!ok) return;
  await auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="min-h-screen lg:pl-64">
    <!-- Barra lateral (escritorio) -->
    <aside
      class="sidebar scope-brand hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col"
    >
      <div class="h-16 flex items-center gap-2.5 px-5">
        <span class="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-on">
          <AppIcon name="logo" class="h-[18px] w-[18px]" :stroke-width="2.4" />
        </span>
        <span class="text-base font-extrabold tracking-tight">Finanzas</span>
        <router-link :to="{ name: 'notificaciones' }" class="btn-icon relative ml-auto !p-1.5" :aria-label="textoCampana" :title="textoCampana">
          <AppIcon name="bell" class="h-[18px] w-[18px]" />
          <span v-if="noLeidas" class="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-negative px-1 text-[10px] font-semibold text-white">{{ noLeidas > 9 ? '9+' : noLeidas }}</span>
        </router-link>
      </div>

      <div class="px-3 pt-3">
        <button type="button" class="btn-primary w-full" @click="abrirRegistro('gasto')">
          <AppIcon name="plus" class="h-4 w-4" :stroke-width="2.4" />
          Registrar movimiento
        </button>
      </div>

      <nav class="flex-1 px-3 pt-4 space-y-0.5" aria-label="Principal">
        <router-link
          v-for="item in NAV"
          :key="item.name"
          :to="{ name: item.name }"
          class="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
          :class="activo(item) ? 'bg-highlight font-bold text-highlight-on' : 'font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'"
          :aria-current="activo(item) ? 'page' : undefined"
        >
          <AppIcon :name="item.icon" class="h-[18px] w-[18px]" />
          {{ item.label }}
        </router-link>
      </nav>

      <div class="p-3 space-y-1 border-t border-border">
        <ThemeToggle variant="full" />
        <div class="flex items-center gap-1 rounded-xl">
          <router-link
            :to="{ name: 'cuenta' }"
            class="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-hover transition-colors"
            title="Tu cuenta"
          >
            <span
              class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-[12px] font-semibold text-ink-secondary"
              aria-hidden="true"
            >
              {{ iniciales }}
            </span>
            <span class="min-w-0 flex-1 truncate text-[13px] font-medium">{{ auth.usuario?.nombre }}</span>
          </router-link>
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
        <span class="text-base font-extrabold tracking-tight">Finanzas</span>
      </div>
      <div class="flex items-center gap-1">
        <router-link :to="{ name: 'notificaciones' }" class="btn-icon relative" :aria-label="textoCampana" :title="textoCampana">
          <AppIcon name="bell" class="h-5 w-5" />
          <span v-if="noLeidas" class="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-negative px-1 text-[10px] font-semibold text-white">{{ noLeidas > 9 ? '9+' : noLeidas }}</span>
        </router-link>
        <ThemeToggle />
        <button type="button" class="btn-icon" aria-label="Cerrar sesión" title="Cerrar sesión" @click="onLogout">
          <AppIcon name="logout" class="h-5 w-5" />
        </button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl px-3 sm:px-6 lg:px-10 pt-4 sm:pt-8 lg:pt-10 pb-24 lg:pb-16">
      <div class="flex flex-wrap items-center sm:items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-8">
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
    <div
      v-if="menuRegistrar"
      class="lg:hidden fixed inset-0 z-20 bg-ink-primary/20"
      aria-hidden="true"
      @click="menuRegistrar = false"
    />
    <nav
      class="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 backdrop-blur-md"
      style="padding-bottom: env(safe-area-inset-bottom)"
      aria-label="Principal"
      @keydown.esc="menuRegistrar = false"
    >
      <div
        v-if="menuRegistrar"
        id="menu-registrar"
        class="absolute bottom-full left-1/2 mb-3 w-64 -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-pop"
        role="menu"
        aria-label="Registrar"
      >
        <button type="button" role="menuitem" class="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium text-ink-primary hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none [&+&]:border-t [&+&]:border-border" @click="registrar('gasto')">
          <AppIcon name="arrowUpRight" class="h-[18px] w-[18px] text-negative" />
          <span>Gasto personal</span>
        </button>
        <button type="button" role="menuitem" class="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium text-ink-primary hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none [&+&]:border-t [&+&]:border-border" @click="registrar('ingreso')">
          <AppIcon name="arrowDownLeft" class="h-[18px] w-[18px] text-positive" />
          <span>Ingreso personal</span>
        </button>
        <button v-if="puedeGastoHogar" type="button" role="menuitem" class="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium text-ink-primary hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none [&+&]:border-t [&+&]:border-border" @click="registrar('variable')">
          <AppIcon name="home" class="h-[18px] w-[18px] text-accent" />
          <span>Gasto del hogar</span>
        </button>
      </div>
      <div class="grid grid-cols-5">
        <router-link
          v-for="item in NAV_MOVIL_IZQ"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors"
          :class="activo(item) ? 'text-accent' : 'text-ink-tertiary hover:text-ink-primary'"
          :aria-current="activo(item) ? 'page' : undefined"
        >
          <AppIcon :name="item.icon" class="h-[22px] w-[22px]" />
          {{ item.short || item.label }}
        </router-link>
        <div class="relative flex items-center justify-center">
          <button
            type="button"
            class="grid h-12 w-12 -mt-5 place-items-center rounded-2xl bg-accent text-highlight dark:text-accent-on shadow-pop ring-4 ring-canvas transition-transform"
            :class="{ 'rotate-45': menuRegistrar }"
            :aria-label="menuRegistrar ? 'Cerrar menú de registro' : 'Registrar movimiento'"
            :aria-expanded="menuRegistrar"
            aria-controls="menu-registrar"
            @click="menuRegistrar = !menuRegistrar"
          >
            <AppIcon name="plus" class="h-6 w-6" :stroke-width="2.4" />
          </button>
        </div>
        <router-link
          v-for="item in NAV_MOVIL_DER"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors"
          :class="activo(item) ? 'text-accent' : 'text-ink-tertiary hover:text-ink-primary'"
          :aria-current="activo(item) ? 'page' : undefined"
        >
          <AppIcon :name="item.icon" class="h-[22px] w-[22px]" />
          {{ item.label }}
        </router-link>
        <button
          type="button"
          class="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors"
          :class="enMas || menuMas ? 'text-accent' : 'text-ink-tertiary hover:text-ink-primary'"
          :aria-expanded="menuMas"
          @click="menuMas = true"
        >
          <AppIcon name="grid" class="h-[22px] w-[22px]" />
          Más
        </button>
      </div>
    </nav>

    <!-- "Más" (celular): lo que no cabe en la barra. -->
    <AppModal v-if="menuMas" title="Más" @close="menuMas = false">
      <nav aria-label="Más secciones" class="-mx-2 -my-1">
        <router-link
          v-for="item in NAV_MAS"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-hover"
          :class="{ 'bg-surface-hover': route.name === item.name }"
        >
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-accent">
            <AppIcon :name="item.icon" class="h-5 w-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-ink-primary">{{ item.label }}</span>
            <span class="block truncate text-[13px] text-ink-tertiary">{{ item.texto }}</span>
          </span>
          <AppIcon name="chevronRight" class="h-4 w-4 shrink-0 text-ink-tertiary" />
        </router-link>
      </nav>
    </AppModal>

    <RegistrarMovimientoModal />
  </div>
</template>
