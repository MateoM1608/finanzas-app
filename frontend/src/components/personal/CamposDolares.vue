<script setup>
import { ref, computed, watch } from 'vue';
import { obtenerTrm } from '../../api/metodosPagoPersonales.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import FormField from '../FormField.vue';

/**
 * Valor en dólares y tasa de cambio de una compra con tarjeta de crédito.
 * La tasa se sugiere con la TRM oficial de la fecha (mientras no se escriba
 * a mano). `pesos` es el equivalente redondeado, para que el formulario lo
 * ponga en su monto en pesos.
 */
const props = defineProps({
  usd: { type: [String, Number], default: '' },
  trm: { type: [String, Number], default: '' },
  // Fecha de la compra (YYYY-MM-DD): la TRM sugerida es la de ese día.
  fecha: { type: String, default: '' },
  etiquetaUsd: { type: String, default: 'Valor en dólares (US$)' },
  hintUsd: { type: String, default: '' },
});
const emit = defineEmits(['update:usd', 'update:trm']);

const tocada = ref(Boolean(props.trm));
const sugerencia = ref(null);
const cargando = ref(false);

async function sugerir() {
  if (tocada.value) return;
  cargando.value = true;
  try {
    sugerencia.value = await obtenerTrm(props.fecha || undefined);
    if (sugerencia.value && !tocada.value) emit('update:trm', String(sugerencia.value.valor));
  } catch {
    sugerencia.value = null;
  } finally {
    cargando.value = false;
  }
}
watch(() => props.fecha, sugerir, { immediate: true });

function onTrm(valor) {
  tocada.value = true;
  emit('update:trm', valor);
}

const pesos = computed(() => {
  const usd = Number(String(props.usd).replace(',', '.'));
  const trm = Number(String(props.trm).replace(',', '.'));
  return usd > 0 && trm > 0 ? Math.round(usd * trm) : null;
});

const hintTrm = computed(() => {
  if (cargando.value) return 'Buscando la TRM…';
  if (tocada.value) return 'Escrita por ti.';
  if (sugerencia.value?.fuente === 'oficial') return `TRM oficial del ${formatDate(sugerencia.value.vigencia)}; cámbiala si tu banco usó otra.`;
  if (sugerencia.value) return 'La última tasa que usaste (no se pudo consultar la TRM).';
  return 'No se pudo consultar la TRM: escribe la tasa.';
});
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <FormField
      :model-value="usd"
      type="number"
      step="0.01"
      :label="etiquetaUsd"
      required
      placeholder="25,99"
      :hint="hintUsd"
      @update:model-value="emit('update:usd', $event)"
    />
    <FormField
      :model-value="trm"
      type="number"
      step="0.01"
      label="Tasa (pesos por dólar)"
      required
      :hint="hintTrm"
      @update:model-value="onTrm"
    />
    <p v-if="pesos" class="sm:col-span-2 -mt-2 text-[13px] text-ink-secondary" aria-live="polite">
      ≈ {{ formatCurrency(pesos) }} en pesos
    </p>
  </div>
</template>
