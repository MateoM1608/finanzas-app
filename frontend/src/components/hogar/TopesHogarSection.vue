<script setup>
import { ref, onMounted } from 'vue';
import { resumenTopesHogar } from '../../api/categoriasHogar.js';
import { formatCurrency } from '../../utils/format.js';

/**
 * Topes de gasto mensual del hogar (E4): una tarjeta por tope con lo pagado
 * este mes contra el tope, lo que falta por pagar y cómo cerró el mes pasado.
 * Si no hay topes, no se muestra nada (se crean en Configuración).
 */
const resumen = ref(null);

async function cargar() {
  try {
    resumen.value = await resumenTopesHogar();
  } catch {
    // Informativo.
  }
}
onMounted(cargar);
defineExpose({ recargar: cargar });

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nombreMes = (clave) => MESES[Number(clave.split('-')[1]) - 1];

const ESTILO = {
  dentro: { badge: 'badge-positive', texto: 'Dentro', barra: 'bg-positive' },
  cerca: { badge: 'badge-warning', texto: 'Cerca', barra: 'bg-warning' },
  excedido: { badge: 'badge-negative', texto: 'Excedido', barra: 'bg-negative' },
};
const ancho = (t) => Math.min(100, Math.max(0, t.porcentaje)) + '%';
</script>

<template>
  <section v-if="resumen?.topes.length" class="card card-pad" aria-labelledby="topes-hogar-titulo">
    <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="topes-hogar-titulo" class="section-title">Topes de {{ nombreMes(resumen.mes) }}</h2>
      <router-link :to="{ name: 'settings', query: { tab: 'categorias' } }" class="text-[13px] text-accent hover:underline">Configurar</router-link>
    </div>
    <div class="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <div
        v-for="t in resumen.topes"
        :key="t.id"
        class="panel-sunken min-w-0 p-3 sm:p-4"
        :class="t.estado === 'excedido' ? 'border-negative/30' : ''"
      >
        <div class="flex flex-wrap items-start justify-between gap-1.5">
          <p class="truncate text-[13px] font-medium text-ink-primary sm:text-sm">{{ t.nombre }}</p>
          <span :class="ESTILO[t.estado].badge" class="shrink-0">{{ ESTILO[t.estado].texto }}</span>
        </div>
        <p class="mt-2 text-xs text-ink-tertiary sm:text-[13px]">
          <span class="block text-sm font-semibold tracking-tight text-ink-primary sm:inline sm:text-base">{{ formatCurrency(t.gastado) }}</span>
          de {{ formatCurrency(t.montoMensual) }}
        </p>
        <div
          class="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
          role="progressbar"
          :aria-valuenow="t.porcentaje"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`Gastado del tope de ${t.nombre}`"
        >
          <div class="h-full rounded-full transition-[width] duration-500 ease-out" :class="ESTILO[t.estado].barra" :style="{ width: ancho(t) }" />
        </div>
        <p class="mt-2 text-xs font-medium sm:text-[13px]" :class="t.estado === 'excedido' ? 'text-negative' : 'text-ink-secondary'">
          <template v-if="t.estado === 'excedido'">Se pasaron por {{ formatCurrency(-t.restante) }}</template>
          <template v-else>Quedan {{ formatCurrency(t.restante) }}</template>
        </p>
        <p v-if="t.porPagar" class="mt-0.5 text-xs text-ink-tertiary">Por pagar este mes: {{ formatCurrency(t.porPagar) }}</p>
        <p v-if="t.mesAnterior" class="mt-1 text-xs text-ink-tertiary">
          {{ nombreMes(resumen.mesAnterior) }}: {{ formatCurrency(t.mesAnterior.gastado) }} de {{ formatCurrency(t.mesAnterior.montoTope) }}
          <span :class="t.mesAnterior.estado === 'excedido' ? 'text-negative' : 'text-positive'">
            {{ t.mesAnterior.estado === 'excedido' ? '· excedido' : '· dentro' }}
          </span>
        </p>
      </div>
    </div>
  </section>
</template>
