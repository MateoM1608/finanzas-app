<script setup>
import { reactive, ref, computed, watch } from 'vue';
import { formatCurrency } from '../../utils/format.js';

/**
 * Reparto de un gasto del hogar entre los miembros, en % o en pesos (switch).
 * Siempre entrega pesos: v-model = { montos: [{ usuarioId, monto }], valido, cambiado }.
 * En %, los pesos salen del total y lo que sobra por redondeo va al de mayor %.
 * `inicial` (usuarioId → monto) sobre `inicialTotal` (por defecto `total`)
 * llena el reparto actual; sin él, arranca vacío.
 */
const props = defineProps({
  miembros: { type: Array, required: true },
  total: { type: Number, default: 0 },
  inicial: { type: Object, default: null },
  inicialTotal: { type: Number, default: null },
  idPrefijo: { type: String, default: 'reparto' },
});
const emit = defineEmits(['update:modelValue']);

const redondear2 = (x) => Math.round(x * 100) / 100;
const baseInicial = props.inicialTotal ?? props.total;
const pctInicial = Object.fromEntries(
  props.miembros.map((m) => [m.id, props.inicial && baseInicial ? redondear2(((props.inicial[m.id] ?? 0) / baseInicial) * 100) : null]),
);

const modo = ref('pct');
const valores = reactive(Object.fromEntries(props.miembros.map((m) => [m.id, pctInicial[m.id] ?? ''])));

function enPesos(pcts) {
  const total = Number(props.total) || 0;
  const montos = props.miembros.map((m) => ({ usuarioId: m.id, monto: Math.floor((total * (Number(pcts[m.id]) || 0)) / 100) }));
  if (!montos.length) return montos;
  const resto = total - montos.reduce((a, x) => a + x.monto, 0);
  const mayor = props.miembros.reduce((iMax, m, i) => ((Number(pcts[m.id]) || 0) > (Number(pcts[props.miembros[iMax].id]) || 0) ? i : iMax), 0);
  if (resto > 0 && resto < props.miembros.length) montos[mayor].monto += resto;
  return montos;
}

const suma = computed(() => props.miembros.reduce((a, m) => a + (Number(valores[m.id]) || 0), 0));
const valido = computed(() =>
  modo.value === 'pct'
    ? Number(props.total) > 0 && Math.abs(suma.value - 100) < 0.011
    : Number(props.total) > 0 && suma.value === Number(props.total),
);
const montos = computed(() =>
  modo.value === 'pct' ? enPesos(valores) : props.miembros.map((m) => ({ usuarioId: m.id, monto: Number(valores[m.id]) || 0 })),
);
// ¿Cambió frente al reparto con que se abrió? (en %, con tolerancia de redondeo)
const cambiado = computed(() => {
  if (!props.inicial) return true;
  const total = Number(props.total) || 0;
  return montos.value.some((x) => Math.abs((total ? (x.monto / total) * 100 : 0) - (pctInicial[x.usuarioId] ?? 0)) > 0.011);
});

function cambiarModo(nuevo) {
  if (nuevo === modo.value) return;
  const total = Number(props.total) || 0;
  for (const m of props.miembros) {
    const v = valores[m.id];
    if (v === '' || v === null) continue;
    valores[m.id] = nuevo === 'pesos' ? Math.round((total * Number(v)) / 100) : total ? redondear2((Number(v) / total) * 100) : '';
  }
  modo.value = nuevo;
}

watch([montos, valido, cambiado], () => emit('update:modelValue', { montos: montos.value, valido: valido.value, cambiado: cambiado.value }), {
  immediate: true,
});
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between gap-3">
      <span class="text-[13px] font-medium text-ink-secondary">Cuánto le toca a cada uno</span>
      <div class="inline-flex rounded-full border border-border p-0.5 text-xs" role="group" aria-label="Reparto en porcentaje o en pesos">
        <button
          type="button"
          class="rounded-full px-3 py-1"
          :class="modo === 'pct' ? 'bg-accent text-accent-on font-semibold' : 'text-ink-secondary'"
          :aria-pressed="modo === 'pct'"
          @click="cambiarModo('pct')"
        >
          %
        </button>
        <button
          type="button"
          class="rounded-full px-3 py-1"
          :class="modo === 'pesos' ? 'bg-accent text-accent-on font-semibold' : 'text-ink-secondary'"
          :aria-pressed="modo === 'pesos'"
          @click="cambiarModo('pesos')"
        >
          $
        </button>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div v-for="m in miembros" :key="m.id" class="flex items-center justify-between gap-3">
        <label :for="`${idPrefijo}-${m.id}`" class="truncate text-sm text-ink-primary">{{ m.nombre }}</label>
        <div class="relative">
          <input
            :id="`${idPrefijo}-${m.id}`"
            v-model="valores[m.id]"
            type="number"
            :step="modo === 'pct' ? '0.01' : '1'"
            :inputmode="modo === 'pct' ? 'decimal' : 'numeric'"
            class="field !w-36 !pr-8 text-right"
          />
          <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-tertiary">
            {{ modo === 'pct' ? '%' : '$' }}
          </span>
        </div>
      </div>
    </div>
    <p class="mt-2 text-[13px] font-medium" :class="valido ? 'text-positive' : 'text-negative'">
      <template v-if="modo === 'pct'">
        Suma: {{ redondear2(suma) }} %<template v-if="!valido"> · tiene que dar 100 %</template>
        <template v-else-if="total"> · {{ montos.map((x) => formatCurrency(x.monto)).join(' + ') }}</template>
      </template>
      <template v-else>
        Suma: {{ formatCurrency(suma) }}<template v-if="total"> de {{ formatCurrency(Number(total)) }}</template>
      </template>
    </p>
  </div>
</template>
