<script setup>
import { ref, onMounted } from 'vue';
import { obtenerPeriodoActual } from '../../api/gastosRecurrentes.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, formatDate, formatReparto } from '../../utils/format.js';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';

const periodo = ref(null);
const loading = ref(true);
const error = ref('');

async function cargar() {
  loading.value = true;
  try {
    periodo.value = await obtenerPeriodoActual();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

onMounted(cargar);
</script>

<template>
  <div class="space-y-4">
    <div v-if="periodo" class="flex items-center gap-2 text-[13px] text-ink-secondary">
      <AppIcon name="calendar" class="h-4 w-4 text-ink-tertiary" />
      Período {{ formatDate(periodo.periodoInicio) }} – {{ formatDate(periodo.fechaNominal) }}
    </div>

    <AlertError :message="error" />

    <p v-if="loading" class="text-sm text-ink-tertiary">Cargando…</p>
    <div v-else-if="!periodo?.instancias.length" class="empty flex flex-col items-center gap-2">
      <AppIcon name="repeat" class="h-6 w-6" />
      No hay conceptos recurrentes activos para este período.
    </div>

    <ul v-else class="list">
      <li v-for="{ concepto, instancia } in periodo.instancias" :key="instancia.id" class="py-3.5">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-primary">
              {{ concepto.nombre }}
              <span :class="concepto.tipoMonto === 'fijo' ? 'badge-neutral' : 'badge-accent'">
                {{ concepto.tipoMonto === 'fijo' ? 'Monto fijo' : 'Monto variable' }}
              </span>
            </p>
            <p class="text-[13px] text-ink-tertiary mt-1">
              {{ instancia.pagador ? `Pagó ${instancia.pagador.nombre}` : 'Sin pagador definido aún' }}
              <template v-if="instancia.repartos.length">
                · Reparto: {{ formatReparto(instancia.repartos) }}
              </template>
            </p>
          </div>
          <span
            v-if="instancia.monto != null"
            class="shrink-0 text-right text-sm font-medium text-ink-primary"
          >
            {{ formatCurrency(instancia.monto) }}
          </span>
          <span v-else class="badge-warning shrink-0">Por definir en el corte</span>
        </div>
      </li>
    </ul>

    <p class="panel-sunken flex items-start gap-2 px-3.5 py-3 text-[13px] text-ink-secondary">
      <AppIcon name="info" class="h-4 w-4 mt-0.5 shrink-0 text-ink-tertiary" />
      <span>
        Estos conceptos se configuran en Configuración. El monto de los conceptos variables y el pagador se
        definen al armar el corte.
      </span>
    </p>
  </div>
</template>
