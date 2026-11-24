<script setup>
import { ref, reactive, onMounted } from 'vue';
import { obtenerResumenAhorros, registrarAporte } from '../../api/ahorrosPersonales.js';
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

const loading = ref(true);
const error = ref('');
const resumen = ref(null);
const aportandoId = ref(null);
const montoAporte = reactive({});
const guardandoAporteId = ref(null);

async function cargar() {
  loading.value = true;
  error.value = '';
  try {
    resumen.value = await obtenerResumenAhorros();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(cargar);
defineExpose({ recargar: cargar });

function periodoActual(meta) {
  return meta.periodos[0] ?? null;
}

// Solo presentación: % ahorrado este ciclo vs el monto sugerido, acotado a 0–100.
function pctCiclo(periodo) {
  const sugerido = Number(periodo.montoSugerido) || 0;
  if (sugerido <= 0) return Number(periodo.montoAhorradoReal) > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, (Number(periodo.montoAhorradoReal) / sugerido) * 100));
}

function onMostrarAporte(meta) {
  aportandoId.value = meta.id;
  montoAporte[meta.id] = '';
}

async function onRegistrarAporte(meta) {
  error.value = '';
  guardandoAporteId.value = meta.id;
  try {
    await registrarAporte(meta.id, { monto: Number(montoAporte[meta.id]) });
    aportandoId.value = null;
    await cargar();
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
      <div class="mb-5">
        <p class="stat-label">Ahorrado en total</p>
        <p class="mt-1 text-3xl font-semibold tracking-tight text-ink-primary">
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
        Aún no tienes metas de ahorro. Créalas con «Configurar».
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
            <button
              v-if="meta.modoTransaccion === 'manual' && aportandoId !== meta.id"
              class="btn-secondary btn-sm shrink-0"
              @click="onMostrarAporte(meta)"
            >
              <AppIcon name="plus" class="h-3.5 w-3.5" />
              Registrar aporte
            </button>
          </div>

          <div v-if="periodoActual(meta)" class="mt-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-[13px] text-ink-secondary">
                <span class="font-medium text-ink-primary">{{
                  formatCurrency(periodoActual(meta).montoAhorradoReal)
                }}</span>
                este ciclo
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
            Este ciclo todavía no se ha evaluado (faltan obligatorios por pagar).
          </p>

          <div v-if="aportandoId === meta.id" class="panel-sunken mt-3 flex flex-wrap items-center gap-2 p-3">
            <input
              v-model="montoAporte[meta.id]"
              type="number"
              inputmode="numeric"
              class="field min-w-0 flex-1 sm:max-w-[12rem]"
              placeholder="Monto (COP)"
              aria-label="Monto del aporte"
            />
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
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
