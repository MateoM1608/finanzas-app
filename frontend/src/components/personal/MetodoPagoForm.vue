<script setup>
import { reactive, computed } from 'vue';
import FormField from '../FormField.vue';
import { TIPOS_METODO } from '../../utils/format.js';

/**
 * Formulario de un método de pago personal. Para tarjeta de crédito y
 * crédito de almacén pide los días de corte/pago (sirven para sugerir la
 * fecha de la primera cuota de una compra). Nunca pide el número completo
 * de la tarjeta, el código de seguridad ni la fecha de vencimiento.
 */
const props = defineProps({
  inicial: { type: Object, default: null },
  guardando: { type: Boolean, default: false },
  textoGuardar: { type: String, default: 'Guardar' },
  idBase: { type: String, default: 'metodo' },
});
const emit = defineEmits(['guardar', 'cancelar']);

const form = reactive({
  nombre: props.inicial?.nombre ?? '',
  tipo: props.inicial?.tipo ?? 'debito',
  ultimos4: props.inicial?.ultimos4 ?? '',
  diaCorte: props.inicial?.diaCorte ?? '',
  diaPago: props.inicial?.diaPago ?? '',
  cupo: props.inicial?.cupo ?? '',
});

const esTarjeta = computed(() => form.tipo === 'tarjeta_credito');
const esCredito = computed(() => esTarjeta.value || form.tipo === 'credito_almacen');
const llevaUltimos4 = computed(() => esTarjeta.value || form.tipo === 'debito');
const ultimos4Valido = computed(() => !form.ultimos4 || /^\d{4}$/.test(form.ultimos4));

function numeroONull(v) {
  return v === '' || v == null ? null : Number(v);
}

function onSubmit() {
  if (!ultimos4Valido.value) return;
  emit('guardar', {
    nombre: form.nombre,
    tipo: form.tipo,
    ultimos4: llevaUltimos4.value ? form.ultimos4 || null : null,
    diaCorte: esTarjeta.value ? numeroONull(form.diaCorte) : null,
    diaPago: esCredito.value ? numeroONull(form.diaPago) : null,
    cupo: esCredito.value ? numeroONull(form.cupo) : null,
  });
}
</script>

<template>
  <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="onSubmit">
    <FormField v-model="form.nombre" label="Nombre" required placeholder="Visa Bancolombia, Nequi…" />
    <div>
      <label class="label" :for="`${idBase}-tipo`">Tipo</label>
      <select :id="`${idBase}-tipo`" v-model="form.tipo" class="field">
        <option v-for="t in TIPOS_METODO" :key="t.valor" :value="t.valor">{{ t.label }}</option>
      </select>
    </div>

    <FormField
      v-if="llevaUltimos4"
      v-model="form.ultimos4"
      label="Últimos 4 dígitos (opcional)"
      inputmode="numeric"
      placeholder="1234"
      hint="Solo para reconocerla. Nunca escribas el número completo."
    />
    <FormField v-if="esTarjeta" v-model="form.diaCorte" type="number" label="Día de corte" placeholder="25" />
    <FormField v-if="esCredito" v-model="form.diaPago" type="number" label="Día de pago" placeholder="10" />
    <FormField v-if="esCredito" v-model="form.cupo" type="number" label="Cupo (opcional, COP)" />

    <p v-if="!ultimos4Valido" class="sm:col-span-2 text-[13px] font-medium text-negative">
      Escribe solo los últimos 4 dígitos.
    </p>
    <p v-if="esCredito" class="sm:col-span-2 text-[13px] text-ink-tertiary">
      Con el día de corte y de pago la app sugiere sola la fecha de la primera cuota de tus compras a cuotas.
    </p>

    <div class="flex justify-end gap-2 sm:col-span-2">
      <button v-if="inicial" type="button" class="btn-ghost btn-sm" @click="emit('cancelar')">Cancelar</button>
      <button type="submit" class="btn-primary" :class="{ 'btn-sm': inicial }" :disabled="guardando || !ultimos4Valido">
        {{ guardando ? 'Guardando…' : textoGuardar }}
      </button>
    </div>
  </form>
</template>
