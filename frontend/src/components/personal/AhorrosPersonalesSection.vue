<script setup>
import { ref, reactive, onMounted } from 'vue';
import { obtenerResumenAhorros, registrarAporte } from '../../api/ahorrosPersonales.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import AlertError from '../AlertError.vue';

const ESTADO_INFO = {
  amarillo: { clase: 'bg-yellow-100 text-yellow-800', texto: (p) => `Pronóstico ${formatCurrency(p.montoSugerido)}` },
  azul: { clase: 'bg-accent-muted text-accent', texto: () => 'Meta cumplida' },
  verde: { clase: 'bg-positive/10 text-positive', texto: () => 'Superaste el pronóstico' },
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
    <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>

    <template v-else>
      <div class="flex items-center justify-between mb-5">
        <div>
          <p class="text-sm text-ink-secondary mb-1">Ahorrado en total</p>
          <p class="text-2xl font-semibold text-ink-primary">{{ formatCurrency(resumen.totalAhorradoAcumulado) }}</p>
        </div>
      </div>

      <p v-if="resumen.alertaSobregasto" class="text-sm text-negative bg-negative/10 border border-negative/20 rounded-xl px-3.5 py-2.5 mb-5">
        Vas a tener que recortar gastos más adelante en este período si quieres cumplir tus metas de ahorro.
      </p>

      <p v-if="!resumen.metas.length" class="text-sm text-ink-secondary">
        Aún no tienes metas de ahorro — créalas en "Configuración personal".
      </p>

      <ul v-else class="divide-y divide-border">
        <li v-for="meta in resumen.metas" :key="meta.id" class="py-4" :class="{ 'opacity-50': !meta.activo }">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-ink-primary font-medium">
                {{ meta.nombre }}
                <span v-if="meta.categoria" class="text-xs text-ink-tertiary font-normal">({{ meta.categoria }})</span>
              </p>
              <p class="text-sm text-ink-tertiary">
                Ahorrado {{ formatCurrency(meta.totalAhorrado) }}
                <template v-if="meta.montoMetaTotal">
                  de {{ formatCurrency(meta.montoMetaTotal) }} ({{ meta.progresoPct.toFixed(0) }}%)
                </template>
              </p>
            </div>
            <button
              v-if="meta.modoTransaccion === 'manual'"
              class="text-sm text-accent hover:text-accent-hover shrink-0"
              @click="onMostrarAporte(meta)"
            >
              Registrar aporte
            </button>
          </div>

          <div v-if="periodoActual(meta)" class="mt-2">
            <span
              class="text-xs font-semibold px-2 py-0.5 rounded-full"
              :class="ESTADO_INFO[periodoActual(meta).estado].clase"
            >
              {{ formatCurrency(periodoActual(meta).montoAhorradoReal) }} este ciclo ·
              {{ ESTADO_INFO[periodoActual(meta).estado].texto(periodoActual(meta)) }}
            </span>
          </div>
          <p v-else class="text-xs text-ink-tertiary mt-2">
            Este ciclo todavía no se ha evaluado (faltan obligatorios por pagar).
          </p>

          <div v-if="aportandoId === meta.id" class="mt-3 flex items-center gap-2">
            <input
              v-model="montoAporte[meta.id]"
              type="number"
              class="field w-40"
              placeholder="Monto (COP)"
            />
            <button
              class="btn-primary !px-3 !py-1.5 text-sm"
              :disabled="guardandoAporteId === meta.id"
              @click="onRegistrarAporte(meta)"
            >
              Guardar
            </button>
            <button class="btn-ghost !px-3 !py-1.5 text-sm" @click="aportandoId = null">Cancelar</button>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
