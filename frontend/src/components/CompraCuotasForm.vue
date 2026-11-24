<script setup>
import { reactive, computed } from 'vue';
import FormField from './FormField.vue';
import { formatCurrency } from '../utils/format.js';

/**
 * Formulario de edición de una compra a cuotas, personal o del hogar.
 * Cambiar monto, número de cuotas, fechas, modo de cobro o quién paga
 * recalcula todas las cuotas (el backend lo bloquea si ya hay pagos que se
 * perderían); el resto se aplica a las cuotas existentes.
 */
const props = defineProps({
  tipo: { type: String, required: true }, // 'personal' | 'hogar'
  compra: { type: Object, required: true },
  metodos: { type: Array, default: () => [] }, // los del usuario actual
  categorias: { type: Array, default: () => [] },
  miembros: { type: Array, default: () => [] },
  usuarioActualId: { type: String, default: '' },
  guardando: { type: Boolean, default: false },
});
const emit = defineEmits(['guardar', 'cancelar']);

const c = props.compra;
const form = reactive({
  nombre: props.tipo === 'personal' ? c.descripcion : c.item,
  montoTotal: c.montoTotal,
  numeroCuotas: c.numeroCuotas,
  fechaCompra: c.fechaCompra ? c.fechaCompra.slice(0, 10) : '',
  fechaPrimeraCuota: c.fechaPrimeraCuota.slice(0, 10),
  modoCobro: c.modoCobro,
  metodoPagoId: c.metodoPagoId ?? '',
  categoriaId: c.categoriaId ?? '',
  esObligatorio: c.esObligatorio ?? true,
  pagoUsuarioId: c.pagoUsuarioId ?? '',
});

const pagaYo = computed(() => props.tipo === 'personal' || form.pagoUsuarioId === props.usuarioActualId);
const valorCuota = computed(() =>
  Number(form.numeroCuotas) >= 2 ? Math.floor(Number(form.montoTotal) / Number(form.numeroCuotas)) : null,
);
const cambiaCuotas = computed(
  () =>
    Number(form.montoTotal) !== c.montoTotal ||
    Number(form.numeroCuotas) !== c.numeroCuotas ||
    form.fechaPrimeraCuota !== c.fechaPrimeraCuota.slice(0, 10) ||
    form.modoCobro !== c.modoCobro ||
    (props.tipo === 'hogar' && form.pagoUsuarioId !== c.pagoUsuarioId),
);

function onSubmit() {
  const payload = {
    montoTotal: Number(form.montoTotal),
    numeroCuotas: Number(form.numeroCuotas),
    fechaPrimeraCuota: form.fechaPrimeraCuota,
    modoCobro: form.modoCobro,
  };
  if (props.tipo === 'personal') {
    Object.assign(payload, {
      descripcion: form.nombre,
      metodoPagoId: form.metodoPagoId || null,
      categoriaId: form.categoriaId || null,
      esObligatorio: form.esObligatorio,
    });
  } else {
    Object.assign(payload, { item: form.nombre, fechaCompra: form.fechaCompra, pagoUsuarioId: form.pagoUsuarioId });
    if (pagaYo.value) payload.metodoPagoId = form.metodoPagoId || null;
  }
  emit('guardar', payload);
}
</script>

<template>
  <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="onSubmit">
    <div class="sm:col-span-2">
      <FormField v-model="form.nombre" :label="tipo === 'personal' ? 'Descripción' : 'Ítem'" required />
    </div>
    <FormField v-model="form.montoTotal" type="number" label="Valor total (COP)" required />
    <FormField v-model="form.numeroCuotas" type="number" label="Número de cuotas" required />
    <FormField v-if="tipo === 'hogar'" v-model="form.fechaCompra" type="date" label="Fecha de la compra" required />
    <FormField v-model="form.fechaPrimeraCuota" type="date" label="Primera cuota" required />
    <div>
      <label class="label" :for="`compra-${compra.id}-modo`">Cómo se paga cada cuota</label>
      <select :id="`compra-${compra.id}-modo`" v-model="form.modoCobro" class="field">
        <option value="automatico">Automático (tarjeta o débito)</option>
        <option value="manual">Manual (se marca al pagar)</option>
      </select>
    </div>
    <div v-if="tipo === 'hogar'">
      <label class="label" :for="`compra-${compra.id}-pagador`">Quién paga</label>
      <select :id="`compra-${compra.id}-pagador`" v-model="form.pagoUsuarioId" class="field">
        <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
      </select>
    </div>
    <div v-if="pagaYo">
      <label class="label" :for="`compra-${compra.id}-metodo`">
        {{ tipo === 'hogar' ? 'Tu método de pago (solo lo ves tú)' : 'Método de pago' }}
      </label>
      <select :id="`compra-${compra.id}-metodo`" v-model="form.metodoPagoId" class="field">
        <option value="">Sin definir</option>
        <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
      </select>
    </div>
    <template v-if="tipo === 'personal'">
      <div>
        <label class="label" :for="`compra-${compra.id}-categoria`">Categoría</label>
        <select :id="`compra-${compra.id}-categoria`" v-model="form.categoriaId" class="field">
          <option value="">Sin definir</option>
          <option v-for="cat in categorias" :key="cat.id" :value="cat.id">{{ cat.nombre }}</option>
        </select>
      </div>
      <label class="flex items-center gap-2.5 self-end rounded-xl border border-border px-3.5 py-2.5 text-sm text-ink-secondary cursor-pointer">
        <input v-model="form.esObligatorio" type="checkbox" class="checkbox" />
        Es obligatoria
      </label>
    </template>

    <p class="sm:col-span-2 text-[13px] text-ink-secondary">
      <template v-if="valorCuota">≈ {{ formatCurrency(valorCuota) }} por cuota. </template>
      <span v-if="cambiaCuotas" class="font-medium text-warning">
        Esto recalcula todas las cuotas.
      </span>
    </p>
    <p class="sm:col-span-2 text-[13px] text-ink-tertiary">
      Si ya hay cuotas {{ tipo === 'hogar' ? 'cuadradas o' : '' }} marcadas como pagadas a mano, solo se puede cambiar el
      nombre{{ tipo === 'personal' ? ', la categoría, el método o si es obligatoria' : ' o el método de pago' }}.
    </p>

    <div class="flex justify-end gap-2 sm:col-span-2">
      <button type="button" class="btn-ghost" @click="emit('cancelar')">Cancelar</button>
      <button type="submit" class="btn-primary" :disabled="guardando">
        {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
      </button>
    </div>
  </form>
</template>
