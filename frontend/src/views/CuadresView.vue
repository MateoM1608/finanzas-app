<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  obtenerCuadreAbierto,
  iniciarCuadre,
  marcarItemCuadre,
  descartarCuadre,
  confirmarCuadre,
  listarCuadres,
} from '../api/cuadres.js';
import { extractErrorMessage } from '../api/client.js';
import { listarMetodosPago } from '../api/metodosPagoPersonales.js';
import { useAuthStore } from '../stores/auth.js';
import { confirmar } from '../composables/useConfirm.js';
import { formatCurrency, formatDate, formatearBalances, hoyISO } from '../utils/format.js';
import AppLayout from '../components/AppLayout.vue';
import AppIcon from '../components/AppIcon.vue';
import AppModal from '../components/AppModal.vue';
import AlertError from '../components/AlertError.vue';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const puedeEditar = computed(() => Boolean(auth.usuario?.esAdmin || auth.usuario?.puedeEditarGastos));

const borrador = ref(null);
const historial = ref([]);
const loading = ref(true);
const error = ref('');
const aviso = ref('');
const iniciando = ref(false);
const marcandoId = ref(null);
const pidiendoConfirmacion = ref(false);
const confirmando = ref(false);
const expandidoId = ref(null);
const misMetodos = ref([]);
const metodoLiquidacion = ref('');

