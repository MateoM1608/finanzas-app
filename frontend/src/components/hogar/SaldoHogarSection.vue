<script setup>
import { ref, computed, onMounted } from 'vue';
import { obtenerSaldoHogar } from '../../api/cuadres.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, formatearBalances } from '../../utils/format.js';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';
import { useAuthStore } from '../../stores/auth.js';

/** Saldo en vivo: quién le debe a quién con todo lo pagado y sin cuadrar hasta hoy. */
const saldo = ref(null);
const loading = ref(true);
const error = ref('');

async function cargar() {
  error.value = '';
  try {
    saldo.value = await obtenerSaldoHogar();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(cargar);
defineExpose({ recargar: cargar });

const auth = useAuthStore();
const puedeCuadrar = computed(() => Boolean(auth.usuario?.esAdmin || auth.usuario?.puedeEditarGastos));
const alDia = computed(() => !saldo.value || saldo.value.balances.every((b) => b.balance === 0));
const frase = computed(() => (saldo.value ? formatearBalances(saldo.value.balances) : ''));
</script>

<template>
  <section class="card-brand card-pad relative overflow-hidden" aria-labelledby="saldo-hogar-titulo">
    <AlertError :message="error" />

    <div v-if="loading" class="animate-pulse" aria-busy="true">
      <div class="h-3 w-28 rounded bg-surface-sunken" />
      <div class="mt-4 h-8 w-72 max-w-full rounded bg-surface-sunken" />
    </div>

    <div v-else-if="saldo" class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <p id="saldo-hogar-titulo" class="stat-label flex items-center gap-1.5">
          <AppIcon name="scale" class="h-3.5 w-3.5" />
          Saldo de hoy
        </p>
        <p class="mt-2 text-[1.375rem] sm:text-[1.875rem] font-extrabold leading-tight tracking-[-0.025em] text-ink-primary text-balance">
          {{ alDia ? 'Están a paz y salvo' : frase }}
        </p>
        <p class="mt-1.5 text-[13px] text-ink-tertiary">
          <template v-if="saldo.cantidadSinCuadrar">
            {{ saldo.cantidadSinCuadrar }} {{ saldo.cantidadSinCuadrar === 1 ? 'gasto pagado' : 'gastos pagados' }} sin
            cuadrar · {{ formatCurrency(saldo.totalSinCuadrar) }}
          </template>
          <template v-else>No hay gastos pagados pendientes de cuadrar.</template>
        </p>
      </div>
      <p v-if="saldo.cantidadSinCuadrar && !puedeCuadrar" class="shrink-0 self-start text-[13px] text-ink-tertiary sm:max-w-[14rem]">
        Para cuadrar, pídele a quien administra el hogar que lo inicie (o que te dé permiso de editar gastos).
      </p>
      <router-link
        v-else-if="saldo.cantidadSinCuadrar"
        :to="{ name: 'cuadres', query: { iniciar: '1' } }"
        class="btn-primary shrink-0 self-start sm:self-auto"
      >
        <AppIcon name="scale" class="h-4 w-4" />
        Cuadrar cuentas
      </router-link>
    </div>
  </section>
</template>
