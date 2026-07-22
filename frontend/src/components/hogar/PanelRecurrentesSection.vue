<script setup>
import { ref, onMounted } from 'vue';
import { obtenerPeriodoActual } from '../../api/gastosRecurrentes.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, formatDate, formatReparto } from '../../utils/format.js';
import AlertError from '../AlertError.vue';

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
  <div>
    <p v-if="periodo" class="text-sm text-ink-secondary mb-5">
      Período {{ formatDate(periodo.periodoInicio) }} – {{ formatDate(periodo.fechaNominal) }}
    </p>

    <AlertError :message="error" />

    <p v-if="loading" class="text-sm text-ink-secondary">Cargando…</p>
    <p v-else-if="!periodo.instancias.length" class="text-sm text-ink-secondary">
      No hay conceptos recurrentes activos para este período.
    </p>

    <ul v-else class="divide-y divide-border">
      <li v-for="{ concepto, instancia } in periodo.instancias" :key="instancia.id" class="py-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-ink-primary font-medium">{{ concepto.nombre }}</p>
            <p class="text-xs text-ink-tertiary">
              {{ concepto.tipoMonto === 'fijo' ? 'Monto fijo' : 'Monto variable' }}
            </p>
          </div>
          <span class="text-ink-primary font-medium">
            {{ instancia.monto != null ? formatCurrency(instancia.monto) : 'Por definir en el corte' }}
          </span>
        </div>

        <p class="text-sm text-ink-tertiary mt-2">
          {{ instancia.pagador ? `Pagó ${instancia.pagador.nombre}` : 'Sin pagador definido aún' }}
          <template v-if="instancia.repartos.length">
            · Reparto: {{ formatReparto(instancia.repartos) }}
          </template>
        </p>
      </li>
    </ul>

    <p class="text-xs text-ink-tertiary mt-5">
      Estos conceptos se configuran en Settings. El monto de los conceptos variables y el pagador se
      definen al armar el corte.
    </p>
  </div>
</template>
