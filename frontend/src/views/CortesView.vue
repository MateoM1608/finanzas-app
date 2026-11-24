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
import { formatCurrency, formatDate, formatDateLocal, formatearBalances, formatReparto } from '../utils/format.js';
import AppLayout from '../components/AppLayout.vue';
import AlertError from '../components/AlertError.vue';
import AppIcon from '../components/AppIcon.vue';
import AppModal from '../components/AppModal.vue';

const corteAbierto = ref(null);
const historial = ref([]);
const miembros = ref([]);
const loading = ref(true);
const error = ref('');
const motivoSinPendientes = ref('');
const iniciando = ref(false);
const confirmando = ref(false);
const pidiendoConfirmacion = ref(false);
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

// El cierre es irreversible: se pide confirmación en un modal propio
// (antes un confirm() nativo) y solo entonces se llama al backend.
function onConfirmar() {
  pidiendoConfirmacion.value = true;
}

async function ejecutarConfirmacion() {
  pidiendoConfirmacion.value = false;
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
  <AppLayout title="Cortes" subtitle="Liquidación de gastos compartidos: revisa qué incluir y confirma.">
    <div class="space-y-6">

      <AlertError :message="error" />

      <div v-if="loading" class="card card-pad">
        <p class="text-sm text-ink-tertiary">Cargando…</p>
      </div>

      <template v-else>
        <!-- Sin corte abierto: invitación a iniciar uno -->
        <section v-if="!corteAbierto" class="card card-pad" aria-labelledby="iniciar-corte-titulo">
          <div class="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <AppIcon name="scale" class="h-5 w-5" />
            </span>
            <div class="min-w-0 flex-1">
              <h2 id="iniciar-corte-titulo" class="section-title">Iniciar un corte</h2>
              <p class="section-hint">
                Junta todo lo pendiente hasta el próximo punto de corte del hogar y lo deja listo para revisar.
              </p>
            </div>
            <button class="btn-primary w-full sm:w-auto shrink-0" :disabled="iniciando" @click="onIniciarCorte">
              <AppIcon name="plus" class="h-4 w-4" />
              {{ iniciando ? 'Buscando pendientes…' : 'Iniciar corte' }}
            </button>
          </div>
          <p
            v-if="motivoSinPendientes"
            class="panel-sunken mt-4 flex items-start gap-2 px-3.5 py-3 text-[13px] text-ink-secondary"
          >
            <AppIcon name="info" class="h-4 w-4 mt-0.5 shrink-0 text-ink-tertiary" />
            <span>{{ motivoSinPendientes }}</span>
          </p>
        </section>

        <!-- Corte abierto: la acción principal de la pantalla -->
        <section
          v-else
          class="card overflow-hidden border-accent/40 ring-1 ring-accent/15"
          aria-labelledby="corte-abierto-titulo"
        >
          <div class="card-pad border-b border-border bg-accent/[0.04]">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2 mb-1.5">
                  <span class="badge-accent">
                    <span class="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                    Abierto
                  </span>
                  <span v-if="corteAbierto.secuencia > 1" class="badge-neutral">Complementario</span>
                </div>
                <h2 id="corte-abierto-titulo" class="text-lg font-semibold tracking-tight text-ink-primary">
                  Corte del {{ formatDate(corteAbierto.fechaNominal) }}
                </h2>
              </div>
              <div class="text-left sm:text-right">
                <p class="stat-label">Total incluido</p>
                <p class="stat-value">
                  {{ formatCurrency(gruposCorte.reduce((acc, g) => acc + g.subtotal, 0)) }}
                </p>
              </div>
            </div>
            <p v-if="corteAbierto.secuencia > 1" class="text-[13px] text-ink-secondary mt-3">
              El corte de esta fecha ya se cerró: este solo liquida lo que apareció después, para netearlo hoy.
            </p>
            <p class="text-[13px] text-ink-secondary mt-2">
              Desmarca lo que todavía no se ha pagado en la realidad: queda pendiente y pasa solo al próximo corte.
            </p>
          </div>

          <div class="card-pad space-y-6">
            <div v-for="grupo in gruposCorte" :key="grupo.key">
              <div class="flex items-center justify-between gap-3 mb-1">
                <h3 class="flex items-center gap-2 text-sm font-semibold text-ink-primary">
                  <AppIcon :name="grupo.key === 'recurrente' ? 'repeat' : 'receipt'" class="h-4 w-4 text-ink-tertiary" />
                  {{ grupo.label }}
                  <span class="badge-neutral">{{ grupo.items.length }}</span>
                </h3>
                <span v-if="grupo.faltaMonto" class="badge-negative">
                  <AppIcon name="alert" class="h-3 w-3" />
                  Falta definir algún monto
                </span>
                <span v-else class="text-sm font-semibold text-ink-primary">
                  {{ formatCurrency(grupo.subtotal) }}
                </span>
              </div>

              <ul class="list">
                <li
                  v-for="item in grupo.items"
                  :key="item.id"
                  class="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <label
                    class="flex items-start gap-3 min-w-0 cursor-pointer"
                    :class="{ 'opacity-60': !item.incluido }"
                  >
                    <input
                      type="checkbox"
                      class="checkbox mt-0.5 shrink-0"
                      :checked="item.incluido"
                      :disabled="guardandoItemId === item.id"
                      @change="onToggleItem(item)"
                    />
                    <span class="min-w-0">
                      <span class="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-primary">
                        {{ item.nombre }}
                        <span v-if="!item.incluido" class="badge-neutral">Pospuesto</span>
                      </span>
                      <span class="block text-[13px] text-ink-tertiary mt-0.5">
                        Reparto: {{ formatReparto(item.repartos) }}
                      </span>
                    </span>
                  </label>

                  <div class="flex items-center justify-end gap-2 pl-7 sm:pl-0 shrink-0">
                    <label :for="`pagador-item-${item.id}`" class="sr-only">Quién pagó {{ item.nombre }}</label>
                    <select
                      :id="`pagador-item-${item.id}`"
                      class="field !w-auto !py-1.5 !pl-2.5 !pr-8 !text-[13px] !rounded-lg"
                      :class="{ '!border-negative': !item.pagador }"
                      :value="item.pagador?.id ?? ''"
                      :disabled="guardandoItemId === item.id"
                      @change="onCambiarPagador(item, $event.target.value)"
                    >
                      <option value="" disabled>¿Quién pagó?</option>
                      <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
                    </select>

                    <template v-if="esMontoEditable(item)">
                      <label :for="`monto-item-${item.id}`" class="sr-only">Monto de {{ item.nombre }}</label>
                      <input
                        :id="`monto-item-${item.id}`"
                        v-model="montosLocales[item.id]"
                        type="number"
                        inputmode="numeric"
                        class="field !w-32 !py-1.5 !text-[13px] !rounded-lg text-right font-medium"
                        :class="{ '!border-negative': item.monto == null }"
                        placeholder="Monto"
                        :disabled="guardandoItemId === item.id"
                        @change="onGuardarMonto(item)"
                      />
                    </template>
                    <span v-else-if="item.monto == null" class="badge-negative">Falta el monto</span>
                    <span v-else class="w-32 text-right text-sm font-medium text-ink-primary">
                      {{ formatCurrency(item.monto) }}
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div class="card-pad border-t border-border bg-surface-raised space-y-4">
            <div v-if="faltaMonto || faltaPagador" class="space-y-2" role="status">
              <p v-if="faltaMonto" class="flex items-start gap-2 text-[13px] text-negative">
                <AppIcon name="alert" class="h-4 w-4 mt-0.5 shrink-0" />
                Falta definir el monto de algún ítem incluido. Complétalo arriba o desmárcalo.
              </p>
              <p v-if="faltaPagador" class="flex items-start gap-2 text-[13px] text-negative">
                <AppIcon name="alert" class="h-4 w-4 mt-0.5 shrink-0" />
                Falta definir quién pagó en algún ítem incluido. Complétalo arriba o desmárcalo.
              </p>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div class="min-w-0">
                <p class="stat-label">Balance si confirmas ahora</p>
                <p class="text-base font-semibold text-ink-primary mt-0.5">
                  {{ formatearBalances(previewBalances) || 'Sin ítems completos todavía' }}
                </p>
              </div>
              <button
                class="btn-primary w-full sm:w-auto px-6 py-3 text-[15px] shrink-0"
                :disabled="confirmando || faltaPagador || faltaMonto"
                @click="onConfirmar"
              >
                <AppIcon name="check" class="h-4 w-4" />
                {{ confirmando ? 'Confirmando…' : 'Confirmar corte' }}
              </button>
            </div>
          </div>
        </section>

        <!-- Historial -->
        <section class="card card-pad" aria-labelledby="historial-titulo">
          <h2 id="historial-titulo" class="section-title">Historial</h2>
          <p class="section-hint">Cortes cerrados, del más reciente al más antiguo.</p>

          <div v-if="!historial.length" class="empty flex flex-col items-center gap-2">
            <AppIcon name="clock" class="h-6 w-6" />
            Todavía no hay cortes cerrados.
          </div>

          <ul v-else class="list mt-3">
            <li v-for="corte in historial" :key="corte.id" class="py-4">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-primary">
                    Corte del {{ formatDate(corte.fechaNominal) }}
                    <span v-if="corte.secuencia > 1" class="badge-neutral">Complementario</span>
                    <span class="badge-positive">Cerrado</span>
                  </p>
                  <p class="text-[13px] text-ink-tertiary mt-1">
                    Ejecutado {{ formatDateLocal(corte.fechaEjecucion) }} · {{ corte.items.filter((i) => i.incluido).length }} ítems liquidados
                  </p>
                </div>
                <span class="shrink-0 text-right text-sm font-semibold text-ink-primary">
                  {{ formatCurrency(resumenCorte(corte).total) }}
                </span>
              </div>

              <dl class="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div class="panel-sunken px-3 py-2">
                  <dt class="text-[12px] text-ink-tertiary">Recurrentes</dt>
                  <dd class="text-sm font-medium text-ink-primary">{{ formatCurrency(resumenCorte(corte).totalRecurrentes) }}</dd>
                </div>
                <div class="panel-sunken px-3 py-2">
                  <dt class="text-[12px] text-ink-tertiary">Variables</dt>
                  <dd class="text-sm font-medium text-ink-primary">{{ formatCurrency(resumenCorte(corte).totalVariables) }}</dd>
                </div>
                <div v-for="pago in resumenCorte(corte).pagos" :key="pago.nombre" class="panel-sunken px-3 py-2 min-w-0">
                  <dt class="text-[12px] text-ink-tertiary truncate">Pagó {{ pago.nombre }}</dt>
                  <dd class="text-sm font-medium text-ink-primary">{{ formatCurrency(pago.total) }}</dd>
                </div>
              </dl>

              <div class="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p class="text-[13px] text-ink-secondary min-w-0">
                  Ajuste final:
                  <span class="font-medium text-ink-primary">{{ formatearBalances(corte.balances) }}</span>
                </p>
                <button
                  class="btn-ghost btn-sm -mr-2"
                  :aria-expanded="expandidoId === corte.id"
                  :aria-controls="`detalle-corte-${corte.id}`"
                  @click="onToggleExpandido(corte.id)"
                >
                  {{ expandidoId === corte.id ? 'Ocultar detalle' : 'Ver detalle por ítem' }}
                  <AppIcon
                    name="chevronDown"
                    class="h-4 w-4 transition-transform duration-150"
                    :class="{ 'rotate-180': expandidoId === corte.id }"
                  />
                </button>
              </div>

              <ul
                v-if="expandidoId === corte.id"
                :id="`detalle-corte-${corte.id}`"
                class="list panel-sunken mt-3 px-4"
              >
                <li v-for="item in corte.items" :key="item.id" class="py-3 flex items-start justify-between gap-4">
                  <span class="min-w-0">
                    <span class="flex flex-wrap items-center gap-2 text-sm text-ink-primary">
                      <span :class="{ 'opacity-60 line-through': !item.incluido }">{{ item.nombre }}</span>
                      <span class="badge-neutral">{{ TIPO_ORIGEN_LABEL[item.tipoOrigen] }}</span>
                      <span v-if="!item.incluido" class="badge-warning">Pospuesto</span>
                    </span>
                    <span class="block text-[13px] text-ink-tertiary mt-0.5">
                      Pagó {{ item.pagador?.nombre ?? '(sin definir)' }} · Reparto:
                      {{ formatReparto(item.repartos) }}
                    </span>
                    <span v-if="!item.incluido" class="block text-[12px] text-ink-tertiary mt-0.5">
                      No se liquidó en este corte.
                    </span>
                  </span>
                  <span
                    class="shrink-0 text-right text-sm font-medium"
                    :class="item.incluido ? 'text-ink-primary' : 'text-ink-tertiary'"
                  >
                    {{ formatCurrency(item.monto) }}
                  </span>
                </li>
              </ul>
            </li>
          </ul>
        </section>
      </template>
    </div>

    <AppModal v-if="pidiendoConfirmacion" title="Confirmar corte" @close="pidiendoConfirmacion = false">
      <div class="flex gap-3">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
          <AppIcon name="alert" class="h-5 w-5" />
        </span>
        <div>
          <p class="text-sm text-ink-primary">
            Los ítems incluidos quedarán liquidados y no se podrán editar.
          </p>
          <p class="mt-1.5 text-[13px] text-ink-secondary">
            Balance resultante: {{ formatearBalances(previewBalances) || 'sin ítems completos' }}
          </p>
        </div>
      </div>
      <div class="mt-6 flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="pidiendoConfirmacion = false">Cancelar</button>
        <button type="button" class="btn-primary" @click="ejecutarConfirmacion">
          <AppIcon name="check" class="h-4 w-4" />
          Sí, confirmar corte
        </button>
      </div>
    </AppModal>
  </AppLayout>
</template>
