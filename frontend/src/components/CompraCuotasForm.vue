<script setup>
import { reactive, computed, watch } from 'vue';
import FormField from './FormField.vue';
import CamposDolares from './personal/CamposDolares.vue';
import { formatCurrency, aCentavos } from '../utils/format.js';

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
  conInteres: (c.tasaMensual ?? 0) > 0,
  tasaMensual: c.tasaMensual || '',
  sistemaInteres: c.sistemaInteres ?? 'capital_fijo',
  cuotasPagadasAntes: c.cuotasPagadasAntes ?? 0,
  // Compra personal en dólares (con tarjeta de crédito).
  enDolares: Boolean(c.montoUsd),
  usd: c.montoUsd ? String(c.montoUsd / 100) : '',
  trm: c.trm ? String(c.trm) : '',
});

// Reparto del hogar en %: el que tienen hoy sus cuotas (el mismo en todas).
const redondear2 = (x) => Math.round(x * 100) / 100;
const primeraCuota = c.cuotas?.[0];
const pctOriginal = Object.fromEntries(
  props.miembros.map((m) => {
    const r = primeraCuota?.repartos?.find((x) => x.usuarioId === m.id);
    return [m.id, r && primeraCuota.valorTotal ? redondear2((r.monto / primeraCuota.valorTotal) * 100) : 0];
  }),
);
const reparto = reactive({ ...pctOriginal });
const sumaReparto = computed(() => redondear2(props.miembros.reduce((a, m) => a + (Number(reparto[m.id]) || 0), 0)));
const repartoValido = computed(() => props.tipo !== 'hogar' || Math.abs(sumaReparto.value - 100) < 0.011);
const cambiaReparto = computed(
  () => props.tipo === 'hogar' && props.miembros.some((m) => (Number(reparto[m.id]) || 0) !== pctOriginal[m.id]),
);
// Pasa los % a pesos del valor total; lo que sobra por redondeo va al de mayor %.
function repartoEnPesos(total) {
  const filas = props.miembros.map((m) => ({ usuarioId: m.id, pct: Number(reparto[m.id]) || 0 }));
  const montos = filas.map((f) => ({ usuarioId: f.usuarioId, monto: Math.floor((total * f.pct) / 100) }));
  const resto = total - montos.reduce((a, x) => a + x.monto, 0);
  const mayor = filas.reduce((iMax, f, i) => (f.pct > filas[iMax].pct ? i : iMax), 0);
  montos[mayor].monto += resto;
  return montos;
}

const conTarjeta = computed(
  () => props.tipo === 'personal' && props.metodos.find((m) => m.id === form.metodoPagoId)?.tipo === 'tarjeta_credito',
);
watch(conTarjeta, (si) => {
  if (!si) form.enDolares = false;
});
const usdCentavos = computed(() => (form.enDolares ? aCentavos(form.usd) : null));
const trmNum = computed(() => Number(String(form.trm).replace(',', '.')) || null);
watch([usdCentavos, trmNum], ([u, t]) => {
  if (u && t) form.montoTotal = Math.round((u * t) / 100);
});
const dolaresValidos = computed(() => !form.enDolares || (usdCentavos.value && trmNum.value > 0));

// Las activas, más la que ya tenía (aunque se haya desactivado).
const categoriasVisibles = computed(() => props.categorias.filter((x) => x.activo !== false || x.id === c.categoriaId));

const pagaYo = computed(() => props.tipo === 'personal' || form.pagoUsuarioId === props.usuarioActualId);
const valorCuota = computed(() =>
  Number(form.numeroCuotas) >= 1 ? Math.floor(Number(form.montoTotal) / Number(form.numeroCuotas)) : null,
);
const cambiaCuotas = computed(
  () =>
    Number(form.montoTotal) !== c.montoTotal ||
    Number(form.numeroCuotas) !== c.numeroCuotas ||
    form.fechaPrimeraCuota !== c.fechaPrimeraCuota.slice(0, 10) ||
    form.modoCobro !== c.modoCobro ||
    (form.conInteres ? Number(form.tasaMensual) || 0 : 0) !== (c.tasaMensual ?? 0) ||
    (form.conInteres && form.sistemaInteres !== c.sistemaInteres) ||
    (props.tipo === 'hogar' && form.pagoUsuarioId !== c.pagoUsuarioId) ||
    Number(form.cuotasPagadasAntes) !== (c.cuotasPagadasAntes ?? 0) ||
    (usdCentavos.value ?? null) !== (c.montoUsd ?? null) ||
    (form.enDolares && trmNum.value !== c.trm) ||
    cambiaReparto.value,
);

function onSubmit() {
  const payload = {
    montoTotal: Number(form.montoTotal),
    numeroCuotas: Number(form.numeroCuotas),
    fechaPrimeraCuota: form.fechaPrimeraCuota,
    modoCobro: form.modoCobro,
    tasaMensual: form.conInteres ? Number(form.tasaMensual) || 0 : 0,
    sistemaInteres: form.sistemaInteres,
    cuotasPagadasAntes: Number(form.cuotasPagadasAntes) || 0,
  };
  if (props.tipo === 'personal') {
    Object.assign(payload, {
      descripcion: form.nombre,
      metodoPagoId: form.metodoPagoId || null,
      categoriaId: form.categoriaId || null,
      esObligatorio: form.esObligatorio,
      montoUsd: usdCentavos.value,
      trm: form.enDolares ? trmNum.value : null,
    });
  } else {
    Object.assign(payload, {
      item: form.nombre,
      fechaCompra: form.fechaCompra,
      pagoUsuarioId: form.pagoUsuarioId,
      categoriaId: form.categoriaId || null,
    });
    if (pagaYo.value) payload.metodoPagoId = form.metodoPagoId || null;
    if (cambiaReparto.value) payload.repartos = repartoEnPesos(Number(form.montoTotal));
  }
  emit('guardar', payload);
}
</script>

