<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { obtenerCuentasHogar, pagarCuota, deshacerPagoCuota } from '../../api/cuentasHogar.js';
import { listarMiembros } from '../../api/hogares.js';
import { listarMetodosPago } from '../../api/metodosPagoPersonales.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuthStore } from '../../stores/auth.js';
import { formatCurrency, formatDate, hoyISO } from '../../utils/format.js';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';
import AppModal from '../AppModal.vue';
import { confirmar } from '../../composables/useConfirm.js';
import FormField from '../FormField.vue';

/**
 * Cuentas fijas del hogar en Panel del hogar: lo que toca pagar (desde su
 * fecha), las próximas y lo ya pagado sin cuadrar. Una cuota solo entra al
 * saldo y a los cuadres cuando alguien la marca como pagada.
 */
const emit = defineEmits(['cambio']);
const auth = useAuthStore();
const puedeEditar = computed(() => Boolean(auth.usuario?.esAdmin || auth.usuario?.puedeEditarGastos));

const datos = ref(null);
const miembros = ref([]);
const loading = ref(true);
const error = ref('');
const vista = ref('por_pagar');

const pagando = ref(null); // cuota que se está marcando
const formPago = reactive({ monto: '', pagoUsuarioId: '', fechaPago: '', metodoPagoId: '' });
const misMetodos = ref([]);
// El método de pago es personal: solo se pregunta si quien pagó es el usuario actual.
const pagueYo = computed(() => formPago.pagoUsuarioId === auth.usuario?.id);
const guardando = ref(false);
const deshaciendoId = ref(null);

