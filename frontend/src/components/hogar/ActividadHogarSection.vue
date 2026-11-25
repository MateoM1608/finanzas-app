<script setup>
import { ref, computed, onMounted } from 'vue';
import { listarActividadHogar } from '../../api/hogares.js';
import { formatCurrency } from '../../utils/format.js';

/**
 * Actividad del hogar: quién registró, pagó, editó o eliminó qué, lo más
 * reciente primero. Los demás miembros reciben una notificación de lo nuevo.
 */
const actividad = ref([]);
const verTodo = ref(false);
const cargando = ref(true);

async function cargar() {
  try {
    actividad.value = await listarActividadHogar(40);
  } catch {
    // Informativo.
  } finally {
    cargando.value = false;
  }
}
onMounted(cargar);
defineExpose({ recargar: cargar });

const visibles = computed(() => (verTodo.value ? actividad.value : actividad.value.slice(0, 8)));

// Siempre el nombre (con "Tú" no concuerda el verbo: "Tú creó…").
function quien(a) {
  return a.usuario.nombre.split(' ')[0];
}

function hace(fecha) {
  const min = Math.round((Date.now() - new Date(fecha)) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}
</script>

<template>
  <section class="card card-pad">
    <h2 class="section-title">Actividad del hogar</h2>
    <p class="section-hint mb-3">Lo último que registraron, pagaron o cambiaron.</p>
    <p v-if="cargando" class="empty">Cargando…</p>
    <p v-else-if="!actividad.length" class="empty">Todavía no hay actividad. Aquí verán quién registra y paga cada cosa.</p>
    <ul v-else class="list">
      <li v-for="a in visibles" :key="a.id" class="list-row !py-2.5">
        <div class="min-w-0">
          <p class="text-sm text-ink-primary">
            <span class="font-semibold">{{ quien(a) }}</span> {{ a.descripcion }}
          </p>
          <p class="text-xs text-ink-tertiary">{{ hace(a.creadoEn) }}</p>
        </div>
        <span v-if="a.monto != null" class="shrink-0 text-sm font-medium text-ink-secondary">{{ formatCurrency(a.monto) }}</span>
      </li>
    </ul>
    <button v-if="actividad.length > 8" type="button" class="btn-ghost btn-sm mt-2" @click="verTodo = !verTodo">
      {{ verTodo ? 'Ver menos' : `Ver más (${actividad.length})` }}
    </button>
  </section>
</template>
