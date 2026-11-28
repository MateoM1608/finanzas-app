<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { listarMetodosPago, registrarPagoTarjeta } from '../api/metodosPagoPersonales.js';
import { obtenerInformeMetodo } from '../api/informeMetodos.js';
import { extractErrorMessage } from '../api/client.js';
import { formatCurrency, formatDate, hoyISO, describirMetodo, formatUsd, formatTrm, aCentavos } from '../utils/format.js';
import AppLayout from '../components/AppLayout.vue';
import AppIcon from '../components/AppIcon.vue';
import AlertError from '../components/AlertError.vue';
import FormField from '../components/FormField.vue';
import ExtractosSection from '../components/tarjetas/ExtractosSection.vue';

/**
 * Tarjetas y cuentas: informe de cada método de pago (privado). Para una
 * tarjeta de crédito: deuda, compras a cuotas vivas, próximos cargos con
 * capital e intereses, pagos hechos a la tarjeta y la revisión de sus
 * extractos contra el banco.
 */
const route = useRoute();
const router = useRouter();

const metodos = ref([]);
const metodoId = ref('');
const mes = ref(hoyISO().slice(0, 7));
const informe = ref(null);
const cargando = ref(true);
const error = ref('');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function nombreMes(periodo, corto = false) {
  const [a, m] = periodo.split('-').map(Number);
  return corto ? `${MESES_CORTOS[m - 1]} ${String(a).slice(2)}` : `${MESES[m - 1]} ${a}`;
}
function moverMes(delta) {
  const [a, m] = mes.value.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  mes.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const metodo = computed(() => metodos.value.find((m) => m.id === metodoId.value));
const esTarjeta = computed(() => metodo.value?.tipo === 'tarjeta_credito');

async function cargarInforme() {
  if (!metodoId.value) return;
  error.value = '';
  try {
    informe.value = await obtenerInformeMetodo(metodoId.value, mes.value);
  } catch (e) {
    error.value = extractErrorMessage(e);
  }
}

onMounted(async () => {
  try {
    metodos.value = await listarMetodosPago();
    const pedido = route.query.metodo;
    metodoId.value =
      (pedido && metodos.value.some((m) => m.id === pedido) && pedido) ||
      metodos.value.find((m) => m.tipo === 'tarjeta_credito')?.id ||
      metodos.value[0]?.id ||
      '';
    await cargarInforme();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    cargando.value = false;
  }
});

watch([metodoId, mes], () => {
  router.replace({ query: { metodo: metodoId.value } });
  cargarInforme();
});

const ETIQUETA_ORIGEN = { pago_hogar: 'Hogar', liquidacion_hogar: 'Cuadre', pago_tarjeta: 'Pago de tarjeta' };

// --- Registrar pago de la tarjeta ---
const pagando = ref(false);
// moneda: 'pesos' (la parte en pesos) o 'usd' (cuántos US$ cubre y cuántos pesos costó).
const pago = reactive({ monto: '', fecha: '', desdeId: '', moneda: 'pesos', usd: '' });
const guardandoPago = ref(false);
const cuentasOrigen = computed(() => metodos.value.filter((m) => m.tipo !== 'tarjeta_credito'));

const deudaPesos = computed(() => metodo.value?.deudaPesos ?? informe.value?.tarjeta?.deuda ?? 0);
const deudaUsd = computed(() => metodo.value?.deudaUsd ?? 0);

function sugerirPago() {
  if (pago.moneda === 'usd') {
    pago.usd = deudaUsd.value > 0 ? String(deudaUsd.value / 100) : '';
    const trm = metodo.value?.trmDeuda;
    pago.monto = deudaUsd.value > 0 && trm ? Math.round((deudaUsd.value * trm) / 100) : '';
  } else {
    pago.monto = deudaPesos.value > 0 ? deudaPesos.value : '';
  }
}
watch(() => pago.moneda, sugerirPago);

function abrirPago() {
  pago.moneda = 'pesos';
  pago.usd = '';
  sugerirPago();
  pago.fecha = hoyISO();
  pago.desdeId = '';
  pagando.value = true;
}
const tasaPago = computed(() => {
  const usd = aCentavos(pago.usd);
  return pago.moneda === 'usd' && usd && Number(pago.monto) > 0 ? (Number(pago.monto) * 100) / usd : null;
});

// Un ajuste de extracto puede crear o cambiar cargos: refresca deuda e informe.
async function recargar() {
  try {
    metodos.value = await listarMetodosPago();
    await cargarInforme();
  } catch (e) {
    error.value = extractErrorMessage(e);
  }
}

async function onRegistrarPago() {
  guardandoPago.value = true;
  error.value = '';
  try {
    await registrarPagoTarjeta(metodoId.value, {
      monto: Number(pago.monto),
      fecha: pago.fecha,
      metodoPagoId: pago.desdeId || undefined,
      ...(pago.moneda === 'usd' ? { montoUsd: aCentavos(pago.usd) } : {}),
    });
    pagando.value = false;
    metodos.value = await listarMetodosPago();
    await cargarInforme();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoPago.value = false;
  }
}
</script>

<template>
  <AppLayout title="Tarjetas y cuentas" subtitle="Qué salió y entró por cada método de pago. Solo lo ves tú.">
    <template #actions>
      <router-link :to="{ name: 'patrimonio' }" class="btn-secondary">
        <AppIcon name="chevronLeft" class="h-4 w-4" />
        Patrimonio
      </router-link>
    </template>

    <div class="space-y-6">
      <AlertError :message="error" />

      <div v-if="cargando" class="card card-pad"><p class="empty">Cargando…</p></div>

      <div v-else-if="!metodos.length" class="card card-pad empty flex flex-col items-center gap-2">
        <AppIcon name="wallet" class="h-6 w-6" />
        Aún no tienes métodos de pago. Créalos en Personal → Configuración → Métodos de pago.
      </div>

      <template v-else>
        <!-- Selector de método y mes -->
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div class="min-w-0">
            <label class="label" for="informe-metodo">Método de pago</label>
            <select id="informe-metodo" v-model="metodoId" class="field !w-auto min-w-[14rem]">
              <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
            </select>
            <p v-if="metodo" class="mt-1 text-[13px] text-ink-tertiary">{{ describirMetodo(metodo) }}</p>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="btn-icon" aria-label="Mes anterior" @click="moverMes(-1)">
              <AppIcon name="chevronLeft" class="h-4 w-4" />
            </button>
            <span class="min-w-[9rem] text-center text-sm font-medium capitalize text-ink-primary">{{ nombreMes(mes) }}</span>
            <button type="button" class="btn-icon" aria-label="Mes siguiente" @click="moverMes(1)">
              <AppIcon name="chevronRight" class="h-4 w-4" />
            </button>
          </div>
        </div>

        <template v-if="informe">
          <!-- Indicadores -->
          <div class="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
            <section v-if="esTarjeta" class="card card-pad relative overflow-hidden col-span-2 sm:col-span-1">
              <div class="pointer-events-none absolute inset-x-0 top-0 h-1 bg-warning" aria-hidden="true" />
              <p class="stat-label">Deuda hoy</p>
              <p class="stat-value-lg" :class="informe.tarjeta.deuda > 0 ? 'text-warning' : 'text-ink-primary'">
                {{ formatCurrency(deudaUsd ? deudaPesos : informe.tarjeta.deuda) }}
              </p>
              <template v-if="deudaUsd">
                <p class="mt-1 text-lg font-bold text-warning">+ {{ formatUsd(deudaUsd) }}</p>
                <p class="mt-1 text-xs text-ink-tertiary">
                  En total ≈ {{ formatCurrency(informe.tarjeta.deuda) }}
                  <template v-if="metodo?.trmDeuda">(dólares a la TRM de hoy, {{ formatTrm(metodo.trmDeuda) }})</template>
                </p>
              </template>
              <p v-if="metodo?.cupo" class="mt-1 text-xs text-ink-secondary">
                Cupo disponible:
                <span class="font-semibold" :class="metodo.cupoDisponible < 0 ? 'text-negative' : ''">{{ formatCurrency(metodo.cupoDisponible) }}</span>
                de {{ formatCurrency(metodo.cupo) }}
              </p>
              <button type="button" class="btn-secondary btn-sm mt-3" @click="abrirPago">Registrar pago</button>
            </section>
            <section class="card card-pad">
              <p class="stat-label">{{ esTarjeta ? 'Cargado en' : 'Salió en' }} <span class="capitalize">{{ nombreMes(mes) }}</span></p>
              <p class="stat-value text-ink-primary">
                {{ formatCurrency(informe.mes.totalGastos) }}
              </p>
              <p v-if="informe.mes.interesesMes" class="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-ink-tertiary">
                Incluye {{ formatCurrency(informe.mes.interesesMes) }} de intereses
              </p>
            </section>
            <section v-if="!esTarjeta" class="card card-pad">
              <p class="stat-label">Entró en <span class="capitalize">{{ nombreMes(mes) }}</span></p>
              <p class="stat-value text-positive">
                {{ formatCurrency(informe.mes.totalIngresos) }}
              </p>
            </section>
            <section v-if="esTarjeta" class="card card-pad">
              <p class="stat-label">Intereses cobrados</p>
              <p class="stat-value text-ink-primary">
                {{ formatCurrency(informe.tarjeta.interesesTotales) }}
              </p>
              <p class="stat-hint">De las cuotas ya cobradas, desde siempre</p>
            </section>
          </div>

          <!-- Registrar pago -->
          <form v-if="pagando" class="card card-pad grid grid-cols-1 gap-4 sm:grid-cols-3" @submit.prevent="onRegistrarPago">
            <p class="sm:col-span-3 section-title">Pago de {{ metodo?.nombre }}</p>
            <div v-if="deudaUsd || pago.moneda === 'usd'" class="sm:col-span-3">
              <span class="label">Qué parte pagas</span>
              <div class="tabs" role="radiogroup" aria-label="Parte de la deuda que pagas">
                <button
                  v-for="op in [{ id: 'pesos', label: 'Parte en pesos' }, { id: 'usd', label: 'Parte en dólares' }]"
                  :key="op.id"
                  type="button"
                  role="radio"
                  class="tab"
                  :class="{ 'tab-active': pago.moneda === op.id }"
                  :aria-checked="pago.moneda === op.id"
                  @click="pago.moneda = op.id"
                >
                  {{ op.label }}
                </button>
              </div>
            </div>
            <FormField
              v-if="pago.moneda === 'usd'"
              v-model="pago.usd"
              type="number"
              step="0.01"
              label="Dólares que pagas (US$)"
              required
              :hint="deudaUsd ? `Debes ${formatUsd(deudaUsd)}.` : ''"
            />
            <FormField
              v-model="pago.monto"
              type="number"
              :label="pago.moneda === 'usd' ? 'Lo que te costó en pesos (COP)' : 'Valor pagado (COP)'"
              required
              :hint="tasaPago ? `Tasa: ${formatTrm(tasaPago)} pesos por dólar.` : ''"
            />
            <FormField v-model="pago.fecha" type="date" label="Fecha" required />
            <div>
              <label class="label" for="pago-desde">Desde</label>
              <select id="pago-desde" v-model="pago.desdeId" class="field">
                <option value="">Sin definir</option>
                <option v-for="d in cuentasOrigen" :key="d.id" :value="d.id">{{ d.nombre }}</option>
              </select>
            </div>
            <div class="flex justify-end gap-2 sm:col-span-3">
              <button type="button" class="btn-ghost" @click="pagando = false">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="guardandoPago || (pago.moneda === 'usd' && !aCentavos(pago.usd))">
                {{ guardandoPago ? 'Guardando…' : 'Registrar pago' }}
              </button>
            </div>
          </form>

          <ExtractosSection v-if="esTarjeta && metodo" :metodo="metodo" @cambio="recargar" />

          <div v-if="esTarjeta" class="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <!-- Compras a cuotas vivas -->
            <section class="card card-pad">
              <h2 class="section-title">Compras a cuotas vivas</h2>
              <p class="section-hint mb-3">Lo que todavía falta por cobrarte en esta tarjeta.</p>
              <p v-if="!informe.tarjeta.comprasVivas.length" class="empty">No hay compras a cuotas pendientes.</p>
              <ul v-else class="list">
                <li v-for="(c, i) in informe.tarjeta.comprasVivas" :key="i" class="list-row !py-3">
                  <div class="min-w-0">
                    <p class="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink-primary">
                      <span class="truncate">{{ c.nombre }}</span>
                      <span v-if="c.origen === 'hogar'" class="badge-neutral">Hogar</span>
                      <span class="badge-neutral">{{ c.cuotasCobradas }}/{{ c.numeroCuotas }}</span>
                      <span v-if="c.tasaMensual > 0" class="badge-warning">{{ c.tasaMensual }} % mensual</span>
                    </p>
                    <p class="truncate text-[13px] text-ink-tertiary">
                      <template v-if="c.proximaCuota">Próxima {{ formatDate(c.proximaCuota.fecha) }} · {{ formatCurrency(c.proximaCuota.monto) }} · </template>
                      termina {{ formatDate(c.terminaEn) }}
                    </p>
                  </div>
                  <span class="shrink-0 text-right">
                    <span class="block text-sm font-semibold text-ink-primary">{{ formatCurrency(c.saldoPendiente) }}</span>
                    <span v-if="c.interesPendiente" class="block text-xs text-ink-tertiary">{{ formatCurrency(c.interesPendiente) }} de interés</span>
                  </span>
                </li>
              </ul>
            </section>

            <!-- Próximos cargos -->
            <section class="card card-pad">
              <h2 class="section-title">Próximos cargos</h2>
              <p class="section-hint mb-3">Cuotas que se cargarán en cada mes, separadas en capital e interés.</p>
              <div class="overflow-x-auto">
                <table class="w-full min-w-[360px] text-sm">
                  <thead>
                    <tr class="text-left text-[13px] text-ink-tertiary">
                      <th class="py-2 pr-3 font-medium">Mes</th>
                      <th class="py-2 pr-3 text-right font-medium">Capital</th>
                      <th class="py-2 pr-3 text-right font-medium">Interés</th>
                      <th class="py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    <tr v-for="p in informe.tarjeta.proximosPagos" :key="p.periodo">
                      <td class="py-2 pr-3 capitalize text-ink-primary">{{ nombreMes(p.periodo, true) }}</td>
                      <td class="py-2 pr-3 text-right whitespace-nowrap">{{ formatCurrency(p.capital) }}</td>
                      <td class="py-2 pr-3 text-right whitespace-nowrap" :class="p.interes ? 'text-warning' : 'text-ink-tertiary'">{{ formatCurrency(p.interes) }}</td>
                      <td class="py-2 text-right whitespace-nowrap font-semibold text-ink-primary">{{ formatCurrency(p.total) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <!-- Movimientos del mes -->
            <section class="card card-pad">
              <h2 class="section-title">{{ esTarjeta ? 'Cargos' : 'Salidas' }} de <span class="capitalize">{{ nombreMes(mes) }}</span></h2>
              <p v-if="!informe.mes.gastos.length" class="empty">Nada en este mes.</p>
              <ul v-else class="list mt-2">
                <li v-for="g in informe.mes.gastos" :key="g.id" class="list-row !py-2.5">
                  <div class="min-w-0">
                    <p class="flex flex-wrap items-center gap-1.5 text-sm text-ink-primary">
                      <span class="truncate">{{ g.descripcion || g.categoria?.nombre || 'Gasto' }}</span>
                      <span v-if="ETIQUETA_ORIGEN[g.origen]" class="badge-neutral">{{ ETIQUETA_ORIGEN[g.origen] }}</span>
                    </p>
                    <p class="text-xs text-ink-tertiary">
                      {{ formatDate(g.fecha) }}<template v-if="g.interes"> · {{ formatCurrency(g.interes) }} de interés</template>
                    </p>
                  </div>
                  <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-ink-primary">−{{ formatCurrency(g.monto) }}</span>
                </li>
              </ul>
            </section>

            <!-- Entradas o pagos a la tarjeta -->
            <section class="card card-pad">
              <template v-if="esTarjeta">
                <h2 class="section-title">Pagos a la tarjeta</h2>
                <p v-if="!informe.tarjeta.pagos.length" class="empty">Aún no has registrado pagos.</p>
                <ul v-else class="list mt-2">
                  <li v-for="p in informe.tarjeta.pagos" :key="p.id" class="list-row !py-2.5">
                    <div class="min-w-0">
                      <p class="text-sm text-ink-primary">{{ formatDate(p.fecha) }}</p>
                      <p class="text-xs text-ink-tertiary">Desde {{ p.metodoPago?.nombre ?? 'sin definir' }}</p>
                    </div>
                    <span class="shrink-0 text-right">
                      <span class="block whitespace-nowrap text-sm font-semibold text-positive">{{ formatCurrency(p.monto) }}</span>
                      <span v-if="p.montoUsd" class="block text-xs text-ink-tertiary">por {{ formatUsd(p.montoUsd) }}</span>
                    </span>
                  </li>
                </ul>
              </template>
              <template v-else>
                <h2 class="section-title">Entradas de <span class="capitalize">{{ nombreMes(mes) }}</span></h2>
                <p v-if="!informe.mes.ingresos.length" class="empty">Nada en este mes.</p>
                <ul v-else class="list mt-2">
                  <li v-for="i in informe.mes.ingresos" :key="i.id" class="list-row !py-2.5">
                    <div class="min-w-0">
                      <p class="truncate text-sm text-ink-primary">{{ i.descripcion || 'Ingreso' }}</p>
                      <p class="text-xs text-ink-tertiary">{{ formatDate(i.fecha) }}</p>
                    </div>
                    <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-positive">+{{ formatCurrency(i.monto) }}</span>
                  </li>
                </ul>
              </template>
            </section>
          </div>
        </template>
      </template>
    </div>
  </AppLayout>
</template>
