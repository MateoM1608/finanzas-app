<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth.js';
import { api, extractErrorMessage } from '../../api/client.js';
import { obtenerHogarActual } from '../../api/hogares.js';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';
import FormField from '../FormField.vue';
import ThemeToggle from '../ThemeToggle.vue';

/**
 * Cuenta → Perfil: tu nombre (lo ven los demás miembros del hogar), tu usuario,
 * el hogar al que perteneces y la apariencia de la app.
 */
const auth = useAuthStore();

const nombre = ref(auth.usuario?.nombre ?? '');
const guardando = ref(false);
const error = ref('');
const ok = ref('');
const hogar = ref(null);

const cambio = computed(() => nombre.value.trim() && nombre.value.trim() !== auth.usuario?.nombre);

onMounted(async () => {
  try {
    hogar.value = (await obtenerHogarActual()).hogar;
  } catch {
    // Informativo: si falla, no se muestra.
  }
});

async function guardar() {
  error.value = '';
  ok.value = '';
  guardando.value = true;
  try {
    const { data } = await api.put('/api/auth/perfil', { nombre: nombre.value.trim() });
    auth.setUsuario(data.usuario);
    nombre.value = data.usuario.nombre;
    ok.value = 'Listo: guardamos tu nombre.';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <section class="card card-pad">
      <h3 class="section-title">Tus datos</h3>
      <p class="section-hint mb-4">Tu nombre es el que ven los demás miembros del hogar en gastos, cuadres y actividad.</p>
      <AlertError :message="error" class="mb-3" />
      <p v-if="ok" role="status" class="mb-3 rounded-lg bg-positive/10 px-3 py-2 text-[13px] font-medium text-positive">{{ ok }}</p>
      <form class="space-y-4" @submit.prevent="guardar">
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField v-model="nombre" label="Nombre" autocomplete="name" required />
          <FormField :model-value="auth.usuario?.usuario" label="Usuario" hint="Con este entras a la app; no se puede cambiar." disabled />
        </div>
        <button type="submit" class="btn-primary" :disabled="guardando || !cambio">
          {{ guardando ? 'Guardando…' : 'Guardar nombre' }}
        </button>
      </form>
    </section>

    <section v-if="hogar" class="card card-pad">
      <h3 class="section-title">Tu hogar</h3>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p class="flex items-center gap-2.5 text-sm text-ink-primary">
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-sunken text-ink-secondary">
            <AppIcon name="home" class="h-4 w-4" />
          </span>
          <span>
            {{ hogar.nombre }}
            <span v-if="auth.usuario?.esAdmin" class="badge-accent ml-1">Administrador</span>
          </span>
        </p>
        <router-link :to="{ name: 'configuracion-hogar' }" class="btn-secondary btn-sm">
          <AppIcon name="sliders" class="h-3.5 w-3.5" />
          Configuración del hogar
        </router-link>
      </div>
    </section>

    <section class="card card-pad">
      <h3 class="section-title">Apariencia</h3>
      <p class="section-hint mb-3">Se guarda en este dispositivo.</p>
      <div class="max-w-xs rounded-xl border border-border">
        <ThemeToggle variant="full" />
      </div>
    </section>
  </div>
</template>
