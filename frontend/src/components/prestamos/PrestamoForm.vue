<script setup>
import { reactive, computed } from 'vue';
import FormField from '../FormField.vue';
import { formatCurrency, hoyISO } from '../../utils/format.js';

/**
 * Formulario para registrar un préstamo (personal o del hogar): nuevo (monto
 * y plazo) o que ya va en curso (saldo de hoy y cuotas que faltan). La tasa
 * se puede escribir efectiva anual (como la dan los bancos) o mensual.
 */
const props = defineProps({
  ambito: { type: String, required: true },
  metodos: { type: Array, default: () => [] },
  categorias: { type: Array, default: () => [] },
  miembros: { type: Array, default: () => [] },
  usuarioId: { type: String, default: '' },
  guardando: { type: Boolean, default: false },
});
const emit = defineEmits(['guardar', 'cancelar']);

const TIPOS = [
  { valor: 'libre_inversion', label: 'Libre inversión' },
  { valor: 'vehiculo', label: 'Vehículo' },
  { valor: 'vivienda', label: 'Vivienda' },
  { valor: 'educativo', label: 'Educativo' },
  { valor: 'persona', label: 'Con una persona' },
  { valor: 'otro', label: 'Otro' },
];

const form = reactive({
  nombre: '',
  entidad: '',
  tipo: 'libre_inversion',
  enCurso: false,
  montoPrestado: '',
  plazoMeses: '',
  saldoActual: '',
  cuotasRestantes: '',
  cuotasPagadas: '',
  tasa: '',
  tasaEsAnual: true,
  sistemaInteres: 'cuota_fija',
  seguroMensual: '',
  fechaDesembolso: hoyISO(),
  fechaPrimeraCuota: '',
  modoCobro: 'manual',
  metodoPagoId: '',
  pagoUsuarioId: props.usuarioId,
  categoriaId: '',
  registrarDesembolso: false,
  desembolsoMetodoId: '',
});

const esHogar = computed(() => props.ambito === 'hogar');
const pagaYo = computed(() => !esHogar.value || form.pagoUsuarioId === props.usuarioId);
const cuentas = computed(() => props.metodos.filter((m) => m.tipo !== 'tarjeta_credito'));
const categoriasGasto = computed(() => props.categorias.filter((c) => c.aplicaA?.includes('gasto')));

// Vista previa de la cuota (sin seguro), con la misma fórmula del backend.
const tasaMensual = computed(() => {
  const t = Number(form.tasa) || 0;
  return form.tasaEsAnual ? ((1 + t / 100) ** (1 / 12) - 1) * 100 : t;
});
const cuotaEstimada = computed(() => {
  const saldo = Number(form.enCurso ? form.saldoActual : form.montoPrestado) || 0;
  const n = Number(form.enCurso ? form.cuotasRestantes : form.plazoMeses) || 0;
  if (!saldo || !n) return null;
  const r = tasaMensual.value / 100;
  const seguro = Number(form.seguroMensual) || 0;
  if (r <= 0) return Math.round(saldo / n) + seguro;
  if (form.sistemaInteres === 'capital_fijo') return Math.round(saldo / n + saldo * r) + seguro;
  return Math.round((saldo * r) / (1 - (1 + r) ** -n)) + seguro;
});

function numero(v) {
  return v === '' || v == null ? undefined : Number(v);
}

function onSubmit() {
  emit('guardar', {
    ambito: props.ambito,
    nombre: form.nombre,
    entidad: form.entidad || undefined,
    tipo: form.tipo,
    enCurso: form.enCurso,
    ...(form.enCurso
      ? {
          saldoActual: numero(form.saldoActual),
          cuotasRestantes: numero(form.cuotasRestantes),
          cuotasPagadas: numero(form.cuotasPagadas) ?? 0,
          montoPrestado: numero(form.montoPrestado),
        }
      : { montoPrestado: numero(form.montoPrestado), plazoMeses: numero(form.plazoMeses), fechaDesembolso: form.fechaDesembolso || undefined }),
    tasa: Number(form.tasa) || 0,
    tasaEsAnual: form.tasaEsAnual,
    sistemaInteres: form.sistemaInteres,
    seguroMensual: numero(form.seguroMensual) ?? 0,
    fechaPrimeraCuota: form.fechaPrimeraCuota,
    modoCobro: form.modoCobro,
    metodoPagoId: pagaYo.value ? form.metodoPagoId || null : null,
    ...(esHogar.value ? { pagoUsuarioId: form.pagoUsuarioId } : { categoriaId: form.categoriaId || null }),
    ...(!esHogar.value && !form.enCurso && form.registrarDesembolso
      ? { desembolso: { metodoPagoId: form.desembolsoMetodoId || null, fecha: form.fechaDesembolso || undefined } }
      : {}),
  });
}
</script>

