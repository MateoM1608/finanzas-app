<script setup>
import { ref, watch } from 'vue';
import { obtenerResumenLimites } from '../../api/limitesPersonales.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency } from '../../utils/format.js';
import AlertError from '../AlertError.vue';

const props = defineProps({ ciclo: { type: Number, default: 0 } });

const loading = ref(true);
const error = ref('');
const resumen = ref(null);

async function cargar() {
  loading.value = true;
  error.value = '';
  try {
    resumen.value = await obtenerResumenLimites(props.ciclo);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
watch(() => props.ciclo, cargar, { immediate: true });
defineExpose({ recargar: cargar });

// Solo presentación: porcentaje gastado del límite, acotado a 0–100 para la barra.
function pctGastado(actual) {
  const lim = Number(actual.limiteCalculado) || 0;
  if (lim <= 0) return Number(actual.montoGastado) > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, (Number(actual.montoGastado) / lim) * 100));
}
</script>

<template>
  <div>
    <AlertError :message="error" />
    <p v-if="loading" class="empty">Cargando…</p>

    <template v-else>
      <p v-if="!resumen.limites.length" class="empty">
        <template v-if="ciclo === 0">Aún no tienes límites. Créalos con «Configurar».</template>
        <template v-else>No había límites en ese ciclo.</template>
      </p>

      <div v-else class="grid grid-cols-2 gap-2 sm:gap-3">
        <div
          v-for="limite in resumen.limites"
          :key="limite.id"
          class="panel-sunken p-3 sm:p-4 min-w-0"
          :class="limite.actual.estado === 'excedido' ? 'border-negative/30' : ''"
        >
          <div class="flex flex-wrap items-start justify-between gap-1.5 sm:gap-3">
            <p class="text-[13px] sm:text-sm font-medium text-ink-primary truncate">{{ limite.nombre }}</p>
            <span :class="limite.actual.estado === 'excedido' ? 'badge-negative' : 'badge-positive'" class="shrink-0">
              {{ limite.actual.estado === 'excedido' ? 'Excedido' : 'Dentro' }}
            </span>
          </div>

          <p class="mt-2 sm:mt-3 text-xs sm:text-[13px] text-ink-tertiary">
            <span class="block sm:inline text-sm sm:text-base font-semibold tracking-tight text-ink-primary">{{
              formatCurrency(limite.actual.montoGastado)
            }}</span>
            de {{ formatCurrency(limite.actual.limiteCalculado) }}
          </p>

          <div
            class="mt-2.5 h-1.5 rounded-full bg-surface-sunken overflow-hidden"
            role="progressbar"
            :aria-valuenow="Math.round(pctGastado(limite.actual))"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Gastado de ${limite.nombre}`"
          >
            <div
              class="h-full rounded-full transition-[width] duration-500 ease-out"
              :class="limite.actual.estado === 'excedido' ? 'bg-negative' : 'bg-positive'"
              :style="{ width: pctGastado(limite.actual) + '%' }"
            />
          </div>

          <p
            class="mt-2 text-xs sm:text-[13px] font-medium"
            :class="limite.actual.estado === 'excedido' ? 'text-negative' : 'text-positive'"
          >
            <template v-if="limite.actual.estado === 'excedido'">
              Te pasaste por {{ formatCurrency(-limite.actual.disponibleRestante) }}
            </template>
            <template v-else>Disponible: {{ formatCurrency(limite.actual.disponibleRestante) }}</template>
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
