<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth.js';
import {
  listarMiembros,
  actualizarPermisosMiembro,
  transferirAdmin,
  generarInvitacion,
} from '../../api/hogares.js';
import { extractErrorMessage } from '../../api/client.js';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';

const auth = useAuthStore();

const miembros = ref([]);
const loading = ref(true);
const error = ref('');
const guardandoId = ref(null);

const codigoInvitacion = ref('');
const generandoInvitacion = ref(false);

const nuevoAdminId = ref('');
const transfiriendo = ref(false);

async function cargar() {
  loading.value = true;
  try {
    miembros.value = await listarMiembros();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onTogglePermiso(miembro, campo) {
  error.value = '';
  guardandoId.value = miembro.id;
  try {
    const actualizado = await actualizarPermisosMiembro(miembro.id, {
      [campo]: !miembro[campo],
    });
    const idx = miembros.value.findIndex((m) => m.id === miembro.id);
    miembros.value[idx] = actualizado;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoId.value = null;
  }
}

async function onGenerarInvitacion() {
  error.value = '';
  generandoInvitacion.value = true;
  try {
    const { invitacion } = await generarInvitacion();
    codigoInvitacion.value = invitacion.codigo;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    generandoInvitacion.value = false;
  }
}

async function onTransferirAdmin() {
  if (!nuevoAdminId.value) return;
  error.value = '';
  transfiriendo.value = true;
  try {
    miembros.value = await transferirAdmin(nuevoAdminId.value);
    auth.setUsuario({ ...auth.usuario, esAdmin: false });
    nuevoAdminId.value = '';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    transfiriendo.value = false;
  }
}

onMounted(cargar);

// Iniciales para el avatar (solo presentación).
function iniciales(nombre = '') {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}
</script>

<template>
  <div class="space-y-6">
    <AlertError :message="error" />

    <section class="card card-pad">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <header class="flex items-start gap-3">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
            <AppIcon name="plus" class="h-[18px] w-[18px]" />
          </span>
          <div>
            <h3 class="section-title">Invitar a alguien</h3>
            <p class="section-hint">Genera un código de un solo uso, válido por 7 días.</p>
          </div>
        </header>
        <button type="button" class="btn-secondary shrink-0" :disabled="generandoInvitacion" @click="onGenerarInvitacion">
          {{ generandoInvitacion ? 'Generando…' : 'Generar código' }}
        </button>
      </div>

      <div
        v-if="codigoInvitacion"
        class="panel-sunken mt-5 flex flex-col gap-1 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <span class="text-[13px] text-ink-secondary">Comparte este código</span>
        <span class="break-all font-mono text-2xl font-semibold tracking-[0.2em] text-accent">
          {{ codigoInvitacion }}
        </span>
      </div>
    </section>

    <section class="card card-pad">
      <header class="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 class="section-title">Miembros del hogar</h3>
          <p class="section-hint">
            {{ auth.usuario?.esAdmin ? 'Define qué puede hacer cada miembro.' : 'Personas que comparten este hogar.' }}
          </p>
        </div>
        <span v-if="!loading" class="badge-neutral shrink-0">{{ miembros.length }}</span>
      </header>

      <p v-if="loading" class="empty">Cargando…</p>

      <ul v-else class="list">
        <li v-for="miembro in miembros" :key="miembro.id" class="py-4">
          <div class="flex items-center gap-3">
            <span
              class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-sunken text-xs font-semibold text-ink-secondary"
              aria-hidden="true"
            >
              {{ iniciales(miembro.nombre) }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink-primary">
                <span class="truncate">{{ miembro.nombre }}</span>
                <span v-if="miembro.esAdmin" class="badge-accent">Admin</span>
              </p>
              <p class="truncate text-[13px] text-ink-tertiary">@{{ miembro.usuario }}</p>
            </div>
            <div v-if="!auth.usuario?.esAdmin" class="hidden flex-wrap justify-end gap-1.5 sm:flex">
              <span v-if="miembro.puedeEditarGastos" class="badge-positive">Edita gastos</span>
              <span v-if="miembro.puedeInvitar" class="badge-neutral">Invita</span>
            </div>
          </div>

          <div v-if="!auth.usuario?.esAdmin && (miembro.puedeEditarGastos || miembro.puedeInvitar)" class="ml-12 mt-2 flex flex-wrap gap-1.5 sm:hidden">
            <span v-if="miembro.puedeEditarGastos" class="badge-positive">Edita gastos</span>
            <span v-if="miembro.puedeInvitar" class="badge-neutral">Invita</span>
          </div>

          <div v-if="auth.usuario?.esAdmin" class="ml-12 mt-3 flex flex-wrap gap-x-5 gap-y-2">
            <label class="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-secondary hover:text-ink-primary">
              <input
                type="checkbox"
                class="checkbox"
                :checked="miembro.puedeEditarGastos"
                :disabled="guardandoId === miembro.id"
                @change="onTogglePermiso(miembro, 'puedeEditarGastos')"
              />
              Puede editar gastos
            </label>
            <label class="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-secondary hover:text-ink-primary">
              <input
                type="checkbox"
                class="checkbox"
                :checked="miembro.puedeInvitar"
                :disabled="guardandoId === miembro.id"
                @change="onTogglePermiso(miembro, 'puedeInvitar')"
              />
              Puede invitar
            </label>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="auth.usuario?.esAdmin" class="card card-pad">
      <header class="mb-5">
        <h3 class="section-title">Transferir rol de administrador</h3>
        <p class="section-hint">Solo puede haber un administrador activo a la vez. Perderás tus permisos de admin.</p>
      </header>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div class="flex-1">
          <label class="label" for="miembros-nuevo-admin">Nuevo administrador</label>
          <select id="miembros-nuevo-admin" v-model="nuevoAdminId" class="field">
            <option value="" disabled>Selecciona un miembro</option>
            <option
              v-for="miembro in miembros.filter((m) => !m.esAdmin)"
              :key="miembro.id"
              :value="miembro.id"
            >
              {{ miembro.nombre }}
            </option>
          </select>
        </div>
        <button
          type="button"
          class="btn-secondary whitespace-nowrap"
          :disabled="!nuevoAdminId || transfiriendo"
          @click="onTransferirAdmin"
        >
          {{ transfiriendo ? 'Transfiriendo…' : 'Transferir admin' }}
        </button>
      </div>
    </section>
  </div>
</template>
