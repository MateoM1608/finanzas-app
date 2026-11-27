<script setup>
import { ref, reactive, watch } from 'vue';
import { obtenerResumenAhorros, registrarAporte, eliminarTransaccionAhorro } from '../../api/ahorrosPersonales.js';
import { listarMetodosPago } from '../../api/metodosPagoPersonales.js';
import { confirmar } from '../../composables/useConfirm.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';

// Semáforo del ciclo: amarillo (en progreso), azul (meta cumplida), verde (superada).
const ESTADO_INFO = {
  amarillo: {
    clase: 'badge-warning',
    barra: 'bg-warning',
    texto: (p) => `Pronóstico ${formatCurrency(p.montoSugerido)}`,
  },
  azul: { clase: 'badge-accent', barra: 'bg-accent', texto: () => 'Meta cumplida' },
  verde: { clase: 'badge-positive', barra: 'bg-positive', texto: () => 'Superaste el pronóstico' },
};

const props = defineProps({ ciclo: { type: Number, default: 0 } });
// Un aporte o retiro mueve la caja: el panel recarga Disponible y movimientos.
const emit = defineEmits(['cambio']);

const loading = ref(true);
const error = ref('');
const resumen = ref(null);
const aportandoId = ref(null);
const tipoMovimiento = ref('aporte');
const cuentaAporte = ref('');
const enCajaAporte = ref(true);
const metodos = ref([]);
listarMetodosPago()
  .then((m) => (metodos.value = m.filter((x) => x.tipo !== 'tarjeta_credito')))
  .catch(() => {});
const verMovimientosId = ref(null);
const montoAporte = reactive({});
const guardandoAporteId = ref(null);

async function cargar() {
  loading.value = true;
  error.value = '';
  try {
    resumen.value = await obtenerResumenAhorros(props.ciclo);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
watch(() => props.ciclo, cargar, { immediate: true });
defineExpose({ recargar: cargar });

// Pronóstico del ciclo consultado (null si ese período no se evaluó).
function periodoActual(meta) {
  return meta.cicloConsultado?.estado ? meta.cicloConsultado : null;
}

// Solo presentación: % ahorrado este ciclo vs el monto sugerido, acotado a 0–100.
function pctCiclo(periodo) {
  const sugerido = Number(periodo.montoSugerido) || 0;
  if (sugerido <= 0) return Number(periodo.montoAhorradoReal) > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, (Number(periodo.montoAhorradoReal) / sugerido) * 100));
}

function onMostrarAporte(meta, tipo = 'aporte') {
  aportandoId.value = meta.id;
  tipoMovimiento.value = tipo;
  cuentaAporte.value = '';
  enCajaAporte.value = true;
  montoAporte[meta.id] = '';
}

async function onQuitarTransaccion(meta, t) {
  if (!(await confirmar(`¿Quitar este ${t.tipo} de ${formatCurrency(t.monto)}?`, { textoAceptar: 'Quitar' }))) return;
  error.value = '';
  try {
    await eliminarTransaccionAhorro(meta.id, t.id);
    await cargar();
    emit('cambio');
  } catch (e) {
    error.value = extractErrorMessage(e);
  }
}

async function onRegistrarAporte(meta) {
  error.value = '';
  guardandoAporteId.value = meta.id;
  try {
    await registrarAporte(meta.id, {
      tipo: tipoMovimiento.value,
      monto: Number(montoAporte[meta.id]),
      metodoPagoId: enCajaAporte.value ? cuentaAporte.value || null : null,
      enCaja: enCajaAporte.value,
    });
    aportandoId.value = null;
    await cargar();
    emit('cambio');
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoAporteId.value = null;
  }
}
</script>

