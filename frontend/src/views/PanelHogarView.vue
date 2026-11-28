<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import AppLayout from '../components/AppLayout.vue';
import AppIcon from '../components/AppIcon.vue';
import SaldoHogarSection from '../components/hogar/SaldoHogarSection.vue';
import AvisosPagar from '../components/AvisosPagar.vue';
import { SECCIONES_HOGAR } from '../utils/seccionesHogar.js';

/**
 * Hogar: el saldo en vivo como cifra protagonista, lo que hay que pagar y las
 * acciones de todos los días. Cada parte (cuentas fijas, gastos, metas,
 * topes, actividad, informe) tiene su propia página.
 */
const auth = useAuthStore();
const router = useRouter();
const puedeEditar = computed(() => Boolean(auth.usuario?.esAdmin || auth.usuario?.puedeEditarGastos));

const acciones = computed(() => [
  ...(puedeEditar.value
    ? [{ id: 'gasto', texto: 'Gasto', icono: 'plus', to: { name: 'hogar-seccion', params: { seccion: 'gastos' }, query: { registrar: 'variable' } } }]
    : []),
  { id: 'pagar', texto: 'Lo pagué', icono: 'check', to: { name: 'hogar-seccion', params: { seccion: 'cuentas' } } },
  { id: 'cuadres', texto: 'Cuadres', icono: 'clock', to: { name: 'cuadres' } },
  { id: 'config', texto: 'Ajustes', icono: 'sliders', to: { name: 'configuracion-hogar' } },
]);
</script>

<template>
  <AppLayout title="Hogar" subtitle="Gastos compartidos y quién le debe a quién.">
    <div class="space-y-6">
      <SaldoHogarSection />

      <nav aria-label="Acciones del hogar" class="flex justify-around gap-2 sm:justify-start sm:gap-8">
        <button
          v-for="a in acciones"
          :key="a.id"
          type="button"
          class="group flex w-16 flex-col items-center gap-1.5 text-[12px] font-semibold text-ink-secondary hover:text-ink-primary"
          @click="router.push(a.to)"
        >
          <span
            class="grid h-14 w-14 place-items-center rounded-full border border-border bg-surface text-accent shadow-card transition-transform group-hover:border-border-strong group-active:scale-95"
          >
            <AppIcon :name="a.icono" class="h-[22px] w-[22px]" :stroke-width="2" />
          </span>
          {{ a.texto }}
        </button>
      </nav>

      <AvisosPagar ambito="hogar" />

      <nav aria-label="Secciones del hogar" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <router-link
          v-for="s in SECCIONES_HOGAR"
          :key="s.id"
          :to="{ name: 'hogar-seccion', params: { seccion: s.id } }"
          class="card flex items-center gap-3 px-4 py-4 transition-colors hover:bg-surface-hover"
        >
          <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-sunken text-accent">
            <AppIcon :name="s.icono" class="h-5 w-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-bold text-ink-primary">{{ s.titulo }}</span>
            <span class="block text-[13px] text-ink-tertiary">{{ s.texto }}</span>
          </span>
          <AppIcon name="chevronRight" class="h-4 w-4 shrink-0 text-ink-tertiary" />
        </router-link>
      </nav>
    </div>
  </AppLayout>
</template>