async function cargar() {
  error.value = '';
  try {
    const [cuentas, lista, metodos] = await Promise.all([obtenerCuentasHogar(), listarMiembros(), listarMetodosPago()]);
    datos.value = cuentas;
    miembros.value = lista;
    misMetodos.value = metodos;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(cargar);
defineExpose({ recargar: cargar });

const pestanas = computed(() => [
  { id: 'por_pagar', label: 'Por pagar', total: datos.value?.porPagar.length ?? 0 },
  { id: 'proximas', label: 'Próximas', total: datos.value?.proximas.length ?? 0 },
  { id: 'pagadas', label: 'Pagadas sin cuadrar', total: datos.value?.pagadasSinCuadrar.length ?? 0 },
]);

const lista = computed(() => {
  if (!datos.value) return [];
  if (vista.value === 'proximas') return datos.value.proximas;
  if (vista.value === 'pagadas') return datos.value.pagadasSinCuadrar;
  return datos.value.porPagar;
});

function abrirPago(cuota) {
  error.value = '';
  pagando.value = cuota;
  formPago.monto = cuota.monto ?? '';
  formPago.pagoUsuarioId = cuota.concepto.responsable?.id ?? auth.usuario?.id ?? '';
  formPago.fechaPago = hoyISO();
  formPago.metodoPagoId = '';
}

async function onConfirmarPago() {
  guardando.value = true;
  error.value = '';
  try {
    await pagarCuota(pagando.value.id, {
      monto: Number(formPago.monto),
      pagoUsuarioId: formPago.pagoUsuarioId,
      fechaPago: formPago.fechaPago,
      metodoPagoId: pagueYo.value && formPago.metodoPagoId ? formPago.metodoPagoId : undefined,
    });
    pagando.value = null;
    await cargar();
    emit('cambio');
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardando.value = false;
  }
}

async function onDeshacer(cuota) {
  const ok = await confirmar(
    `¿Deshacer el pago de "${cuota.concepto.nombre}"${cuota.monto != null ? ` de ${formatCurrency(cuota.monto)}` : ''}? Vuelve a quedar por pagar y sale del saldo del hogar.`,
    { textoAceptar: 'Deshacer pago', peligroso: false },
  );
  if (!ok) return;
  deshaciendoId.value = cuota.id;
  error.value = '';
  try {
    await deshacerPagoCuota(cuota.id);
    await cargar();
    emit('cambio');
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    deshaciendoId.value = null;
  }
}

const textoVacio = {
  por_pagar: 'Nada por pagar hoy: todas las cuentas que ya llegaron a su fecha están pagadas.',
  proximas: 'No hay cuentas próximas. Configúralas en Configuración → Cuentas fijas.',
  pagadas: 'No hay cuentas pagadas pendientes de cuadrar.',
};
</script>

<template>
  <section class="card card-pad" aria-labelledby="cuentas-fijas-titulo">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 id="cuentas-fijas-titulo" class="section-title">Cuentas fijas</h3>
        <p class="section-hint">Cuentan para el saldo solo cuando alguien las marca como pagadas.</p>
      </div>
      <router-link :to="{ name: 'settings' }" class="btn-ghost btn-sm shrink-0">
        <AppIcon name="settings" class="h-3.5 w-3.5" />
        Configurar
      </router-link>
    </div>

    <AlertError :message="error" class="mb-4" />

    <div class="tabs mb-3" role="tablist" aria-label="Estado de las cuentas fijas">
      <button
        v-for="p in pestanas"
        :key="p.id"
        type="button"
        role="tab"
        class="tab inline-flex items-center gap-1.5"
        :class="{ 'tab-active': vista === p.id }"
        :aria-selected="vista === p.id"
        @click="vista = p.id"
      >
        {{ p.label }}
        <span v-if="p.total" class="badge-neutral !px-1 !py-0">{{ p.total }}</span>
      </button>
    </div>

    <p v-if="loading" class="empty">Cargando…</p>
    <div v-else-if="!lista.length" class="empty flex flex-col items-center gap-2">
      <AppIcon :name="vista === 'por_pagar' ? 'check' : 'repeat'" class="h-6 w-6" :class="vista === 'por_pagar' ? 'text-positive' : ''" />
      {{ textoVacio[vista] }}
    </div>

    <ul v-else class="list">
      <li v-for="cuota in lista" :key="cuota.id" class="list-row">
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
            :class="
              cuota.estado !== 'por_pagar'
                ? 'bg-positive/10 text-positive'
                : cuota.atrasada
                  ? 'bg-negative/10 text-negative'
                  : 'bg-surface-sunken text-ink-secondary'
            "
          >
            <AppIcon :name="cuota.estado !== 'por_pagar' ? 'check' : 'calendar'" class="h-4 w-4" />
          </span>
          <div class="min-w-0">
            <p class="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink-primary">
              <span class="truncate">{{ cuota.concepto.nombre }}</span>
              <span v-if="cuota.atrasada" class="badge-negative">Atrasada</span>
              <span v-if="cuota.estado === 'en_cuadre'" class="badge-accent">En cuadre</span>
              <span v-if="cuota.seVaAPagarSola" class="badge-neutral">Se paga sola</span>
              <span v-if="cuota.pagoAutomatico" class="badge-positive">Pago automático</span>
            </p>
            <p class="truncate text-[13px] text-ink-tertiary">
              {{ formatDate(cuota.fecha) }}
              <template v-if="cuota.estado !== 'por_pagar'">
                · Pagó {{ cuota.pagador?.nombre }}<template v-if="cuota.metodoPago"> con {{ cuota.metodoPago.nombre }}</template>
              </template>
              <template v-else-if="cuota.concepto.responsable"> · La paga {{ cuota.concepto.responsable.nombre }}</template>
            </p>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <span class="whitespace-nowrap text-sm font-semibold text-ink-primary">
            {{ cuota.monto != null ? formatCurrency(cuota.monto) : '—' }}
          </span>
          <template v-if="puedeEditar">
            <button
              v-if="cuota.estado === 'por_pagar'"
              type="button"
              :class="cuota.seVaAPagarSola ? 'btn-ghost btn-sm' : 'btn-secondary btn-sm'"
              @click="abrirPago(cuota)"
            >
              <AppIcon name="check" class="h-3.5 w-3.5" />
              Lo pagué
            </button>
            <button
              v-else-if="cuota.estado === 'pagado'"
              type="button"
              class="btn-ghost btn-sm"
              :disabled="deshaciendoId === cuota.id"
              @click="onDeshacer(cuota)"
            >
              Deshacer
            </button>
          </template>
        </div>
      </li>
    </ul>

    <p v-if="vista === 'proximas' && lista.length" class="mt-3 text-[13px] text-ink-tertiary">
      Puedes marcar una cuenta como pagada antes de su fecha; entra al saldo cuando llegue su día.
    </p>

    <AppModal v-if="pagando" :title="`Pagar ${pagando.concepto.nombre}`" @close="pagando = null">
      <form class="space-y-4" @submit.prevent="onConfirmarPago">
        <p class="text-[13px] text-ink-secondary">Cuota del {{ formatDate(pagando.fecha) }}.</p>
        <FormField
          v-model="formPago.monto"
          type="number"
          label="Valor pagado (COP)"
          :hint="pagando.concepto.tipoMonto === 'variable' ? 'Es de monto variable: pon lo que llegó esta vez.' : ''"
          required
        />
        <div>
          <label class="label" for="pago-cuota-quien">Quién pagó</label>
          <select id="pago-cuota-quien" v-model="formPago.pagoUsuarioId" class="field" required>
            <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
        </div>
        <div v-if="pagueYo">
          <label class="label" for="pago-cuota-metodo">Con qué lo pagaste (solo lo ves tú)</label>
          <select id="pago-cuota-metodo" v-model="formPago.metodoPagoId" class="field">
            <option value="">Sin definir</option>
            <option v-for="m in misMetodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
          <p v-if="!misMetodos.length" class="mt-1.5 text-xs text-ink-tertiary">
            Configura tus métodos en Personal → Configuración → Métodos de pago.
          </p>
        </div>
        <FormField v-model="formPago.fechaPago" type="date" label="Fecha de pago" required />
        <div class="flex justify-end gap-2 pt-1">
          <button type="button" class="btn-ghost" @click="pagando = null">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="guardando || !formPago.monto">
            {{ guardando ? 'Guardando…' : 'Marcar como pagada' }}
          </button>
        </div>
      </form>
    </AppModal>
  </section>
</template>