<template>
  <div>
    <AlertError :message="error" />
    <p v-if="loading" class="empty">Cargando…</p>

    <template v-else>
      <div class="mb-4 sm:mb-5">
        <p class="stat-label">{{ ciclo === 0 ? 'Ahorrado en total' : 'Ahorrado al cierre del ciclo' }}</p>
        <p class="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-ink-primary">
          {{ formatCurrency(resumen.totalAhorradoAcumulado) }}
        </p>
      </div>

      <div
        v-if="resumen.alertaSobregasto"
        class="mb-5 flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warning/10 px-3.5 py-3 text-sm text-warning"
        role="status"
      >
        <AppIcon name="alert" class="mt-0.5 h-4 w-4 shrink-0" />
        <p>Vas a tener que recortar gastos más adelante en este período si quieres cumplir tus metas de ahorro.</p>
      </div>

      <p v-if="!resumen.metas.length" class="empty">
        <template v-if="ciclo === 0">Aún no tienes metas de ahorro. Créalas con «Configurar».</template>
        <template v-else>No había metas de ahorro en ese ciclo.</template>
      </p>

      <ul v-else class="list">
        <li
          v-for="meta in resumen.metas"
          :key="meta.id"
          class="py-4 first:pt-0 last:pb-0"
          :class="{ 'opacity-50': !meta.activo }"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink-primary">
                <span class="truncate">{{ meta.nombre }}</span>
                <span v-if="meta.categoria" class="badge-neutral">{{ meta.categoria }}</span>
                <span v-if="!meta.activo" class="badge-neutral">Inactiva</span>
              </p>
              <p class="mt-0.5 text-[13px] text-ink-tertiary">
                Ahorrado {{ formatCurrency(meta.totalAhorrado) }}
                <template v-if="meta.montoMetaTotal">
                  de {{ formatCurrency(meta.montoMetaTotal) }} ({{ meta.progresoPct.toFixed(0) }}%)
                </template>
              </p>
            </div>
            <div v-if="ciclo === 0 && aportandoId !== meta.id" class="flex shrink-0 gap-1.5">
              <button v-if="meta.activo && meta.modoTransaccion === 'manual'" class="btn-secondary btn-sm" @click="onMostrarAporte(meta)">
                <AppIcon name="plus" class="h-3.5 w-3.5" />
                Aportar
              </button>
              <button v-if="meta.totalAhorrado > 0" class="btn-ghost btn-sm" @click="onMostrarAporte(meta, 'retiro')">Retirar</button>
            </div>
          </div>

          <div v-if="periodoActual(meta)" class="mt-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-[13px] text-ink-secondary">
                <span class="font-medium text-ink-primary">{{
                  formatCurrency(periodoActual(meta).montoAhorradoReal)
                }}</span>
                {{ ciclo === 0 ? 'este ciclo' : 'en ese ciclo' }}
              </span>
              <span :class="ESTADO_INFO[periodoActual(meta).estado].clase">
                {{ ESTADO_INFO[periodoActual(meta).estado].texto(periodoActual(meta)) }}
              </span>
            </div>
            <div
              class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
              role="progressbar"
              :aria-valuenow="Math.round(pctCiclo(periodoActual(meta)))"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-label="`Ahorro del ciclo en ${meta.nombre}`"
            >
              <div
                class="h-full rounded-full transition-[width] duration-500 ease-out"
                :class="ESTADO_INFO[periodoActual(meta).estado].barra"
                :style="{ width: pctCiclo(periodoActual(meta)) + '%' }"
              />
            </div>
          </div>
          <p v-else class="mt-3 flex items-center gap-1.5 text-[13px] text-ink-tertiary">
            <AppIcon name="clock" class="h-3.5 w-3.5 shrink-0" />
            <template v-if="ciclo === 0">Este ciclo todavía no se ha evaluado (faltan obligatorios por pagar).</template>
            <template v-else>
              Ese ciclo no se evaluó<template v-if="meta.cicloConsultado.montoAhorradoReal">
                · aportaste {{ formatCurrency(meta.cicloConsultado.montoAhorradoReal) }}</template
              >.
            </template>
          </p>

          <div v-if="aportandoId === meta.id" class="panel-sunken mt-3 flex flex-wrap items-center gap-2 p-3">
            <input
              v-model="montoAporte[meta.id]"
              type="number"
              inputmode="numeric"
              class="field min-w-0 flex-1 sm:max-w-[10rem]"
              :placeholder="tipoMovimiento === 'retiro' ? 'Retiras (COP)' : 'Aportas (COP)'"
              :aria-label="tipoMovimiento === 'retiro' ? 'Monto del retiro' : 'Monto del aporte'"
            />
            <select v-if="enCajaAporte" v-model="cuentaAporte" class="field min-w-0 flex-1 sm:max-w-[12rem]" :aria-label="tipoMovimiento === 'retiro' ? 'Cuenta a la que llega' : 'Cuenta de la que sale'">
              <option value="">{{ tipoMovimiento === 'retiro' ? 'Llega a: sin definir' : 'Sale de: sin definir' }}</option>
              <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
            </select>
            <label class="inline-flex w-full cursor-pointer items-center gap-2.5 text-sm text-ink-secondary">
              <input v-model="enCajaAporte" type="checkbox" class="h-4 w-4 rounded accent-accent" />
              {{ tipoMovimiento === 'retiro' ? 'Llega a una de mis cuentas (sube mi Disponible)' : 'Sale de una de mis cuentas (baja mi Disponible)' }}
            </label>
            <div class="flex items-center gap-2">
              <button
                class="btn-primary btn-sm"
                :disabled="guardandoAporteId === meta.id"
                @click="onRegistrarAporte(meta)"
              >
                Guardar
              </button>
              <button class="btn-ghost btn-sm" @click="aportandoId = null">Cancelar</button>
            </div>
            <p class="w-full text-xs text-ink-tertiary">
              <template v-if="enCajaAporte">{{ tipoMovimiento === 'retiro' ? 'Sube tu Disponible pero no cuenta como ingreso.' : 'Baja tu Disponible pero no cuenta como gasto.' }}</template>
              <template v-else>{{ tipoMovimiento === 'retiro' ? 'La plata se va a otro lado: tu Disponible no cambia.' : 'La plata llega de otra fuente o ya estaba ahorrada: tu Disponible no cambia.' }}</template>
            </p>
          </div>
          <button
            v-if="ciclo === 0 && meta.transacciones?.length"
            type="button"
            class="mt-2 text-xs text-ink-tertiary hover:text-ink-primary hover:underline"
            @click="verMovimientosId = verMovimientosId === meta.id ? null : meta.id"
          >
            {{ verMovimientosId === meta.id ? 'Ocultar movimientos' : `Movimientos (${meta.transacciones.length})` }}
          </button>
          <ul v-if="verMovimientosId === meta.id" class="list mt-1">
            <li v-for="t in meta.transacciones" :key="t.id" class="list-row !py-1.5 text-[13px]">
              <span class="text-ink-secondary">
                {{ formatDate(t.fecha) }} · {{ t.tipo === 'retiro' ? 'retiro' : t.origen === 'automatico' ? 'débito automático' : 'aporte' }}<template v-if="t.origen === 'manual' && t.enCaja === false"> · no tocó el Disponible</template>
              </span>
              <span class="flex items-center gap-1.5">
                <span class="font-semibold" :class="t.tipo === 'retiro' ? 'text-warning' : 'text-ink-primary'">{{ t.tipo === 'retiro' ? '−' : '' }}{{ formatCurrency(t.monto) }}</span>
                <button v-if="t.origen === 'manual'" type="button" class="btn-icon !p-1" aria-label="Quitar movimiento" @click="onQuitarTransaccion(meta, t)">
                  <AppIcon name="x" class="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          </ul>
        </li>
      </ul>
    </template>
  </div>
</template>
