<script setup>
import { useId } from 'vue';

defineProps({
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
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <p v-if="hint" class="mt-1.5 text-xs text-ink-tertiary">{{ hint }}</p>
  </div>
</template>