<template>
  <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="onSubmit">
    <FormField v-model="form.nombre" label="Nombre" required placeholder="Crédito del carro" />
    <FormField v-model="form.entidad" label="Entidad (opcional)" placeholder="Bancolombia, mi tío…" />
    <div>
      <label class="label" for="prestamo-tipo">Tipo</label>
      <select id="prestamo-tipo" v-model="form.tipo" class="field">
        <option v-for="t in TIPOS" :key="t.valor" :value="t.valor">{{ t.label }}</option>
      </select>
    </div>
    <label class="inline-flex items-center gap-2.5 self-end pb-2.5 text-sm text-ink-secondary cursor-pointer">
      <input v-model="form.enCurso" type="checkbox" class="h-4 w-4 rounded accent-accent" />
      Ya lo vengo pagando
    </label>

    <template v-if="!form.enCurso">
      <FormField v-model="form.montoPrestado" type="number" label="Monto prestado (COP)" required />
      <FormField v-model="form.plazoMeses" type="number" label="Plazo (número de cuotas)" required />
      <FormField v-model="form.fechaDesembolso" type="date" label="Fecha del desembolso" />
    </template>
    <template v-else>
      <FormField v-model="form.saldoActual" type="number" label="Lo que debes hoy (capital)" required hint="Sale en el extracto o la app del banco." />
      <FormField v-model="form.cuotasRestantes" type="number" label="Cuotas que faltan" required />
      <FormField v-model="form.cuotasPagadas" type="number" label="Cuotas ya pagadas (opcional)" />
      <FormField v-model="form.montoPrestado" type="number" label="Monto que te prestaron (opcional)" />
    </template>
    <FormField v-model="form.fechaPrimeraCuota" type="date" :label="form.enCurso ? 'Fecha de la próxima cuota' : 'Fecha de la primera cuota'" required />

    <div class="grid grid-cols-[1fr_auto] gap-2 items-end">
      <FormField v-model="form.tasa" type="number" step="0.01" label="Tasa de interés (%)" placeholder="24,5" />
      <select v-model="form.tasaEsAnual" class="field !w-auto" aria-label="Tipo de tasa">
        <option :value="true">E.A.</option>
        <option :value="false">mensual</option>
      </select>
    </div>
    <div>
      <label class="label" for="prestamo-sistema">Cómo se calculan las cuotas</label>
      <select id="prestamo-sistema" v-model="form.sistemaInteres" class="field">
        <option value="cuota_fija">Cuota fija (todas iguales)</option>
        <option value="capital_fijo">Capital fijo + interés (bajan)</option>
      </select>
    </div>
    <FormField v-model="form.seguroMensual" type="number" label="Seguro mensual (opcional)" hint="Se suma a cada cuota." />

    <div>
      <label class="label" for="prestamo-modo">Cómo se paga cada cuota</label>
      <select id="prestamo-modo" v-model="form.modoCobro" class="field">
        <option value="manual">Manual: lo marco cuando pague</option>
        <option value="automatico">Automático: débito en su fecha</option>
      </select>
    </div>

    <div v-if="esHogar">
      <label class="label" for="prestamo-pagador">Quién paga las cuotas</label>
      <select id="prestamo-pagador" v-model="form.pagoUsuarioId" class="field">
        <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
      </select>
    </div>
    <div v-if="pagaYo">
      <label class="label" for="prestamo-cuenta">Cuenta con que se paga (opcional)</label>
      <select id="prestamo-cuenta" v-model="form.metodoPagoId" class="field">
        <option value="">Sin definir</option>
        <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
      </select>
    </div>
    <div v-if="!esHogar && categoriasGasto.length">
      <label class="label" for="prestamo-categoria">Categoría (opcional)</label>
      <select id="prestamo-categoria" v-model="form.categoriaId" class="field">
        <option value="">Sin categoría</option>
        <option v-for="c in categoriasGasto" :key="c.id" :value="c.id">{{ c.nombre }}</option>
      </select>
    </div>

    <template v-if="!esHogar && !form.enCurso">
      <label class="sm:col-span-2 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
        <input v-model="form.registrarDesembolso" type="checkbox" class="h-4 w-4 rounded accent-accent" />
        El dinero me llegó a una de mis cuentas
      </label>
      <div v-if="form.registrarDesembolso">
        <label class="label" for="prestamo-desembolso">Cuenta</label>
        <select id="prestamo-desembolso" v-model="form.desembolsoMetodoId" class="field">
          <option value="">Sin definir</option>
          <option v-for="m in cuentas" :key="m.id" :value="m.id">{{ m.nombre }}</option>
        </select>
      </div>
    </template>

    <p v-if="cuotaEstimada" class="sm:col-span-2 text-sm text-ink-secondary">
      Cuota aproximada: <span class="font-semibold text-ink-primary">{{ formatCurrency(cuotaEstimada) }}</span>
      <template v-if="form.tasa && form.tasaEsAnual"> · {{ tasaMensual.toFixed(2).replace('.', ',') }} % mensual</template>
    </p>
    <p class="sm:col-span-2 text-xs text-ink-tertiary">
      <template v-if="esHogar">Las cuotas se reparten con el porcentaje del hogar y entran a los cuadres cuando se pagan.</template>
      <template v-else>Las cuotas son gastos obligatorios. El desembolso sube tu Disponible pero no cuenta como ingreso.</template>
    </p>

    <div class="flex justify-end gap-2 sm:col-span-2">
      <button type="button" class="btn-ghost" @click="emit('cancelar')">Cancelar</button>
      <button type="submit" class="btn-primary" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Guardar préstamo' }}</button>
    </div>
  </form>
</template>
