<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { listarNotificaciones, marcarNotificacion, marcarTodasLeidas } from '../api/avisos.js';
import { extractErrorMessage } from '../api/client.js';
import AppLayout from '../components/AppLayout.vue';
import AppIcon from '../components/AppIcon.vue';
import AlertError from '../components/AlertError.vue';

/**
 * Bandeja de notificaciones: lo que vence, lo que vence hoy y lo atrasado
 * (y más adelante la actividad del hogar). Tocar una la marca leída y lleva a
 * donde se paga. Las mismas notificaciones llegarán al teléfono con la APK.
 */
const router = useRouter();
const notificaciones = ref([]);
const noLeidas = ref(0);
const cargando = ref(true);
const error = ref('');

async function cargar() {
  try {
    const r = await listarNotificaciones();
    notificaciones.value = r.notificaciones;
    noLeidas.value = r.noLeidas;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    cargando.value = false;
  }
}
onMounted(cargar);

const ICONO = { atrasado: 'alert', vence_hoy: 'bell', vence_pronto: 'clock' };
const COLOR = { atrasado: 'bg-negative/10 text-negative', vence_hoy: 'bg-warning/10 text-warning', vence_pronto: 'bg-accent/10 text-accent' };

function hace(fecha) {
  const min = Math.round((Date.now() - new Date(fecha)) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

const hayNoLeidas = computed(() => notificaciones.value.some((n) => !n.leida));

async function abrir(n) {
  if (!n.leida) {
    try {
      await marcarNotificacion(n.id, true);
    } catch {
      // Igual se abre.
    }
  }
  if (n.enlace) router.push(n.enlace);
  else cargar();
}

async function leerTodas() {
  error.value = '';
  try {
    await marcarTodasLeidas();
    await cargar();
  } catch (e) {
    error.value = extractErrorMessage(e);
  }
}
</script>

<template>
  <AppLayout title="Notificaciones" subtitle="Lo que vence y lo que quedó sin pagar.">
    <template #actions>
      <button v-if="hayNoLeidas" type="button" class="btn-secondary btn-sm" @click="leerTodas">
        <AppIcon name="check" class="h-4 w-4" /> Marcar todas como leídas
      </button>
    </template>

    <AlertError :message="error" class="mb-4" />
    <div v-if="cargando" class="card card-pad"><p class="empty">Cargando…</p></div>
    <div v-else-if="!notificaciones.length" class="card card-pad empty flex flex-col items-center gap-2">
      <AppIcon name="bell" class="h-6 w-6" />
      No tienes notificaciones. Aquí te avisaremos lo que vence y lo que quede sin pagar.
    </div>
    <ul v-else class="card divide-y divide-border overflow-hidden">
      <li v-for="n in notificaciones" :key="n.id">
        <button type="button" class="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-hover sm:px-6" @click="abrir(n)">
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg" :class="COLOR[n.tipo] ?? 'bg-surface-sunken text-ink-secondary'">
            <AppIcon :name="ICONO[n.tipo] ?? 'bell'" class="h-4 w-4" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2">
              <span class="truncate text-sm" :class="n.leida ? 'text-ink-secondary' : 'font-semibold text-ink-primary'">{{ n.titulo }}</span>
              <span v-if="!n.leida" class="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Sin leer" />
            </span>
            <span class="block text-[13px] text-ink-tertiary">{{ n.mensaje }}</span>
          </span>
          <span class="shrink-0 text-xs text-ink-tertiary">{{ hace(n.creadaEn) }}</span>
        </button>
      </li>
    </ul>
  </AppLayout>
</template>
