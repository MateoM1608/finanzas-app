<script setup>
import { reactive, ref, computed, watch } from 'vue';
import { actualizarGasto } from '../../api/gastosPersonales.js';
import { actualizarIngreso } from '../../api/ingresosPersonales.js';
import { extractErrorMessage } from '../../api/client.js';
import AppModal from '../AppModal.vue';
import AlertError from '../AlertError.vue';
import FormField from '../FormField.vue';
import CamposDolares from './CamposDolares.vue';
import { aCentavos } from '../../utils/format.js';

/**
 * Editar un gasto o ingreso suelto: descripción, valor, fecha, categoría,
 * cuenta y (gasto) si es obligatorio. Los movimientos del hogar, de
 * préstamos, compras a cuotas, ahorros o inversiones se editan en su pantalla.
 */
const props = defineProps({
  tipo: { type: String, required: true }, // 'gasto' | 'ingreso'
  movimiento: { type: Object, required: true },
  categorias: { type: Array, default: () => [] },
  metodos: { type: Array, default: () => [] },
});
const emit = defineEmits(['cerrar', 'guardado']);

const m = props.movimiento;
const form = reactive({
  descripcion: m.descripcion ?? '',
  monto: m.monto,
  fecha: String(m.fecha).slice(0, 10),
  categoriaId: m.categoriaId ?? '',
  metodoPagoId: m.metodoPagoId ?? '',
  esObligatorio: Boolean(m.esObligatorio),
  // Compra en dólares con tarjeta de crédito.
  enDolares: Boolean(m.montoUsd),
  usd: m.montoUsd ? String(m.montoUsd / 100) : '',
  trm: m.trm ? String(m.trm) : '',
});
const guardando = ref(false);
const error = ref('');
const esGasto = computed(() => props.tipo === 'gasto');
// Un ingreso no entra a una tarjeta de crédito.
const cuentas = computed(() => (esGasto.value ? props.metodos : props.metodos.filter((x) => x.tipo !== 'tarjeta_credito')));
const conTarjeta = computed(() => esGasto.value && cuentas.value.find((x) => x.id === form.metodoPagoId)?.tipo === 'tarjeta_credito');
watch(conTarjeta, (si) => {
  if (!si) form.enDolares = false;
});
// Al cambiar dólares o tasa, el valor en pesos se recalcula (y se puede corregir).
watch(
  () => [form.enDolares, form.usd, form.trm],
  ([en, usd, trm], antes) => {
    if (!en || !antes || (usd === antes[1] && trm === antes[2] && en === antes[0])) return;
    const u = Number(String(usd).replace(',', '.'));
    const t = Number(String(trm).replace(',', '.'));
    if (u > 0 && t > 0) form.monto = Math.round(u * t);
  },
);
const dolaresValidos = computed(() => !form.enDolares || (aCentavos(form.usd) && Number(form.trm) > 0));
const categoriasDelTipo = computed(() => props.categorias.filter((c) => c.aplicaA?.includes(props.tipo)));

async function guardar() {
  guardando.value = true;
  error.value = '';
  try {
    const payload = {
      descripcion: form.descripcion.trim() || null,
      monto: Number(form.monto),
      fecha: form.fecha,
      categoriaId: form.categoriaId || null,
      metodoPagoId: form.metodoPagoId || null,
      ...(esGasto.value && { esObligatorio: form.esObligatorio }),
      ...(esGasto.value &&
        (form.enDolares
          ? { montoUsd: aCentavos(form.usd), trm: Number(String(form.trm).replace(',', '.')) }
          : m.montoUsd
            ? { montoUsd: null }
            : {})),
    };
    const actualizado = esGasto.value ? await actualizarGasto(m.id, payload) : await actualizarIngreso(m.id, payload);
    emit('guardado', actualizado);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <AppModal :title="esGasto ? 'Editar gasto' : 'Editar ingreso'" @close="emit('cerrar')">
    <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="guardar">
      <AlertError :message="error" class="sm:col-span-2" />
      <FormField v-model="form.descripcion" label="Descripción" class="sm:col-span-2" />
      <FormField v-model="form.monto" type="number" :label="form.enDolares ? 'Valor en pesos (COP)' : 'Valor (COP)'" required />
      <FormField v-model="form.fecha" type="date" label="Fecha" required />
      <div>
        <label class="label" for="editar-mov-categoria">Categoría</label>
        <select id="editar-mov-categoria" v-model="form.categoriaId" class="field">
          <option value="">Sin categoría</option>
          <option v-for="c in categoriasDelTipo" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="editar-mov-cuenta">{{ esGasto ? 'Con qué pagaste' : 'Dónde entró' }}</label>
        <select id="editar-mov-cuenta" v-model="form.metodoPagoId" class="field">
          <option value="">Sin definir</option>
          <option v-for="c in cuentas" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
      </div>
      <template v-if="conTarjeta">
        <label class="sm:col-span-2 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
          <input v-model="form.enDolares" type="checkbox" class="h-4 w-4 rounded accent-accent" />
          Compra en dólares
        </label>
        <CamposDolares v-if="form.enDolares" v-model:usd="form.usd" v-model:trm="form.trm" class="sm:col-span-2" :fecha="form.fecha" />
      </template>
      <label v-if="esGasto" class="sm:col-span-2 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
        <input v-model="form.esObligatorio" type="checkbox" class="h-4 w-4 rounded accent-accent" />
        Es un gasto obligatorio
      </label>
      <p v-if="m.origenConfigId" class="sm:col-span-2 text-xs text-ink-tertiary">
        Viene de un gasto o ingreso fijo: el cambio aplica solo a esta vez.
      </p>
      <div class="flex justify-end gap-2 sm:col-span-2">
        <button type="button" class="btn-ghost" @click="emit('cerrar')">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="guardando || !dolaresValidos">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
      </div>
    </form>
  </AppModal>
</template>
