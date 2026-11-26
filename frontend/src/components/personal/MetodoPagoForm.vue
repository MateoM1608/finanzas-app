<script setup>
import { reactive, computed } from 'vue';
import FormField from '../FormField.vue';
import CamposDolares from './CamposDolares.vue';
import { TIPOS_METODO, hoyISO, aCentavos } from '../../utils/format.js';

/**
 * Formulario de un método de pago personal. Para tarjeta de crédito y
 * crédito de almacén pide los días de corte/pago (sirven para sugerir la
 * fecha de la primera cuota de una compra). Nunca pide el número completo
 * de la tarjeta, el código de seguridad ni la fecha de vencimiento.
 *
 * Punto de partida: lo que hay hoy en la cuenta (sube el Disponible sin ser
 * ingreso) o lo que se debe hoy en la tarjeta (sube su deuda sin ser gasto).
 * Se emite como `saldoInicial` y la vista lo guarda aparte. Una tarjeta
 * puede traer además una deuda en dólares (`montoUsd` en centavos + `trm`).
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
  tasaMensual: props.inicial?.tasaMensual || '',
  sistemaInteres: props.inicial?.sistemaInteres ?? 'capital_fijo',
  saldoMonto: props.inicial?.saldoInicial?.monto ?? '',
  saldoFecha: props.inicial?.saldoInicial?.fecha?.slice(0, 10) ?? hoyISO(),
  debeDolares: Boolean(props.inicial?.saldoInicial?.montoUsd),
  saldoUsd: props.inicial?.saldoInicial?.montoUsd ? String(props.inicial.saldoInicial.montoUsd / 100) : '',
  saldoTrm: props.inicial?.saldoInicial?.trm ? String(props.inicial.saldoInicial.trm) : '',
});

const esTarjeta = computed(() => form.tipo === 'tarjeta_credito');
const esCredito = computed(() => esTarjeta.value || form.tipo === 'credito_almacen');
const llevaUltimos4 = computed(() => esTarjeta.value || form.tipo === 'debito');
const ultimos4Valido = computed(() => !form.ultimos4 || /^\d{4}$/.test(form.ultimos4));
// Un crédito de almacén no lleva saldo inicial: lo que se debe va como compra a cuotas en curso.
const llevaSaldoInicial = computed(() => form.tipo !== 'credito_almacen');

function numeroONull(v) {
  return v === '' || v == null ? null : Number(v);
}

const usdInicial = computed(() => (esTarjeta.value && form.debeDolares ? aCentavos(form.saldoUsd) : null));
const trmInicial = computed(() => Number(String(form.saldoTrm).replace(',', '.')) || null);
const dolaresValidos = computed(() => !(esTarjeta.value && form.debeDolares) || (usdInicial.value && trmInicial.value > 0));

function onSubmit() {
  if (!ultimos4Valido.value || !dolaresValidos.value) return;
  emit('guardar', {
    nombre: form.nombre,
    tipo: form.tipo,
    ultimos4: llevaUltimos4.value ? form.ultimos4 || null : null,
    diaCorte: esTarjeta.value ? numeroONull(form.diaCorte) : null,
    diaPago: esCredito.value ? numeroONull(form.diaPago) : null,
    cupo: esCredito.value ? numeroONull(form.cupo) : null,
    tasaMensual: esCredito.value ? Number(form.tasaMensual) || 0 : 0,
    sistemaInteres: form.sistemaInteres,
    saldoInicial: llevaSaldoInicial.value
      ? {
          monto: Number(form.saldoMonto) || 0,
          fecha: form.saldoFecha || hoyISO(),
          montoUsd: usdInicial.value,
          trm: usdInicial.value ? trmInicial.value : null,
        }
      : { monto: 0, fecha: hoyISO(), montoUsd: null, trm: null },
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
    <FormField
      v-if="esCredito"
      v-model="form.cupo"
      type="number"
      label="Cupo (opcional, COP)"
      :hint="esTarjeta ? 'Uno solo para lo que compres en pesos y en dólares.' : ''"
    />
    <FormField
      v-if="esCredito"
      v-model="form.tasaMensual"
      type="number"
      step="0.01"
      label="Tasa mensual (%)"
      hint="La de tu extracto, ej. 2,1. Vacío o 0 = sin interés."
    />
    <div v-if="esCredito">
      <label class="label" :for="`${idBase}-sistema`">Cómo calcula el banco las cuotas</label>
      <select :id="`${idBase}-sistema`" v-model="form.sistemaInteres" class="field">
        <option value="capital_fijo">Capital fijo + interés sobre lo que falta</option>
        <option value="cuota_fija">Cuota fija</option>
      </select>
    </div>

    <template v-if="llevaSaldoInicial">
      <FormField
        v-model="form.saldoMonto"
        type="number"
        :label="esTarjeta ? 'Lo que debes hoy (opcional, COP)' : 'Saldo de hoy (opcional, COP)'"
        :hint="
          esTarjeta
            ? 'Sin las cuotas que todavía no te cobran: esas van como compra a cuotas en curso.'
            : 'Lo que hay hoy en esta cuenta. Sube tu Disponible y no cuenta como ingreso.'
        "
      />
      <FormField
        v-if="Number(form.saldoMonto) > 0 || (esTarjeta && form.debeDolares)"
        v-model="form.saldoFecha"
        type="date"
        :label="esTarjeta ? 'Fecha de esa deuda' : 'Fecha de ese saldo'"
        required
        hint="Normalmente hoy, el día que empiezas a usar la app."
      />
      <template v-if="esTarjeta">
        <label class="sm:col-span-2 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
          <input v-model="form.debeDolares" type="checkbox" class="checkbox" />
          También debes en dólares hoy
        </label>
        <CamposDolares
          v-if="form.debeDolares"
          v-model:usd="form.saldoUsd"
          v-model:trm="form.saldoTrm"
          class="sm:col-span-2"
          :fecha="form.saldoFecha"
          etiqueta-usd="Lo que debes hoy en dólares (US$)"
          hint-usd="El saldo en dólares de tu extracto, sin cuotas que todavía no te cobran."
        />
      </template>
    </template>

    <p v-if="!ultimos4Valido" class="sm:col-span-2 text-[13px] font-medium text-negative">
      Escribe solo los últimos 4 dígitos.
    </p>
    <p v-if="esCredito" class="sm:col-span-2 text-[13px] text-ink-tertiary">
      Con el día de corte y de pago la app sugiere la fecha de la primera cuota, y la tasa se usa sola en tus compras a
      cuotas con este método (salvo que marques una compra sin interés u otra tasa).
    </p>

    <div class="flex justify-end gap-2 sm:col-span-2">
      <button v-if="inicial" type="button" class="btn-ghost btn-sm" @click="emit('cancelar')">Cancelar</button>
      <button type="submit" class="btn-primary" :class="{ 'btn-sm': inicial }" :disabled="guardando || !ultimos4Valido || !dolaresValidos">
        {{ guardando ? 'Guardando…' : textoGuardar }}
      </button>
    </div>
  </form>
</template>
