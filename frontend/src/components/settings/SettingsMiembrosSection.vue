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
</script>

<template>
  <div class="space-y-6">
    <AlertError :message="error" />

    <div class="card p-6 sm:p-8">
      <h3 class="text-base font-semibold text-ink-primary mb-1">Invitar a alguien</h3>
      <p class="text-sm text-ink-secondary mb-4">
        Genera un código de un solo uso, válido por 7 días.
      </p>
      <button class="btn-secondary" :disabled="generandoInvitacion" @click="onGenerarInvitacion">
        {{ generandoInvitacion ? 'Generando…' : 'Generar código de invitación' }}
      </button>
      <p v-if="codigoInvitacion" class="mt-4 text-2xl font-semibold tracking-widest text-accent">
        {{ codigoInvitacion }}
      </p>
    </div>

    <div class="card p-6 sm:p-8">
      <h3 class="text-base font-semibold text-ink-primary mb-5">Miembros del hogar</h3>

      <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>

      <ul v-else class="divide-y divide-border">
        <li v-for="miembro in miembros" :key="miembro.id" class="py-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-ink-primary font-medium">
                {{ miembro.nombre }}
                <span v-if="miembro.esAdmin" class="ml-1.5 text-xs text-accent font-semibold uppercase">
                  Admin
                </span>
              </p>
              <p class="text-sm text-ink-tertiary">@{{ miembro.usuario }}</p>
            </div>
          </div>

          <div v-if="auth.usuario?.esAdmin" class="flex flex-wrap gap-4 mt-3">
            <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                :checked="miembro.puedeEditarGastos"
                :disabled="guardandoId === miembro.id"
                @change="onTogglePermiso(miembro, 'puedeEditarGastos')"
              />
              Puede editar gastos
            </label>
            <label class="inline-flex items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                :checked="miembro.puedeInvitar"
                :disabled="guardandoId === miembro.id"
                @change="onTogglePermiso(miembro, 'puedeInvitar')"
              />
              Puede invitar
            </label>
          </div>
        </li>
      </ul>
    </div>

    <div v-if="auth.usuario?.esAdmin" class="card p-6 sm:p-8">
      <h3 class="text-base font-semibold text-ink-primary mb-1">Transferir rol de administrador</h3>
      <p class="text-sm text-ink-secondary mb-4">
        Solo puede haber un administrador activo a la vez.
      </p>
      <div class="flex flex-col sm:flex-row gap-3">
        <select v-model="nuevoAdminId" class="field">
          <option value="" disabled>Selecciona un miembro</option>
          <option
            v-for="miembro in miembros.filter((m) => !m.esAdmin)"
            :key="miembro.id"
            :value="miembro.id"
          >
            {{ miembro.nombre }}
          </option>
        </select>
        <button
          class="btn-secondary whitespace-nowrap"
          :disabled="!nuevoAdminId || transfiriendo"
          @click="onTransferirAdmin"
        >
          {{ transfiriendo ? 'Transfiriendo…' : 'Transferir admin' }}
        </button>
      </div>
    </div>
  </div>
</template>
