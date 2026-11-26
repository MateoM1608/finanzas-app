<script setup>
import { reactive, computed, ref, onMounted } from 'vue';
import { hoyISO } from '../../utils/format.js';
import { useAuthStore } from '../../stores/auth.js';
import { listarMetodosPago } from '../../api/metodosPagoPersonales.js';
import FormField from '../FormField.vue';

/**
 * Formulario de una cuenta fija del hogar (crear o editar): nombre, monto
 * fijo o variable, responsable y calendario propio (mensual o quincenal,
 * día(s) del mes, desde cuándo).
 */
const props = defineProps({
  inicial: { type: Object, default: null },
  miembros: { type: Array, default: () => [] },
  categorias: { type: Array, default: () => [] }, // del hogar (E4)
  guardando: { type: Boolean, default: false },
  textoGuardar: { type: String, default: 'Guardar' },
  idBase: { type: String, default: 'cuenta' },
});
const emit = defineEmits(['guardar', 'cancelar']);

// '' en un select de día = último día del mes (null en el backend).
function diaAString(dia) {
  return dia == null ? '' : String(dia);
}

const form = reactive({
  nombre: props.inicial?.nombre ?? '',
  tipoMonto: props.inicial?.tipoMonto ?? 'fijo',
  montoDefault: props.inicial?.montoDefault ?? '',
  responsableUsuarioId: props.inicial?.responsableUsuarioId ?? '',
  categoriaId: props.inicial?.categoriaId ?? '',
  frecuencia: props.inicial?.frecuencia ?? 'mensual',
  diaMes: props.inicial ? diaAString(props.inicial.diaMes) : '',
  diaMes2: props.inicial ? diaAString(props.inicial.diaMes2) : '',
  fechaInicio: props.inicial?.fechaInicio ? props.inicial.fechaInicio.slice(0, 10) : hoyISO(),
  pagoAutomatico: props.inicial?.pagoAutomatico ?? false,
  metodoPagoAutomaticoId: props.inicial?.metodoPagoAutomaticoId ?? '',
});
if (!props.inicial && form.frecuencia === 'quincenal') form.diaMes = '15';

// Pago automático: solo monto fijo y con responsable. El método (cuenta o
// tarjeta) es privado del responsable: solo él lo ve y lo elige.
const auth = useAuthStore();
const misMetodos = ref([]);
onMounted(async () => {
  try {
    misMetodos.value = (await listarMetodosPago()).filter((m) => m.activo !== false);
  } catch {
    misMetodos.value = [];
  }
});
const puedeSerAutomatica = computed(() => form.tipoMonto === 'fijo' && Boolean(form.responsableUsuarioId));
const soyResponsable = computed(() => form.responsableUsuarioId === auth.usuario?.id);
const nombreResponsable = computed(
  () => props.miembros.find((m) => m.id === form.responsableUsuarioId)?.nombre?.split(' ')[0] ?? 'el responsable',
);
const activaDesdeAntes = computed(() => Boolean(props.inicial?.pagoAutomatico));

const categoriasVisibles = computed(() =>
  props.categorias.filter((c) => c.activo || c.id === props.inicial?.categoriaId),
);

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

function onCambiarFrecuencia() {
  if (form.frecuencia === 'quincenal' && form.diaMes === '') form.diaMes = '15';
}

const diasValidos = computed(() => {
  if (form.frecuencia !== 'quincenal') return true;
  const d1 = Number(form.diaMes || 15);
  const d2 = form.diaMes2 === '' ? 31 : Number(form.diaMes2);
  return d1 < d2;
});

function onSubmit() {
  if (!diasValidos.value) return;
  const payload = {
    nombre: form.nombre,
    tipoMonto: form.tipoMonto,
    responsableUsuarioId: form.responsableUsuarioId || null,
    categoriaId: form.categoriaId || null,
    frecuencia: form.frecuencia,
    diaMes: form.diaMes === '' ? null : Number(form.diaMes),
    diaMes2: form.frecuencia === 'quincenal' ? (form.diaMes2 === '' ? null : Number(form.diaMes2)) : null,
    fechaInicio: form.fechaInicio,
  };
  if (form.tipoMonto === 'fijo') payload.montoDefault = Number(form.montoDefault);
  payload.pagoAutomatico = puedeSerAutomatica.value && form.pagoAutomatico;
  // Solo el responsable manda el método; si no, se conserva el que tenga.
  if (payload.pagoAutomatico && soyResponsable.value) {
    payload.metodoPagoAutomaticoId = form.metodoPagoAutomaticoId || null;
  }
  emit('guardar', payload);
}
</script>

