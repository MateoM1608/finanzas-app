<script setup>
import { ref, computed, onMounted } from 'vue';
import {
  listarCortes,
  obtenerCorteAbierto,
  iniciarCorte,
  togglearItem,
  confirmarCorte,
} from '../api/cortes.js';
import { extractErrorMessage } from '../api/client.js';
import { formatCurrency, formatDate, formatearBalances } from '../utils/format.js';
import AppHeader from '../components/AppHeader.vue';
import AlertError from '../components/AlertError.vue';

const corteAbierto = ref(null);
const historial = ref([]);
const loading = ref(true);
const error = ref('');
const motivoSinPendientes = ref('');
const iniciando = ref(false);
const confirmando = ref(false);
const guardandoItemId = ref(null);

const previewBalances = computed(() => {
  if (!corteAbierto.value) return [];
  const balances = new Map();
  const sumar = (usuario, delta) => {
    const actual = balances.get(usuario.id) ?? { usuario, balance: 0 };
    actual.balance += delta;
    balances.set(usuario.id, actual);
  };

  for (const item of corteAbierto.value.items.filter((i) => i.incluido)) {
    if (item.pagador) sumar(item.pagador, item.monto);
    for (const r of item.repartos) sumar(r.usuario, -r.monto);
  }

  return [...balances.values()];
});

const faltaPagador = computed(
  () => corteAbierto.value?.items.some((i) => i.incluido && !i.pagador) ?? false,
);

async function cargar() {
  loading.value = true;
  error.value = '';
  try {
    const [abierto, cortes] = await Promise.all([obtenerCorteAbierto(), listarCortes()]);
    corteAbierto.value = abierto;
    historial.value = cortes.filter((c) => c.estado === 'cerrado');
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onIniciarCorte() {
  error.value = '';
  motivoSinPendientes.value = '';
  iniciando.value = true;
  try {
    const { corte, motivo } = await iniciarCorte();
    if (corte) {
      corteAbierto.value = corte;
    } else {
      motivoSinPendientes.value = motivo;
    }
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    iniciando.value = false;
  }
}

async function onToggleItem(item) {
  error.value = '';
  guardandoItemId.value = item.id;
  try {
    corteAbierto.value = await togglearItem(corteAbierto.value.id, item.id, !item.incluido);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoItemId.value = null;
  }
}

async function onConfirmar() {
  if (!confirm('¿Confirmar este corte? Los ítems incluidos quedarán liquidados y no se podrán editar.')) return;
  error.value = '';
  confirmando.value = true;
  try {
    const cerrado = await confirmarCorte(corteAbierto.value.id);
    corteAbierto.value = null;
    historial.value = [cerrado, ...historial.value];
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    confirmando.value = false;
  }
}

onMounted(cargar);
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div>
        <h1 class="text-2xl font-semibold text-ink-primary">Cortes</h1>
        <p class="text-ink-secondary mt-1.5 text-sm">
          Liquidación de gastos compartidos: revisa qué incluir y confirma.
        </p>
      </div>

      <AlertError :message="error" />

      <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>

      <template v-else>
        <div v-if="!corteAbierto" class="card p-6 sm:p-8">
          <h3 class="text-base font-semibold text-ink-primary mb-1">Iniciar un corte</h3>
          <p class="text-sm text-ink-secondary mb-5">
            Junta todo lo pendiente hasta el próximo punto de corte del hogar y lo deja listo para revisar.
          </p>
          <button class="btn-primary" :disabled="iniciando" @click="onIniciarCorte">
            {{ iniciando ? 'Buscando pendientes…' : 'Iniciar corte' }}
          </button>
          <p v-if="motivoSinPendientes" class="text-sm text-ink-tertiary mt-3">
            {{ motivoSinPendientes }}
          </p>
        </div>

        <div v-else class="card p-6 sm:p-8">
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-base font-semibold text-ink-primary">
              Corte del {{ formatDate(corteAbierto.fechaNominal) }}
            </h3>
          </div>
          <p class="text-sm text-ink-secondary mb-5">
            Desmarca lo que todavía no se ha pagado en la realidad — queda pendiente y pasa solo al próximo corte.
          </p>

          <ul class="divide-y divide-border">
            <li v-for="item in corteAbierto.items" :key="item.id" class="py-4">
              <div class="flex items-start justify-between gap-4">
                <label class="flex items-start gap-3">
                  <input
                    type="checkbox"
                    class="mt-1"
                    :checked="item.incluido"
                    :disabled="guardandoItemId === item.id"
                    @change="onToggleItem(item)"
                  />
                  <span>
                    <span class="block text-ink-primary font-medium">{{ item.nombre }}</span>
                    <span class="block text-sm text-ink-tertiary">
                      Pagó {{ item.pagador?.nombre ?? '(sin definir)' }} · Reparto:
                      {{ item.repartos.map((r) => `${r.usuario.nombre} ${formatCurrency(r.monto)}`).join(' · ') }}
                    </span>
                  </span>
                </label>
                <span class="text-ink-primary font-medium shrink-0">{{ formatCurrency(item.monto) }}</span>
              </div>
            </li>
          </ul>

          <div class="mt-5 pt-4 border-t border-border space-y-3">
            <p v-if="faltaPagador" class="text-sm text-negative">
              Falta definir quién pagó en algún ítem incluido — complétalo en Panel del hogar o desmárcalo.
            </p>
            <p class="text-sm text-ink-secondary">
              Balance si confirmas ahora:
              <span class="text-ink-primary font-medium">{{ formatearBalances(previewBalances) }}</span>
            </p>
            <button
              class="btn-primary"
              :disabled="confirmando || faltaPagador"
              @click="onConfirmar"
            >
              {{ confirmando ? 'Confirmando…' : 'Confirmar corte' }}
            </button>
          </div>
        </div>

        <div class="card p-6 sm:p-8">
          <h3 class="text-base font-semibold text-ink-primary mb-5">Historial</h3>

          <p v-if="!historial.length" class="text-sm text-ink-secondary">
            Todavía no hay cortes cerrados.
          </p>

          <ul v-else class="divide-y divide-border">
            <li v-for="corte in historial" :key="corte.id" class="py-4">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-ink-primary font-medium">Corte del {{ formatDate(corte.fechaNominal) }}</p>
                  <p class="text-sm text-ink-tertiary">
                    Ejecutado {{ formatDate(corte.fechaEjecucion) }} · {{ corte.items.filter((i) => i.incluido).length }} ítems
                  </p>
                </div>
                <span class="text-sm text-ink-primary font-medium text-right">
                  {{ formatearBalances(corte.balances) }}
                </span>
              </div>
            </li>
          </ul>
        </div>
      </template>
    </main>
  </div>
</template>
