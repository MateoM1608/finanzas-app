<script setup>
import { confirmar } from '../../composables/useConfirm.js';
import { ref, onMounted } from 'vue';
import { listarMiembros } from '../../api/hogares.js';
import {
  listarConceptos,
  crearConcepto,
  actualizarConcepto,
  eliminarConcepto,
} from '../../api/conceptosRecurrentes.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, describirCalendario } from '../../utils/format.js';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';
import AppModal from '../AppModal.vue';
import CuentaFijaForm from './CuentaFijaForm.vue';

defineProps({
  canEdit: { type: Boolean, default: false },
});

const conceptos = ref([]);
const miembros = ref([]);
const loading = ref(true);
const error = ref('');
const guardandoId = ref(null);
const creando = ref(false);
const mostrarNueva = ref(false);
const editando = ref(null);
const eliminandoId = ref(null);

async function cargar() {
  loading.value = true;
  try {
    const [listaConceptos, listaMiembros] = await Promise.all([listarConceptos(), listarMiembros()]);
    conceptos.value = listaConceptos;
    miembros.value = listaMiembros;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

function reemplazar(actualizado) {
  const idx = conceptos.value.findIndex((c) => c.id === actualizado.id);
  conceptos.value[idx] = actualizado;
}

async function onCrear(payload) {
  error.value = '';
  creando.value = true;
  try {
    conceptos.value = [...conceptos.value, await crearConcepto(payload)];
    mostrarNueva.value = false;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    creando.value = false;
  }
}

async function onGuardarEdicion(payload) {
  error.value = '';
  guardandoId.value = editando.value.id;
  try {
    reemplazar(await actualizarConcepto(editando.value.id, payload));
    editando.value = null;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

async function onToggleActivo(concepto) {
  error.value = '';
  guardandoId.value = concepto.id;
  try {
    reemplazar(await actualizarConcepto(concepto.id, { activo: !concepto.activo }));
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

async function onEliminar(concepto) {
  const ok = await confirmar(`¿Eliminar "${concepto.nombre}"? Esta acción no se puede deshacer.`, {
    textoAceptar: 'Eliminar',
    peligroso: true,
  });
  if (!ok) return;
  error.value = '';
  eliminandoId.value = concepto.id;
  try {
    await eliminarConcepto(concepto.id);
    conceptos.value = conceptos.value.filter((c) => c.id !== concepto.id);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoId.value = null;
  }
}

onMounted(cargar);
</script>

<template>
  <div class="space-y-6">
    <AlertError :message="error" />

    <section class="card card-pad">
      <header class="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="section-title">Cuentas fijas del hogar</h3>
          <p class="section-hint">
            Arriendo, servicios, internet… Cada una con su día de pago y su responsable. Solo cuentan para el
            saldo cuando alguien las marca como pagadas.
          </p>
        </div>
        <button v-if="canEdit" type="button" class="btn-primary shrink-0" @click="mostrarNueva = true">
          <AppIcon name="plus" class="h-4 w-4" />
          Nueva cuenta
        </button>
      </header>

      <p v-if="loading" class="empty">Cargando…</p>
      <div v-else-if="!conceptos.length" class="empty flex flex-col items-center gap-2">
        <AppIcon name="repeat" class="h-6 w-6" />
        Aún no hay cuentas fijas configuradas.
      </div>

      <ul v-else class="list">
        <li v-for="concepto in conceptos" :key="concepto.id" class="flex items-start gap-3 py-4">
          <span
            class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-secondary"
            :class="{ 'opacity-50': !concepto.activo }"
            aria-hidden="true"
          >
            <AppIcon name="repeat" class="h-4 w-4" />
          </span>

          <div class="min-w-0 flex-1" :class="{ 'opacity-60': !concepto.activo }">
            <p class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span class="truncate text-sm font-medium text-ink-primary">{{ concepto.nombre }}</span>
              <span :class="concepto.tipoMonto === 'fijo' ? 'badge-accent' : 'badge-neutral'">
                {{ concepto.tipoMonto === 'fijo' ? formatCurrency(concepto.montoDefault) : 'Monto variable' }}
              </span>
              <span v-if="!concepto.activo" class="badge-warning">Inactiva</span>
            </p>
            <p class="mt-0.5 text-[13px] text-ink-secondary">
              {{ describirCalendario(concepto) }}
              · {{ concepto.responsable ? `La paga ${concepto.responsable.nombre}` : 'La paga cualquiera' }}
            </p>
          </div>

          <div v-if="canEdit" class="flex shrink-0 items-center gap-1">
            <label
              class="mr-1 inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-secondary hover:text-ink-primary"
            >
              <input
                type="checkbox"
                class="checkbox"
                :checked="concepto.activo"
                :disabled="guardandoId === concepto.id"
                @change="onToggleActivo(concepto)"
              />
              <span class="sr-only sm:not-sr-only">Activa</span>
            </label>
            <button
              type="button"
              class="btn-icon"
              :aria-label="`Editar ${concepto.nombre}`"
              :title="`Editar ${concepto.nombre}`"
              @click="editando = concepto"
            >
              <AppIcon name="edit" class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="btn-icon hover:!text-negative hover:!bg-negative/10"
              :aria-label="`Eliminar ${concepto.nombre}`"
              :title="`Eliminar ${concepto.nombre}`"
              :disabled="eliminandoId === concepto.id"
              @click="onEliminar(concepto)"
            >
              <AppIcon name="trash" class="h-4 w-4" />
            </button>
          </div>
        </li>
      </ul>
    </section>

    <AppModal v-if="mostrarNueva" title="Nueva cuenta fija" size="lg" @close="mostrarNueva = false">
      <CuentaFijaForm
        id-base="cuenta-nueva"
        :miembros="miembros"
        :guardando="creando"
        texto-guardar="Agregar cuenta"
        @guardar="onCrear"
      />
    </AppModal>

    <AppModal v-if="editando" :title="`Editar ${editando.nombre}`" size="lg" @close="editando = null">
      <CuentaFijaForm
        :id-base="`cuenta-${editando.id}`"
        :inicial="editando"
        :miembros="miembros"
        :guardando="guardandoId === editando.id"
        texto-guardar="Guardar cambios"
        @guardar="onGuardarEdicion"
        @cancelar="editando = null"
      />
      <p class="mt-4 text-[13px] text-ink-tertiary">
        Si cambias el día o la frecuencia, las cuotas que nadie ha pagado se reacomodan a las fechas nuevas. Las ya
        pagadas no cambian.
      </p>
    </AppModal>
  </div>
</template>
