<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import {
  listarCortes,
  obtenerCorteAbierto,
  iniciarCorte,
  togglearItem,
  actualizarItemCorte,
  confirmarCorte,
} from '../api/cortes.js';
import { listarMiembros } from '../api/hogares.js';
import { extractErrorMessage } from '../api/client.js';
import { formatCurrency, formatDate, formatearBalances } from '../utils/format.js';
import AppHeader from '../components/AppHeader.vue';
import AlertError from '../components/AlertError.vue';

const corteAbierto = ref(null);
const historial = ref([]);
const miembros = ref([]);
const loading = ref(true);
const error = ref('');
const motivoSinPendientes = ref('');
const iniciando = ref(false);
const confirmando = ref(false);
const guardandoItemId = ref(null);
const expandidoId = ref(null);
const montosLocales = reactive({});

const TIPO_ORIGEN_LABEL = { recurrente: 'Recurrente', variable: 'Variable' };

function onToggleExpandido(corteId) {
  expandidoId.value = expandidoId.value === corteId ? null : corteId;
}

function resumenCorte(corte) {
  const liquidados = corte.items.filter((i) => i.incluido);
  const totalRecurrentes = liquidados
    .filter((i) => i.tipoOrigen === 'recurrente')
    .reduce((acc, i) => acc + i.monto, 0);
  const totalVariables = liquidados
    .filter((i) => i.tipoOrigen === 'variable')
    .reduce((acc, i) => acc + i.monto, 0);

  const pagosPorMiembro = new Map();
  for (const i of liquidados) {
    if (!i.pagador) continue;
    const actual = pagosPorMiembro.get(i.pagador.id) ?? { nombre: i.pagador.nombre, total: 0 };
    actual.total += i.monto;
    pagosPorMiembro.set(i.pagador.id, actual);
  }

  return {
    totalRecurrentes,
    totalVariables,
    total: totalRecurrentes + totalVariables,
    pagos: [...pagosPorMiembro.values()],
  };
}

function esMontoEditable(item) {
  return item.tipoOrigen === 'recurrente' && item.tipoMonto === 'variable';
}

async function onGuardarMonto(item) {
  const nuevoMonto = Number(montosLocales[item.id]);
  if (!nuevoMonto || nuevoMonto === item.monto) return;
  error.value = '';
  guardandoItemId.value = item.id;
  try {
    corteAbierto.value = await actualizarItemCorte(corteAbierto.value.id, item.id, { monto: nuevoMonto });
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoItemId.value = null;
  }
}

async function onCambiarPagador(item, usuarioId) {
  if (!usuarioId) return;
  error.value = '';
  guardandoItemId.value = item.id;
  try {
    corteAbierto.value = await actualizarItemCorte(corteAbierto.value.id, item.id, {
      pagoUsuarioId: usuarioId,
    });
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoItemId.value = null;
  }
}

const previewBalances = computed(() => {
  if (!corteAbierto.value) return [];
  const balances = new Map();
  const sumar = (usuario, delta) => {
    const actual = balances.get(usuario.id) ?? { usuario, balance: 0 };
    actual.balance += delta;
    balances.set(usuario.id, actual);
  };

  // Solo suma ítems ya completos (monto + pagador) — los que aún faltan se
  // bloquean en el botón de confirmar, no tiene sentido netearlos a medias.
  for (const item of corteAbierto.value.items.filter((i) => i.incluido && i.monto != null && i.pagador)) {
    sumar(item.pagador, item.monto);
    for (const r of item.repartos) sumar(r.usuario, -r.monto);
  }

  return [...balances.values()];
});

const faltaPagador = computed(
  () => corteAbierto.value?.items.some((i) => i.incluido && !i.pagador) ?? false,
);
const faltaMonto = computed(
  () => corteAbierto.value?.items.some((i) => i.incluido && i.monto == null) ?? false,
);

// Agrupa el corte abierto en [Gastos recurrentes] [Gastos variables] con el
// subtotal de cada uno (solo lo que sigue incluido) — así se ve de un
// vistazo cuánto pesa cada tipo antes de cerrar.
const gruposCorte = computed(() => {
  if (!corteAbierto.value) return [];
  const grupos = [
    { key: 'recurrente', label: 'Gastos recurrentes' },
    { key: 'variable', label: 'Gastos variables' },
  ]
    .map((g) => ({ ...g, items: corteAbierto.value.items.filter((i) => i.tipoOrigen === g.key) }))
    .filter((g) => g.items.length);

  return grupos.map((g) => {
    const incluidos = g.items.filter((i) => i.incluido);
    return {
      ...g,
      subtotal: incluidos.reduce((acc, i) => acc + (i.monto ?? 0), 0),
      faltaMonto: incluidos.some((i) => i.monto == null),
    };
  });
});

function sincronizarMontosLocales(corte) {
  if (!corte) return;
  for (const item of corte.items) {
    montosLocales[item.id] = item.monto ?? '';
  }
}