async function cargar() {
  error.value = '';
  try {
    const [abierto, cerrados, metodos] = await Promise.all([obtenerCuadreAbierto(), listarCuadres(), listarMetodosPago()]);
    borrador.value = abierto;
    historial.value = cerrados;
    misMetodos.value = metodos.filter((m) => m.tipo !== 'tarjeta_credito');
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(async () => {
  await cargar();
  // Desde "Cuadrar cuentas" en Panel del hogar se llega con ?iniciar=1.
  if (route.query.iniciar) {
    router.replace({ name: 'cuadres' });
    if (!borrador.value && puedeEditar.value) await onIniciar();
  }
});

async function onIniciar() {
  error.value = '';
  aviso.value = '';
  iniciando.value = true;
  try {
    const { cuadre, motivo } = await iniciarCuadre();
    borrador.value = cuadre;
    if (!cuadre) aviso.value = motivo;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    iniciando.value = false;
  }
}

async function onMarcar(item) {
  marcandoId.value = item.id;
  error.value = '';
  try {
    borrador.value = await marcarItemCuadre(borrador.value.id, item.id, !item.incluido);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    marcandoId.value = null;
  }
}

async function onDescartar() {
  const ok = await confirmar('¿Descartar este cuadre? Los gastos vuelven a quedar pendientes de cuadrar.', {
    textoAceptar: 'Descartar',
    peligroso: true,
  });
  if (!ok) return;
  error.value = '';
  try {
    await descartarCuadre(borrador.value.id);
    borrador.value = null;
  } catch (e) {
    error.value = extractErrorMessage(e);
  }
}

async function ejecutarConfirmacion() {
  confirmando.value = true;
  error.value = '';
  try {
    const cerrado = await confirmarCuadre(borrador.value.id, metodoLiquidacion.value || undefined);
    pidiendoConfirmacion.value = false;
    borrador.value = null;
    historial.value = [cerrado, ...historial.value];
    expandidoId.value = cerrado.id;
  } catch (e) {
    pidiendoConfirmacion.value = false;
    error.value = extractErrorMessage(e);
  } finally {
    confirmando.value = false;
  }
}

// Lo pagado con fecha futura (cuotas automáticas, cuentas pagadas antes de
// tiempo) llega desmarcado en "Próximos": se marca solo si se quiere adelantar.
const grupos = computed(() => {
  const items = borrador.value?.items ?? [];
  const hoy = hoyISO();
  const esFuturo = (i) => String(i.fecha).slice(0, 10) > hoy;
  const vigentes = items.filter((i) => !esFuturo(i));
  return [
    { id: 'recurrente', titulo: 'Cuentas fijas', items: vigentes.filter((i) => i.tipoOrigen === 'recurrente') },
    { id: 'variable', titulo: 'Gastos variables', items: vigentes.filter((i) => i.tipoOrigen === 'variable') },
    {
      id: 'proximos',
      titulo: 'Próximos — márcalos si quieren adelantarlos',
      items: items.filter(esFuturo),
    },
  ].filter((g) => g.items.length);
});

const incluidos = computed(() => (borrador.value?.items ?? []).filter((i) => i.incluido));
const totalIncluido = computed(() => incluidos.value.reduce((acc, i) => acc + i.monto, 0));

/**
 * Vista previa del neto con lo marcado. Mismo cálculo que hace el backend al
 * confirmar (quien pagó suma el monto, cada uno resta su parte); el
 * definitivo es el que devuelve el backend.
 */
const preview = computed(() => {
  const nombres = new Map();
  const balance = new Map();
  const sumar = (id, delta) => balance.set(id, (balance.get(id) ?? 0) + delta);
  for (const item of incluidos.value) {
    nombres.set(item.pagador.id, item.pagador.nombre);
    sumar(item.pagador.id, item.monto);
    for (const r of item.repartos) {
      nombres.set(r.usuarioId, r.usuario.nombre);
      sumar(r.usuarioId, -r.monto);
    }
  }
  return [...nombres.entries()].map(([id, nombre]) => ({ usuario: { id, nombre }, balance: balance.get(id) ?? 0 }));
});

const textoPreview = computed(() => (preview.value.length ? formatearBalances(preview.value) : ''));

// Lo que le toca al usuario actual en la liquidación (positivo: recibe).
const miNeto = computed(() => {
  return preview.value.find((b) => b.usuario.id === auth.usuario?.id)?.balance ?? 0;
});

function totalCuadre(cuadre) {
  return cuadre.items.reduce((acc, i) => acc + i.monto, 0);
}

function textoBalances(cuadre) {
  return formatearBalances(cuadre.balances.map((b) => ({ usuario: b.usuario, balance: b.balance })));
}
</script>

<template>
  <AppLayout title="Cuadres" subtitle="Cuadren cuentas cuando quieran: entra todo lo pagado y sin cuadrar hasta hoy.">
    <div class="space-y-6">
      <AlertError :message="error" />

      <div v-if="loading" class="card card-pad">
        <p class="empty">Cargando…</p>
      </div>

      <template v-else>
        <!-- Borrador en curso -->
        <section
          v-if="borrador"
          class="card card-pad border-accent/40 ring-1 ring-accent/20"
          aria-labelledby="borrador-titulo"
        >
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="badge-accent mb-2">En curso</p>
              <h2 id="borrador-titulo" class="section-title">Cuadre de hoy</h2>
              <p class="section-hint">Desmarca lo que no quieran cuadrar todavía: queda para el próximo cuadre.</p>
            </div>
            <button v-if="puedeEditar" type="button" class="btn-ghost btn-sm shrink-0" @click="onDescartar">
              Descartar
            </button>
          </div>

          <div v-if="!borrador.items.length" class="empty">Este cuadre ya no tiene gastos.</div>

          <div v-for="grupo in grupos" :key="grupo.id" class="mb-4 last:mb-0">
            <p class="mb-1 text-[13px] font-medium text-ink-secondary">{{ grupo.titulo }}</p>
            <ul class="list">
              <li v-for="item in grupo.items" :key="item.id" class="list-row !py-3">
                <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    class="checkbox shrink-0"
                    :checked="item.incluido"
                    :disabled="!puedeEditar || marcandoId === item.id"
                    @change="onMarcar(item)"
                  />
                  <span class="min-w-0" :class="{ 'opacity-50': !item.incluido }">
                    <span class="block truncate text-sm font-medium text-ink-primary">{{ item.nombre }}</span>
                    <span class="block truncate text-[13px] text-ink-tertiary">
                      {{ formatDate(item.fecha) }} · Pagó {{ item.pagador?.nombre }}
                    </span>
                  </span>
                </label>
                <span
                  class="shrink-0 whitespace-nowrap text-sm font-semibold"
                  :class="item.incluido ? 'text-ink-primary' : 'text-ink-tertiary line-through'"
                >
                  {{ formatCurrency(item.monto) }}
                </span>
              </li>
            </ul>
          </div>

          <div class="panel-sunken mt-5 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <p class="text-[13px] text-ink-secondary">
                {{ incluidos.length }} de {{ borrador.items.length }} {{ borrador.items.length === 1 ? 'gasto' : 'gastos' }}
                · {{ formatCurrency(totalIncluido) }}
              </p>
              <p class="mt-0.5 text-base font-semibold text-ink-primary text-balance">
                {{ incluidos.length ? textoPreview : 'Marca al menos un gasto' }}
              </p>
            </div>
            <button
              v-if="puedeEditar"
              type="button"
              class="btn-primary shrink-0"
              :disabled="!incluidos.length"
              @click="pidiendoConfirmacion = true"
            >
              <AppIcon name="check" class="h-4 w-4" />
              Confirmar cuadre
            </button>
          </div>
        </section>

        <!-- Sin borrador -->
        <section v-else class="card card-pad text-center">
          <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
            <AppIcon name="scale" class="h-6 w-6" />
          </span>
          <h2 class="section-title mt-4">¿Cuadramos cuentas?</h2>
          <p class="section-hint mx-auto max-w-md">
            Se juntan todas las cuentas marcadas como pagadas y los gastos variables hasta hoy, sin importar la fecha.
            Lo que no se ha pagado no entra.
          </p>
          <p v-if="aviso" class="mx-auto mt-4 max-w-md rounded-xl bg-positive/10 px-3.5 py-2.5 text-sm text-positive">
            {{ aviso }}
          </p>
          <button
            v-if="puedeEditar"
            type="button"
            class="btn-primary mt-5"
            :disabled="iniciando"
            @click="onIniciar"
          >
            <AppIcon name="scale" class="h-4 w-4" />
            {{ iniciando ? 'Preparando…' : 'Cuadrar cuentas' }}
          </button>
        </section>

        <!-- Historial -->
        <section class="card card-pad" aria-labelledby="historial-titulo">
          <h2 id="historial-titulo" class="section-title">Historial</h2>
          <p class="section-hint mb-3">Cuadres confirmados, del más reciente al más antiguo.</p>

          <p v-if="!historial.length" class="empty">Todavía no han cuadrado cuentas.</p>
          <ul v-else class="list">
            <li v-for="cuadre in historial" :key="cuadre.id">
              <button
                type="button"
                class="flex w-full items-center justify-between gap-4 py-3.5 text-left"
                :aria-expanded="expandidoId === cuadre.id"
                @click="expandidoId = expandidoId === cuadre.id ? null : cuadre.id"
              >
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-ink-primary">Cuadre del {{ formatDate(cuadre.fecha) }}</span>
                  <span class="block truncate text-[13px] text-ink-tertiary">{{ textoBalances(cuadre) }}</span>
                </span>
                <span class="flex shrink-0 items-center gap-2">
                  <span class="whitespace-nowrap text-sm font-semibold text-ink-primary">
                    {{ formatCurrency(totalCuadre(cuadre)) }}
                  </span>
                  <AppIcon
                    name="chevronDown"
                    class="h-4 w-4 text-ink-tertiary transition-transform"
                    :class="{ 'rotate-180': expandidoId === cuadre.id }"
                  />
                </span>
              </button>
              <ul v-if="expandidoId === cuadre.id" class="panel-sunken mb-3 divide-y divide-border px-3.5">
                <li v-for="item in cuadre.items" :key="item.id" class="flex items-center justify-between gap-3 py-2.5">
                  <span class="min-w-0">
                    <span class="block truncate text-[13px] font-medium text-ink-primary">{{ item.nombre }}</span>
                    <span class="block truncate text-xs text-ink-tertiary">
                      {{ formatDate(item.fecha) }} · Pagó {{ item.pagador?.nombre }}
                    </span>
                  </span>
                  <span class="shrink-0 whitespace-nowrap text-[13px] font-medium text-ink-primary">
                    {{ formatCurrency(item.monto) }}
                  </span>
                </li>
              </ul>
            </li>
          </ul>
        </section>
      </template>
    </div>

    <AppModal v-if="pidiendoConfirmacion" title="Confirmar cuadre" @close="pidiendoConfirmacion = false">
      <div class="space-y-4">
        <p class="text-sm text-ink-secondary">
          Se {{ incluidos.length === 1 ? 'cuadra 1 gasto' : `cuadran ${incluidos.length} gastos` }} por
          {{ formatCurrency(totalIncluido) }}.
        </p>
        <p class="panel-sunken px-4 py-3 text-base font-semibold text-ink-primary">{{ textoPreview }}</p>
        <div v-if="miNeto !== 0">
          <label class="label" for="cuadre-metodo">
            {{ miNeto > 0 ? 'Dónde recibes tu parte' : 'Con qué pagas tu parte' }} ({{ formatCurrency(Math.abs(miNeto)) }}, solo lo ves tú)
          </label>
          <select id="cuadre-metodo" v-model="metodoLiquidacion" class="field">
            <option value="">Sin definir</option>
            <option v-for="m in misMetodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
        </div>
        <p class="text-[13px] text-ink-tertiary">
          En los movimientos de cada uno queda lo que paga o recibe (un reintegro). Lo que gastó cada uno ya cuenta en
          sus informes en el mes de cada gasto. No se puede deshacer.
        </p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="pidiendoConfirmacion = false">Cancelar</button>
          <button type="button" class="btn-primary" :disabled="confirmando" @click="ejecutarConfirmacion">
            {{ confirmando ? 'Confirmando…' : 'Confirmar cuadre' }}
          </button>
        </div>
      </div>
    </AppModal>
  </AppLayout>
</template>
