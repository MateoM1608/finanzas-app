<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import {
  listarCortesPersonales,
  obtenerCortePersonalAbierto,
  iniciarCortePersonal,
  togglearItemPersonal,
  actualizarItemCortePersonal,
  confirmarCortePersonal,
} from '../../api/cortesPersonales.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import AlertError from '../AlertError.vue';

const corteAbierto = ref(null);
const historial = ref([]);
const loading = ref(true);
const error = ref('');
const motivoSinPendientes = ref('');
const iniciando = ref(false);
const confirmando = ref(false);
const guardandoItemId = ref(null);
const expandidoId = ref(null);
const montosLocales = reactive({});

const emit = defineEmits(['confirmado']);

function onToggleExpandido(corteId) {
  expandidoId.value = expandidoId.value === corteId ? null : corteId;
}

function resumenCorte(corte) {
  return corte.items.filter((i) => i.incluido).reduce((acc, i) => acc + i.monto, 0);
}

function esMontoEditable(item) {
  return item.tipoMonto === 'variable';
}

async function onGuardarMonto(item) {
  const nuevoMonto = Number(montosLocales[item.id]);
  if (!nuevoMonto || nuevoMonto === item.monto) return;
  error.value = '';
  guardandoItemId.value = item.id;
  try {
    corteAbierto.value = await actualizarItemCortePersonal(corteAbierto.value.id, item.id, nuevoMonto);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoItemId.value = null;
  }
}

const faltaMonto = computed(
  () => corteAbierto.value?.items.some((i) => i.incluido && i.monto == null) ?? false,
);
const totalCorte = computed(() => (corteAbierto.value ? resumenCorte(corteAbierto.value) : 0));

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
    const [abierto, cortes] = await Promise.all([obtenerCortePersonalAbierto(), listarCortesPersonales()]);
    corteAbierto.value = abierto;
    historial.value = cortes.filter((c) => c.estado === 'cerrado');
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
    const { corte, motivo } = await iniciarCortePersonal();
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
    corteAbierto.value = await togglearItemPersonal(corteAbierto.value.id, item.id, !item.incluido);
    sincronizarMontosLocales(corteAbierto.value);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoItemId.value = null;
  }
}

async function onConfirmar() {
  if (!confirm('¿Confirmar este corte? Los ítems incluidos se registrarán como gastos personales.')) return;
  error.value = '';
  confirmando.value = true;
  try {
    const cerrado = await confirmarCortePersonal(corteAbierto.value.id);
    corteAbierto.value = null;
    historial.value = [cerrado, ...historial.value];
    emit('confirmado');
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    confirmando.value = false;
  }
}

onMounted(cargar);
</script>

<template>
  <div>
    <AlertError :message="error" />

    <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>

    <template v-else>
      <div v-if="!corteAbierto" class="mb-6">
        <p class="text-sm text-ink-secondary mb-4">
          Junta tus recurrentes personales pendientes hasta el próximo punto de corte y los deja
          listos para revisar antes de registrarlos como gasto.
        </p>
        <button class="btn-primary" :disabled="iniciando" @click="onIniciarCorte">
          {{ iniciando ? 'Buscando pendientes…' : 'Iniciar corte personal' }}
        </button>
        <p v-if="motivoSinPendientes" class="text-sm text-ink-tertiary mt-3">
          {{ motivoSinPendientes }}
        </p>
      </div>

      <div v-else class="mb-6">
        <div class="flex items-center justify-between mb-1">
          <h4 class="text-sm font-semibold text-ink-primary">
            Corte del {{ formatDate(corteAbierto.fechaNominal) }}
          </h4>
          <span class="text-sm font-medium" :class="faltaMonto ? 'text-negative' : 'text-ink-primary'">
            {{ faltaMonto ? 'Falta definir algún monto' : formatCurrency(totalCorte) }}
          </span>
        </div>
        <p class="text-sm text-ink-secondary mb-4">
          Desmarca lo que todavía no se ha pagado en la realidad — queda pendiente y pasa solo al
          próximo corte.
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
                  <span class="text-ink-primary font-medium">{{ item.nombre }}</span>
                  <span v-if="item.categoria" class="block text-xs text-ink-tertiary">{{ item.categoria }}</span>
                </span>
              </label>

              <input
                v-if="esMontoEditable(item)"
                v-model="montosLocales[item.id]"
                type="number"
                class="field w-32 text-right shrink-0"
                placeholder="Monto"
                :disabled="guardandoItemId === item.id"
                @change="onGuardarMonto(item)"
              />
              <span
                v-else
                class="font-medium shrink-0"
                :class="item.monto == null ? 'text-negative' : 'text-ink-primary'"
              >
                {{ item.monto == null ? 'Falta el monto' : formatCurrency(item.monto) }}
              </span>
            </div>
          </li>
        </ul>

        <div class="mt-5 pt-4 border-t border-border space-y-3">
          <p v-if="faltaMonto" class="text-sm text-negative">
            Falta definir el monto de algún ítem incluido — complétalo arriba o desmárcalo.
          </p>
          <button class="btn-primary" :disabled="confirmando || faltaMonto" @click="onConfirmar">
            {{ confirmando ? 'Confirmando…' : 'Confirmar corte' }}
          </button>
        </div>
      </div>

      <div>
        <h4 class="text-sm font-semibold text-ink-primary mb-4">Historial</h4>

        <p v-if="!historial.length" class="text-sm text-ink-secondary">
          Todavía no hay cortes personales cerrados.
        </p>

        <ul v-else class="divide-y divide-border">
          <li v-for="corte in historial" :key="corte.id" class="py-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-ink-primary font-medium">Corte del {{ formatDate(corte.fechaNominal) }}</p>
                <p class="text-sm text-ink-tertiary">
                  Ejecutado {{ formatDate(corte.fechaEjecucion) }} ·
                  {{ corte.items.filter((i) => i.incluido).length }} ítems liquidados
                </p>
              </div>
              <span class="text-ink-primary font-medium">{{ formatCurrency(resumenCorte(corte)) }}</span>
            </div>

            <button
              class="text-sm text-accent hover:text-accent-hover mt-2"
              @click="onToggleExpandido(corte.id)"
            >
              {{ expandidoId === corte.id ? 'Ocultar detalle' : 'Ver detalle por ítem' }}
            </button>

            <ul
              v-if="expandidoId === corte.id"
              class="mt-3 divide-y divide-border bg-surface-raised rounded-xl px-4"
            >
              <li v-for="item in corte.items" :key="item.id" class="py-3 flex items-center justify-between gap-4">
                <span
                  class="text-sm text-ink-primary"
                  :class="{ 'opacity-50 line-through': !item.incluido }"
                >
                  {{ item.nombre }}
                  <span v-if="!item.incluido" class="text-xs text-ink-tertiary italic ml-1">
                    (pospuesto)
                  </span>
                </span>
                <span class="text-sm text-ink-primary font-medium shrink-0">
                  {{ formatCurrency(item.monto) }}
                </span>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
