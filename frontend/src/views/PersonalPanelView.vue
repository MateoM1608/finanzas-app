<script setup>
import { ref, computed, onMounted } from 'vue';
import { listarGastos, crearGasto, eliminarGasto } from '../api/gastosPersonales.js';
import { extractErrorMessage } from '../api/client.js';
import { formatCurrency, formatDate } from '../utils/format.js';
import AppHeader from '../components/AppHeader.vue';
import FormField from '../components/FormField.vue';
import AlertError from '../components/AlertError.vue';
import AppModal from '../components/AppModal.vue';
import CortePersonalSection from '../components/personal/CortePersonalSection.vue';
import RecurrentesPersonalesSection from '../components/personal/RecurrentesPersonalesSection.vue';

const mostrarConfigRecurrentes = ref(false);

const gastos = ref([]);
const loading = ref(true);
const error = ref('');

const monto = ref('');
const fecha = ref(new Date().toISOString().slice(0, 10));
const categoria = ref('');
const descripcion = ref('');
const guardando = ref(false);

const eliminandoId = ref(null);

const totalGastado = computed(() => gastos.value.reduce((sum, g) => sum + g.monto, 0));

async function cargarGastos() {
  loading.value = true;
  try {
    gastos.value = await listarGastos();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onAgregarGasto() {
  error.value = '';
  guardando.value = true;
  try {
    const nuevo = await crearGasto({
      monto: Number(monto.value),
      fecha: fecha.value,
      categoria: categoria.value || undefined,
      descripcion: descripcion.value || undefined,
    });
    gastos.value = [nuevo, ...gastos.value];
    monto.value = '';
    categoria.value = '';
    descripcion.value = '';
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardando.value = false;
  }
}

async function onEliminar(id) {
  eliminandoId.value = id;
  try {
    await eliminarGasto(id);
    gastos.value = gastos.value.filter((g) => g.id !== id);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoId.value = null;
  }
}

onMounted(cargarGastos);
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <section class="card p-8">
        <p class="text-sm text-ink-secondary mb-2">Total en gastos personales</p>
        <p class="text-4xl font-semibold text-ink-primary tracking-tight">
          {{ formatCurrency(totalGastado) }}
        </p>
      </section>

      <section class="card p-6 sm:p-8">
        <h2 class="text-base font-semibold text-ink-primary mb-5">Registrar gasto</h2>
        <AlertError :message="error" />

        <form class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4" @submit.prevent="onAgregarGasto">
          <FormField v-model="monto" type="number" label="Monto (COP)" required placeholder="30000" />
          <FormField v-model="fecha" type="date" label="Fecha" required />
          <FormField v-model="categoria" label="Categoría (opcional)" placeholder="Cine, mercado…" />
          <FormField v-model="descripcion" label="Descripción (opcional)" placeholder="Detalle breve" />

          <div class="sm:col-span-2">
            <button type="submit" class="btn-primary w-full sm:w-auto" :disabled="guardando">
              {{ guardando ? 'Guardando…' : 'Agregar gasto' }}
            </button>
          </div>
        </form>
      </section>

      <section class="card p-6 sm:p-8">
        <h2 class="text-base font-semibold text-ink-primary mb-5">Gastos recientes</h2>

        <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>

        <p v-else-if="!gastos.length" class="text-sm text-ink-secondary">
          Aún no has registrado gastos personales.
        </p>

        <ul v-else class="divide-y divide-border">
          <li
            v-for="gasto in gastos"
            :key="gasto.id"
            class="flex items-center justify-between py-4 group"
          >
            <div>
              <p class="text-ink-primary font-medium">
                {{ gasto.categoria || gasto.descripcion || 'Gasto personal' }}
              </p>
              <p class="text-sm text-ink-tertiary">{{ formatDate(gasto.fecha) }}</p>
            </div>

            <div class="flex items-center gap-4">
              <span class="text-ink-primary font-medium">{{ formatCurrency(gasto.monto) }}</span>
              <button
                class="text-sm text-ink-tertiary hover:text-negative transition-colors opacity-0 group-hover:opacity-100"
                :disabled="eliminandoId === gasto.id"
                @click="onEliminar(gasto.id)"
              >
                Eliminar
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section class="card p-6 sm:p-8">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 class="text-base font-semibold text-ink-primary">Recurrentes personales</h2>
          <button class="btn-secondary" @click="mostrarConfigRecurrentes = true">Configurar</button>
        </div>
        <CortePersonalSection @confirmado="cargarGastos" />
      </section>
    </main>

    <AppModal
      v-if="mostrarConfigRecurrentes"
      title="Recurrentes personales"
      @close="mostrarConfigRecurrentes = false"
    >
      <RecurrentesPersonalesSection />
    </AppModal>
  </div>
</template>