<template>
  <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="onSubmit">
    <FormField v-model="form.nombre" label="Nombre" required placeholder="Arriendo, Internet…" />
    <div>
      <label class="label" :for="`${idBase}-responsable`">Responsable de pagarla</label>
      <select :id="`${idBase}-responsable`" v-model="form.responsableUsuarioId" class="field">
        <option value="">Cualquiera</option>
        <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
      </select>
    </div>

    <div>
      <label class="label" :for="`${idBase}-tipo`">Monto</label>
      <select :id="`${idBase}-tipo`" v-model="form.tipoMonto" class="field">
        <option value="fijo">Fijo: siempre el mismo</option>
        <option value="variable">Variable: se pone al pagar</option>
      </select>
    </div>
    <FormField
      v-if="form.tipoMonto === 'fijo'"
      v-model="form.montoDefault"
      type="number"
      inputmode="numeric"
      label="Valor (COP)"
      required
    />
    <div v-else class="hidden sm:block" aria-hidden="true" />

    <div>
      <label class="label" :for="`${idBase}-frecuencia`">Se paga</label>
      <select :id="`${idBase}-frecuencia`" v-model="form.frecuencia" class="field" @change="onCambiarFrecuencia">
        <option value="mensual">Cada mes</option>
        <option value="quincenal">Cada quincena (dos veces al mes)</option>
      </select>
    </div>
    <div class="grid gap-4" :class="form.frecuencia === 'quincenal' ? 'grid-cols-2' : 'grid-cols-1'">
      <div>
        <label class="label" :for="`${idBase}-dia`">{{ form.frecuencia === 'quincenal' ? 'Primer día' : 'Día del mes' }}</label>
        <select :id="`${idBase}-dia`" v-model="form.diaMes" class="field">
          <option v-if="form.frecuencia !== 'quincenal'" value="">Último día del mes</option>
          <option v-for="d in DIAS" :key="d" :value="String(d)">{{ d }}</option>
        </select>
      </div>
      <div v-if="form.frecuencia === 'quincenal'">
        <label class="label" :for="`${idBase}-dia2`">Segundo día</label>
        <select :id="`${idBase}-dia2`" v-model="form.diaMes2" class="field">
          <option value="">Último día del mes</option>
          <option v-for="d in DIAS" :key="d" :value="String(d)">{{ d }}</option>
        </select>
      </div>
    </div>

    <div v-if="categoriasVisibles.length">
      <label class="label" :for="`${idBase}-categoria`">Categoría del hogar</label>
      <select :id="`${idBase}-categoria`" v-model="form.categoriaId" class="field">
        <option value="">Sin categoría</option>
        <option v-for="c in categoriasVisibles" :key="c.id" :value="c.id">{{ c.nombre }}</option>
      </select>
    </div>

    <FormField
      v-model="form.fechaInicio"
      type="date"
      label="Desde"
      hint="La primera cuota es la primera fecha de pago desde este día."
      required
    />

    <div class="panel-sunken space-y-3 px-4 py-3 sm:col-span-2">
      <label
        class="flex items-start gap-3 text-sm"
        :class="puedeSerAutomatica ? 'cursor-pointer text-ink-primary' : 'text-ink-tertiary'"
      >
        <input
          v-model="form.pagoAutomatico"
          type="checkbox"
          class="checkbox mt-0.5"
          :disabled="!puedeSerAutomatica"
        />
        <span>
          <span class="font-medium">Se paga sola</span>
          <span class="block text-[13px] text-ink-secondary">
            <template v-if="!puedeSerAutomatica">
              Para activarla, la cuenta debe tener monto fijo y un responsable.
            </template>
            <template v-else>
              Para débitos automáticos o cobros a la tarjeta (ChatGPT, Netflix…): cada cuota queda pagada por
              {{ soyResponsable ? 'ti' : nombreResponsable }} en su fecha, sin marcar "Lo pagué".
              <template v-if="!activaDesdeAntes && inicial"> Empieza a contar desde hoy; lo que ya venció sigue pendiente.</template>
            </template>
          </span>
        </span>
      </label>

      <div v-if="puedeSerAutomatica && form.pagoAutomatico">
        <template v-if="soyResponsable">
          <label class="label" :for="`${idBase}-metodo-auto`">Con qué se paga</label>
          <select :id="`${idBase}-metodo-auto`" v-model="form.metodoPagoAutomaticoId" class="field">
            <option value="">Sin elegir (lo eliges en tus movimientos)</option>
            <option v-for="m in misMetodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
          <p class="mt-1 text-[13px] text-ink-tertiary">Solo tú ves esta cuenta o tarjeta.</p>
        </template>
        <p v-else class="text-[13px] text-ink-tertiary">
          La cuenta o tarjeta con que se paga solo la elige {{ nombreResponsable }}, desde su sesión.
        </p>
      </div>
    </div>

    <p v-if="!diasValidos" class="sm:col-span-2 text-[13px] font-medium text-negative">
      El primer día de la quincena debe ser antes que el segundo.
    </p>
    <p class="sm:col-span-2 text-[13px] text-ink-tertiary">
      Si el mes es más corto (por ejemplo, día 30 en febrero), la cuota cae en el último día del mes.
    </p>

    <div class="flex justify-end gap-2 sm:col-span-2">
      <button v-if="inicial" type="button" class="btn-ghost" @click="emit('cancelar')">Cancelar</button>
      <button type="submit" class="btn-primary" :disabled="guardando || !diasValidos">
        {{ guardando ? 'Guardando…' : textoGuardar }}
      </button>
    </div>
  </form>
</template>
