<script setup>
import { ref, computed, onMounted } from 'vue';
import { obtenerAvisos } from '../api/avisos.js';
import { formatCurrency, formatDate } from '../utils/format.js';
import AppIcon from './AppIcon.vue';
import { useRouter } from 'vue-router';
import { irAAncla } from '../composables/useAncla.js';

const router = useRouter();

/**
 * "Para pagar": lo atrasado, lo de hoy y lo de los próximos días. En Personal
 * muestra lo tuyo y lo del hogar que te toca; en Hogar, todo lo del hogar.
 * Si no hay nada, no ocupa espacio.
 */
const props = defineProps({ ambito: { type: String, default: 'personal' } });

const datos = ref(null);

async function cargar() {
  try {
    datos.value = await obtenerAvisos();
  } catch {
    // Informativo: si falla, no se muestra.
  }
}
onMounted(cargar);
defineExpose({ recargar: cargar });

const avisos = computed(() => {
  if (!datos.value) return [];
  if (props.ambito === 'hogar') return datos.value.hogar;
  return [...datos.value.personales, ...datos.value.hogar.filter((a) => a.paraMi)].sort(
    (a, b) => new Date(a.fecha) - new Date(b.fecha),
  );
});
const atrasados = computed(() => avisos.value.filter((a) => a.estado === 'atrasado').length);
const total = computed(() => avisos.value.reduce((s, a) => s + (a.monto ?? 0), 0));
const abierto = ref(true);

function etiqueta(a) {
  if (a.estado === 'atrasado') return { texto: a.dias === -1 ? 'Ayer' : `Hace ${-a.dias} días`, clase: 'badge-negative' };
  if (a.estado === 'hoy') return { texto: 'Hoy', clase: 'badge-warning' };
  return { texto: a.dias === 1 ? 'Mañana' : `En ${a.dias} días`, clase: 'badge-neutral' };
}
</script>

<template>
  <section v-if="avisos.length" class="card overflow-hidden" :class="atrasados ? 'border-negative/30' : 'border-warning/30'">
    <button type="button" class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-6" :aria-expanded="abierto" @click="abierto = !abierto">
      <span class="flex min-w-0 items-center gap-2.5">
        <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg" :class="atrasados ? 'bg-negative/10 text-negative' : 'bg-warning/10 text-warning'">
          <AppIcon name="bell" class="h-4 w-4" />
        </span>
        <span class="min-w-0">
          <span class="block text-sm font-semibold text-ink-primary">
            Para pagar · {{ avisos.length }}
            <span v-if="atrasados" class="font-medium text-negative">({{ atrasados }} atrasado{{ atrasados === 1 ? '' : 's' }})</span>
          </span>
          <span class="block text-xs text-ink-tertiary">Lo atrasado y lo que vence en los próximos {{ datos.diasAviso }} días<template v-if="total"> · {{ formatCurrency(total) }}</template></span>
        </span>
      </span>
      <AppIcon :name="abierto ? 'chevronDown' : 'chevronRight'" class="h-4 w-4 shrink-0 text-ink-tertiary" />
    </button>
    <ul v-if="abierto" class="list border-t border-border px-4 sm:px-6">
      <li v-for="a in avisos" :key="a.id" class="list-row !py-2.5">
        <div class="min-w-0">
          <p class="flex flex-wrap items-center gap-1.5 text-sm text-ink-primary">
            <span class="truncate">{{ a.titulo }}</span>
            <span :class="etiqueta(a).clase">{{ etiqueta(a).texto }}</span>
            <span v-if="a.ambito === 'hogar' && ambito === 'personal'" class="badge-neutral">Hogar</span>
          </p>
          <p class="text-xs text-ink-tertiary">
            {{ formatDate(a.fecha) }}
            <template v-if="ambito === 'hogar' && a.responsable"> · le toca a {{ a.responsable }}</template>
          </p>
        </div>
        <span class="flex shrink-0 items-center gap-2">
          <span v-if="a.monto != null" class="text-sm font-semibold text-ink-primary">{{ formatCurrency(a.monto) }}</span>
          <a :href="a.enlace" class="btn-secondary btn-sm" :aria-label="`Ir a ${a.titulo}`" @click.prevent="irAAncla(router, a.enlace)">Ir</a>
        </span>
      </li>
    </ul>
  </section>
</template>
