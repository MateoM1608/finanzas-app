<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { registro } from '../stores/registro.js';
import AppLayout from '../components/AppLayout.vue';
import AppIcon from '../components/AppIcon.vue';
import ResumenPersonalSection from '../components/personal/ResumenPersonalSection.vue';
import AhorrosPersonalesSection from '../components/personal/AhorrosPersonalesSection.vue';
import LimitesPersonalesSection from '../components/personal/LimitesPersonalesSection.vue';
import ProximosMesesSection from '../components/personal/ProximosMesesSection.vue';

/**
 * Análisis: cómo vas en el ciclo (Neto, gráficos), límites, ahorros y los
 * próximos meses, con navegación a ciclos pasados (Etapa 6). Una pestaña a la
 * vez para no mostrar todo junto.
 */
const CICLOS_HACIA_ATRAS = 24;
const ciclo = ref(0);
const infoCiclo = ref(null);
const route = useRoute();
const vista = ref(['limites', 'ahorros', 'proximos'].includes(route.query.vista) ? route.query.vista : 'resumen');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombreCiclo = computed(() => {
  const info = infoCiclo.value;
  if (!info) return '';
  const ini = new Date(info.inicio);
  const fin = new Date(info.fin);
  if (info.frecuencia === 'mensual') return `${MESES[ini.getUTCMonth()]} ${ini.getUTCFullYear()}`;
  const mismoMes = ini.getUTCMonth() === fin.getUTCMonth();
  const desde = mismoMes ? `${ini.getUTCDate()}` : `${ini.getUTCDate()} ${MESES_CORTOS[ini.getUTCMonth()]}`;
  return `${desde}–${fin.getUTCDate()} ${MESES_CORTOS[fin.getUTCMonth()]} ${fin.getUTCFullYear()}`;
});
const rangoCiclo = computed(() =>
  infoCiclo.value
    ? { desde: String(infoCiclo.value.inicio).slice(0, 10), hasta: String(infoCiclo.value.fin).slice(0, 10) }
    : {},
);

function moverCiclo(delta) {
  ciclo.value = Math.min(0, Math.max(-CICLOS_HACIA_ATRAS, ciclo.value + delta));
}

const VISTAS = computed(() => [
  { id: 'resumen', texto: 'Resumen' },
  { id: 'limites', texto: 'Límites' },
  { id: 'ahorros', texto: 'Ahorros' },
  ...(ciclo.value === 0 ? [{ id: 'proximos', texto: 'Próximos meses' }] : []),
]);
watch(ciclo, (c) => {
  if (c !== 0 && vista.value === 'proximos') vista.value = 'resumen';
});

const resumenRef = ref(null);
const limitesRef = ref(null);
const ahorrosRef = ref(null);
const proximosRef = ref(null);
watch(
  () => registro.version,
  () => {
    resumenRef.value?.recargar();
    limitesRef.value?.recargar();
    ahorrosRef.value?.recargar();
    proximosRef.value?.recargar();
  },
);
function onCambioAhorro() {
  resumenRef.value?.recargar();
}
</script>

<template>
  <AppLayout title="Análisis" subtitle="Cómo vas en el ciclo: lo que gastaste, tus topes y tus ahorros.">
    <template #actions>
      <router-link :to="{ name: 'configuracion-personal' }" class="btn-secondary" aria-label="Configuración personal">
        <AppIcon name="sliders" class="h-4 w-4" />
        <span class="hidden sm:inline">Configuración</span>
      </router-link>
    </template>

    <div class="space-y-5">
      <!-- Ciclo -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-1 rounded-2xl border border-border bg-surface p-1">
          <button type="button" class="btn-icon" aria-label="Ciclo anterior" :disabled="ciclo <= -CICLOS_HACIA_ATRAS" @click="moverCiclo(-1)">
            <AppIcon name="chevronLeft" class="h-4 w-4" />
          </button>
          <span class="min-w-[9.5rem] text-center text-sm font-semibold capitalize text-ink-primary" aria-live="polite">
            {{ nombreCiclo || '…' }}
          </span>
          <button type="button" class="btn-icon" aria-label="Ciclo siguiente" :disabled="ciclo >= 0" @click="moverCiclo(1)">
            <AppIcon name="chevronRight" class="h-4 w-4" />
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button v-if="ciclo < 0" type="button" class="btn-ghost btn-sm" @click="ciclo = 0">
            <AppIcon name="clock" class="h-4 w-4" /> Volver al actual
          </button>
          <router-link
            v-if="infoCiclo"
            :to="{ name: 'movimientos', query: rangoCiclo }"
            class="btn-ghost btn-sm"
          >
            <AppIcon name="list" class="h-4 w-4" /> Movimientos del ciclo
          </router-link>
        </div>
      </div>

      <div class="tabs" role="tablist" aria-label="Qué ver">
        <button
          v-for="v in VISTAS"
          :key="v.id"
          type="button"
          role="tab"
          class="tab"
          :class="{ 'tab-active': vista === v.id }"
          :aria-selected="vista === v.id"
          @click="vista = v.id"
        >
          {{ v.texto }}
        </button>
      </div>

      <!-- El resumen se monta siempre: da el rango del ciclo para el título. -->
      <div v-show="vista === 'resumen'">
        <ResumenPersonalSection ref="resumenRef" :ciclo="ciclo" @ciclo="infoCiclo = $event" />
      </div>

      <section v-if="vista === 'limites'" class="card card-pad">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="section-title">Límites</h2>
            <p class="section-hint">{{ ciclo === 0 ? 'Topes de gasto del ciclo actual.' : 'Cómo te fue con tus topes en ese ciclo.' }}</p>
          </div>
          <router-link :to="{ name: 'configuracion-personal', query: { tab: 'limites' } }" class="btn-ghost btn-sm">Configurar</router-link>
        </div>
        <LimitesPersonalesSection ref="limitesRef" :ciclo="ciclo" />
      </section>

      <section v-if="vista === 'ahorros'" class="card card-pad">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="section-title">Ahorros</h2>
            <p class="section-hint">{{ ciclo === 0 ? 'Metas y aportes del ciclo.' : 'Metas y aportes de ese ciclo.' }}</p>
          </div>
          <router-link :to="{ name: 'configuracion-personal', query: { tab: 'ahorros' } }" class="btn-ghost btn-sm">Configurar</router-link>
        </div>
        <AhorrosPersonalesSection ref="ahorrosRef" :ciclo="ciclo" @cambio="onCambioAhorro" />
      </section>

      <ProximosMesesSection v-if="vista === 'proximos'" ref="proximosRef" />
    </div>
  </AppLayout>
</template>
