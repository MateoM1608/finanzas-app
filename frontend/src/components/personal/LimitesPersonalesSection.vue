<script setup>
import { ref, onMounted } from 'vue';
import { obtenerResumenLimites } from '../../api/limitesPersonales.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency } from '../../utils/format.js';
import AlertError from '../AlertError.vue';

const loading = ref(true);
const error = ref('');
const resumen = ref(null);

async function cargar() {
  loading.value = true;
  error.value = '';
  try {
    resumen.value = await obtenerResumenLimites();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(cargar);
defineExpose({ recargar: cargar });
</script>

<template>
  <div>
    <AlertError :message="error" />
    <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>

    <template v-else>
      <p v-if="!resumen.limites.length" class="text-sm text-ink-secondary">
        Aún no tienes límites configurados — créalos con "Configurar límites".
      </p>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          v-for="limite in resumen.limites"
          :key="limite.id"
          class="rounded-xl border px-4 py-3.5"
          :class="
            limite.actual.estado === 'excedido'
              ? 'border-negative/30 bg-negative/10'
              : 'border-positive/30 bg-positive/10'
          "
        >
          <p class="text-ink-primary font-medium flex items-center justify-between gap-2">
            {{ limite.nombre }}
            <span
              class="text-xs font-semibold uppercase px-2 py-0.5 rounded-full"
              :class="limite.actual.estado === 'excedido' ? 'text-negative bg-negative/10' : 'text-positive bg-positive/10'"
            >
              {{ limite.actual.estado === 'excedido' ? 'Excedido' : 'Dentro' }}
            </span>
          </p>
          <p class="text-sm text-ink-secondary mt-1">
            {{ formatCurrency(limite.actual.montoGastado) }} de {{ formatCurrency(limite.actual.limiteCalculado) }}
          </p>
          <p class="text-xs text-ink-tertiary mt-0.5">
            <template v-if="limite.actual.estado === 'excedido'">
              Te pasaste por {{ formatCurrency(-limite.actual.disponibleRestante) }}
            </template>
            <template v-else> Disponible: {{ formatCurrency(limite.actual.disponibleRestante) }} </template>
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
