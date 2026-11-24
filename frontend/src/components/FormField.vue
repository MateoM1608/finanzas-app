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
      :inputmode="inputmode ?? (type === 'number' ? 'numeric' : undefined)"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <p v-if="hint" class="mt-1.5 text-xs text-ink-tertiary">{{ hint }}</p>
  </div>
</template>
