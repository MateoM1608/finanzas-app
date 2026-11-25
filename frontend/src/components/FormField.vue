<script setup>
import { useId, computed } from 'vue';
import { formatCurrency } from '../utils/format.js';

const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  autocomplete: { type: String, default: 'off' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  inputmode: { type: String, default: undefined },
  hint: { type: String, default: '' },
  // Para números con decimales (ej. una tasa de interés): step="0.01".
  step: { type: String, default: undefined },
});

defineEmits(['update:modelValue']);

const id = useId();
// Un monto en pesos (número entero de 1.000 o más) se muestra formateado
// debajo, para no escribir un cero de más o de menos.
const montoTexto = computed(() => {
  if (props.type !== 'number' || props.step) return '';
  const n = Number(props.modelValue);
  return Number.isInteger(n) && n >= 1000 ? formatCurrency(n) : '';
});
</script>

<template>
  <div>
    <label class="label" :for="id">{{ label }}</label>
    <input
      :id="id"
      class="field"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :required="required"
      :disabled="disabled"
      :step="step"
      :inputmode="inputmode ?? (type === 'number' ? (step ? 'decimal' : 'numeric') : undefined)"
      :aria-describedby="hint ? `${id}-hint` : undefined"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <p v-if="montoTexto" class="mt-1 text-xs font-medium text-ink-secondary" aria-live="polite">{{ montoTexto }}</p>
    <p v-if="hint" :id="`${id}-hint`" class="mt-1.5 text-xs text-ink-tertiary">{{ hint }}</p>
  </div>
</template>