<template>
  <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="onSubmit">
    <div class="sm:col-span-2">
      <FormField v-model="form.nombre" :label="tipo === 'personal' ? 'Descripción' : 'Ítem'" required />
    </div>
    <FormField
      v-model="form.montoTotal"
      type="number"
      label="Valor total (COP)"
      required
      :disabled="form.enDolares"
      :hint="form.enDolares ? 'Sale de los dólares y la tasa.' : ''"
    />
    <FormField v-model="form.numeroCuotas" type="number" label="Número de cuotas" required />
    <FormField v-if="tipo === 'hogar'" v-model="form.fechaCompra" type="date" label="Fecha de la compra" required />
    <FormField
      v-model="form.cuotasPagadasAntes"
      type="number"
      label="Cuotas pagadas antes de registrarla"
      hint="0 si la registraste desde la primera cuota."
    />
    <FormField
      v-model="form.fechaPrimeraCuota"
      type="date"
      :label="Number(form.cuotasPagadasAntes) > 0 ? 'Fecha de la próxima cuota' : 'Primera cuota'"
      required
    />
    <div>
      <label class="label" :for="`compra-${compra.id}-modo`">Cómo se paga cada cuota</label>
      <select :id="`compra-${compra.id}-modo`" v-model="form.modoCobro" class="field">
        <option value="automatico">Automático (tarjeta o débito)</option>
        <option value="manual">Manual (se marca al pagar)</option>
      </select>
    </div>
    <label class="sm:col-span-2 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
      <input v-model="form.conInteres" type="checkbox" class="checkbox" />
      Tiene interés
    </label>
    <template v-if="form.conInteres">
      <FormField v-model="form.tasaMensual" type="number" step="0.01" label="Tasa mensual (%)" required />
      <div>
        <label class="label" :for="`compra-${compra.id}-sistema`">Cómo se calcula</label>
        <select :id="`compra-${compra.id}-sistema`" v-model="form.sistemaInteres" class="field">
          <option value="capital_fijo">Capital fijo + interés sobre lo que falta</option>
          <option value="cuota_fija">Cuota fija</option>
        </select>
      </div>
    </template>
    <div v-if="tipo === 'hogar'">
      <label class="label" :for="`compra-${compra.id}-pagador`">Quién paga</label>
      <select :id="`compra-${compra.id}-pagador`" v-model="form.pagoUsuarioId" class="field">
        <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
      </select>
    </div>
    <div v-if="tipo === 'hogar'">
      <label class="label" :for="`compra-${compra.id}-categoria-hogar`">Categoría del hogar</label>
      <select :id="`compra-${compra.id}-categoria-hogar`" v-model="form.categoriaId" class="field">
        <option value="">Sin categoría</option>
        <option v-for="cat in categoriasVisibles" :key="cat.id" :value="cat.id">{{ cat.nombre }}</option>
      </select>
    </div>
    <fieldset v-if="tipo === 'hogar' && miembros.length > 1" class="sm:col-span-2">
      <legend class="label">Reparto (% de cada uno)</legend>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FormField
          v-for="m in miembros"
          :key="m.id"
          v-model="reparto[m.id]"
          type="number"
          step="0.01"
          :label="m.nombre"
        />
      </div>
      <p
        class="mt-2 text-[13px] font-medium"
        :class="repartoValido ? 'text-ink-tertiary' : 'text-negative'"
      >
        Suma: {{ sumaReparto }} %<template v-if="!repartoValido"> · tiene que dar 100 %</template>
      </p>
    </fieldset>
    <div v-if="pagaYo">
      <label class="label" :for="`compra-${compra.id}-metodo`">
        {{ tipo === 'hogar' ? 'Tu método de pago (solo lo ves tú)' : 'Método de pago' }}
      </label>
      <select :id="`compra-${compra.id}-metodo`" v-model="form.metodoPagoId" class="field">
        <option value="">Sin definir</option>
        <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
      </select>
    </div>
    <template v-if="conTarjeta">
      <label class="sm:col-span-2 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
        <input v-model="form.enDolares" type="checkbox" class="checkbox" />
        Compra en dólares
      </label>
      <CamposDolares
        v-if="form.enDolares"
        v-model:usd="form.usd"
        v-model:trm="form.trm"
        class="sm:col-span-2"
        etiqueta-usd="Valor total en dólares (US$)"
      />
    </template>
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
      nombre{{ tipo === 'personal' ? ', la categoría, el método o si es obligatoria' : ', la categoría o el método de pago' }}.
    </p>

    <div class="flex justify-end gap-2 sm:col-span-2">
      <button type="button" class="btn-ghost" @click="emit('cancelar')">Cancelar</button>
      <button type="submit" class="btn-primary" :disabled="guardando || !dolaresValidos || !repartoValido">
        {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
      </button>
    </div>
  </form>
</template>