async function cargar() {
  loading.value = true;
  error.value = '';
  try {
    const [abierto, cortes, listaMiembros] = await Promise.all([
      obtenerCorteAbierto(),
      listarCortes(),
      listarMiembros(),
    ]);
    corteAbierto.value = abierto;
    historial.value = cortes.filter((c) => c.estado === 'cerrado');
    miembros.value = listaMiembros;
    sincronizarMontosLocales(abierto);
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
      sincronizarMontosLocales(corte);
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
    sincronizarMontosLocales(corteAbierto.value);
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

          <div v-for="grupo in gruposCorte" :key="grupo.key" class="mb-6 last:mb-0">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-semibold text-ink-primary">{{ grupo.label }}</h4>
              <span class="text-sm font-medium" :class="grupo.faltaMonto ? 'text-negative' : 'text-ink-primary'">
                {{ grupo.faltaMonto ? 'Falta definir algún monto' : formatCurrency(grupo.subtotal) }}
              </span>
            </div>

            <ul class="divide-y divide-border">
              <li v-for="item in grupo.items" :key="item.id" class="py-4">
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
                      <span class="text-ink-primary font-medium">{{ item.nombre }}</span>
                      <span class="block text-sm text-ink-tertiary mt-0.5">
                        Reparto:
                        {{ item.repartos.map((r) => `${r.usuario.nombre} ${formatCurrency(r.monto)}`).join(' · ') || '(sin definir)' }}
                      </span>
                    </span>
                  </label>

                  <div class="flex flex-col items-end gap-2 shrink-0">
                    <input
                      v-if="esMontoEditable(item)"
                      v-model="montosLocales[item.id]"
                      type="number"
                      class="field w-32 text-right"
                      placeholder="Monto"
                      :disabled="guardandoItemId === item.id"
                      @change="onGuardarMonto(item)"
                    />
                    <span
                      v-else
                      class="font-medium"
                      :class="item.monto == null ? 'text-negative' : 'text-ink-primary'"
                    >
                      {{ item.monto == null ? 'Falta el monto' : formatCurrency(item.monto) }}
                    </span>

                    <select
                      class="field !w-auto text-sm"
                      :class="{ '!border-negative': !item.pagador }"
                      :value="item.pagador?.id ?? ''"
                      :disabled="guardandoItemId === item.id"
                      @change="onCambiarPagador(item, $event.target.value)"
                    >
                      <option value="" disabled>¿Quién pagó?</option>
                      <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
                    </select>
                  </div>
                </div>
              </li>
            </ul>
          </div>

          <div class="mt-5 pt-4 border-t border-border space-y-3">
            <p v-if="faltaMonto" class="text-sm text-negative">
              Falta definir el monto de algún ítem incluido — complétalo arriba o desmárcalo.
            </p>
            <p v-if="faltaPagador" class="text-sm text-negative">
              Falta definir quién pagó en algún ítem incluido — complétalo arriba o desmárcalo.
            </p>
            <p class="text-sm text-ink-secondary">
              Balance si confirmas ahora:
              <span class="text-ink-primary font-medium">{{ formatearBalances(previewBalances) }}</span>
            </p>
            <button
              class="btn-primary"
              :disabled="confirmando || faltaPagador || faltaMonto"
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
              <div>
                <p class="text-ink-primary font-medium">Corte del {{ formatDate(corte.fechaNominal) }}</p>
                <p class="text-sm text-ink-tertiary">
                  Ejecutado {{ formatDate(corte.fechaEjecucion) }} · {{ corte.items.filter((i) => i.incluido).length }} ítems liquidados
                </p>
              </div>

              <div class="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p class="text-ink-tertiary text-xs">Recurrentes</p>
                  <p class="text-ink-primary font-medium">{{ formatCurrency(resumenCorte(corte).totalRecurrentes) }}</p>
                </div>
                <div>
                  <p class="text-ink-tertiary text-xs">Variables</p>
                  <p class="text-ink-primary font-medium">{{ formatCurrency(resumenCorte(corte).totalVariables) }}</p>
                </div>
                <div v-for="pago in resumenCorte(corte).pagos" :key="pago.nombre">
                  <p class="text-ink-tertiary text-xs">Pagó {{ pago.nombre }}</p>
                  <p class="text-ink-primary font-medium">{{ formatCurrency(pago.total) }}</p>
                </div>
              </div>

              <p class="mt-3 text-sm text-ink-secondary">
                Ajuste final:
                <span class="text-ink-primary font-medium">{{ formatearBalances(corte.balances) }}</span>
              </p>

              <button
                class="text-sm text-accent hover:text-accent-hover mt-2"
                @click="onToggleExpandido(corte.id)"
              >
                {{ expandidoId === corte.id ? 'Ocultar detalle' : 'Ver detalle por ítem' }}
              </button>

              <ul v-if="expandidoId === corte.id" class="mt-3 divide-y divide-border bg-surface-raised rounded-xl px-4">
                <li v-for="item in corte.items" :key="item.id" class="py-3 flex items-start justify-between gap-4">
                  <span>
                    <span class="block text-sm text-ink-primary" :class="{ 'opacity-50 line-through': !item.incluido }">
                      {{ item.nombre }}
                      <span class="text-xs text-ink-tertiary font-normal">({{ TIPO_ORIGEN_LABEL[item.tipoOrigen] }})</span>
                    </span>
                    <span class="block text-xs text-ink-tertiary">
                      Pagó {{ item.pagador?.nombre ?? '(sin definir)' }} · Reparto:
                      {{ item.repartos.map((r) => `${r.usuario.nombre} ${formatCurrency(r.monto)}`).join(' · ') }}
                    </span>
                    <span v-if="!item.incluido" class="text-xs text-ink-tertiary italic">
                      Pospuesto — no se liquidó en este corte
                    </span>
                  </span>
                  <span class="text-sm text-ink-primary font-medium shrink-0">{{ formatCurrency(item.monto) }}</span>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </template>
    </main>
  </div>
</template>
