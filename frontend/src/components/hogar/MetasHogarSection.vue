<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import {
  listarMetasHogar,
  crearMetaHogar,
  actualizarMetaHogar,
  eliminarMetaHogar,
  registrarMovimientoMeta,
  eliminarMovimientoMeta,
} from '../../api/metasHogar.js';
import { listarMetodosPago } from '../../api/metodosPagoPersonales.js';
import { listarMiembros } from '../../api/hogares.js';
import { extractErrorMessage } from '../../api/client.js';
import { confirmar } from '../../composables/useConfirm.js';
import { useAuthStore } from '../../stores/auth.js';
import { formatCurrency, formatDate, hoyISO } from '../../utils/format.js';
import AppIcon from '../AppIcon.vue';
import AlertError from '../AlertError.vue';
import FormField from '../FormField.vue';

/**
 * Metas de ahorro en pareja: cuánto llevan, cuánto puso cada uno y cuánto
 * falta al mes para llegar a la fecha. Cada aporte sale de la caja de quien
 * lo hace (no es gasto); un retiro vuelve a su caja (no es ingreso).
 */
const auth = useAuthStore();
const yo = computed(() => auth.usuario?.id);
const puedeEditar = computed(() => auth.usuario?.esAdmin || auth.usuario?.puedeEditarGastos);

const metas = ref([]);
const metodos = ref([]);
const miembros = ref([]);
const cargando = ref(true);
const error = ref('');

async function cargar() {
  metas.value = await listarMetasHogar();
}

onMounted(async () => {
  try {
    const [, m, mi] = await Promise.all([cargar(), listarMetodosPago(), listarMiembros()]);
    metodos.value = m;
    miembros.value = mi;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    cargando.value = false;
  }
});

const nombreMiembro = (id) => (id === yo.value ? 'Tú' : (miembros.value.find((m) => m.id === id)?.nombre ?? '—'));
const activas = computed(() => metas.value.filter((m) => m.activa));
const inactivas = computed(() => metas.value.filter((m) => !m.activa));

async function ejecutar(fn) {
  error.value = '';
  try {
    await fn();
    await cargar();
    return true;
  } catch (e) {
    error.value = extractErrorMessage(e);
    return false;
  }
}

// --- Crear / editar ---
const formAbierto = ref(null); // 'nueva' | id de la meta
const form = reactive({ nombre: '', montoMeta: '', fechaMeta: '' });
function abrirNueva() {
  formAbierto.value = 'nueva';
  Object.assign(form, { nombre: '', montoMeta: '', fechaMeta: '' });
}
function abrirEdicion(meta) {
  formAbierto.value = meta.id;
  Object.assign(form, { nombre: meta.nombre, montoMeta: meta.montoMeta, fechaMeta: meta.fechaMeta ? String(meta.fechaMeta).slice(0, 10) : '' });
}
async function guardarMeta() {
  const payload = { nombre: form.nombre, montoMeta: Number(form.montoMeta), fechaMeta: form.fechaMeta || null };
  const ok = await ejecutar(() =>
    formAbierto.value === 'nueva' ? crearMetaHogar(payload) : actualizarMetaHogar(formAbierto.value, payload),
  );
  if (ok) formAbierto.value = null;
}
async function alternarActiva(meta) {
  await ejecutar(() => actualizarMetaHogar(meta.id, { activa: !meta.activa }));
}
async function eliminar(meta) {
  if (!(await confirmar(`¿Eliminar la meta "${meta.nombre}"?`))) return;
  await ejecutar(() => eliminarMetaHogar(meta.id));
}

// --- Aportar / retirar ---
const moviendo = ref(null);
const mov = reactive({ tipo: 'aporte', monto: '', fecha: '', metodoPagoId: '', enCaja: true });
function abrirMovimiento(meta, tipo) {
  moviendo.value = meta.id;
  Object.assign(mov, { tipo, monto: '', fecha: hoyISO(), metodoPagoId: '', enCaja: true });
}
async function guardarMovimiento(meta) {
  const ok = await ejecutar(() =>
    registrarMovimientoMeta(meta.id, {
      tipo: mov.tipo,
      monto: Number(mov.monto),
      fecha: mov.fecha,
      metodoPagoId: mov.enCaja ? mov.metodoPagoId || null : null,
      enCaja: mov.enCaja,
    }),
  );
  if (ok) moviendo.value = null;
}
async function quitarMovimiento(meta, m) {
  if (!(await confirmar(`¿Quitar este ${m.tipo} de ${formatCurrency(m.monto)}?`, { textoAceptar: 'Quitar' }))) return;
  await ejecutar(() => eliminarMovimientoMeta(meta.id, m.id));
}

const verMovimientos = ref(null);
</script>

<template>
  <section class="card card-pad">
    <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <h2 class="section-title">Metas en pareja</h2>
        <p class="section-hint">Fondo de emergencia, viajes, cuota inicial… Cada uno aporta con su plata.</p>
      </div>
      <button v-if="puedeEditar && formAbierto !== 'nueva'" type="button" class="btn-secondary btn-sm" @click="abrirNueva">
        <AppIcon name="plus" class="h-4 w-4" /> Nueva meta
      </button>
    </div>

    <AlertError :message="error" class="mb-3" />
    <p v-if="cargando" class="empty">Cargando…</p>

    <form v-if="formAbierto" class="panel-sunken mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3" @submit.prevent="guardarMeta">
      <FormField v-model="form.nombre" label="Nombre" required placeholder="Fondo de emergencia" />
      <FormField v-model="form.montoMeta" type="number" label="Meta (COP)" required />
      <FormField v-model="form.fechaMeta" type="date" label="Para cuándo (opcional)" />
      <div class="flex justify-end gap-2 sm:col-span-3">
        <button type="button" class="btn-ghost btn-sm" @click="formAbierto = null">Cancelar</button>
        <button type="submit" class="btn-primary btn-sm">Guardar</button>
      </div>
    </form>

    <p v-if="!cargando && !metas.length && !formAbierto" class="empty">Aún no tienen metas en pareja.</p>

    <ul class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <li v-for="meta in [...activas, ...inactivas]" :key="meta.id" class="panel-sunken p-4" :class="{ 'opacity-60': !meta.activa }">
        <div class="flex items-start justify-between gap-2">
          <p class="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-semibold text-ink-primary">
            <span class="truncate">{{ meta.nombre }}</span>
            <span v-if="meta.cumplida" class="badge-positive">Cumplida</span>
            <span v-if="!meta.activa" class="badge-neutral">Inactiva</span>
          </p>
          <span class="shrink-0 text-right text-sm">
            <span class="font-semibold text-ink-primary">{{ formatCurrency(meta.ahorrado) }}</span>
            <span class="text-ink-tertiary"> / {{ formatCurrency(meta.montoMeta) }}</span>
          </span>
        </div>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface" role="progressbar" :aria-valuenow="Math.round(meta.progresoPct)" aria-valuemin="0" aria-valuemax="100" :aria-label="`Progreso de ${meta.nombre}`">
          <div class="h-full rounded-full" :class="meta.cumplida ? 'bg-positive' : 'bg-accent'" :style="{ width: meta.progresoPct + '%' }" />
        </div>
        <p class="mt-2 text-xs text-ink-tertiary">
          <template v-for="(p, i) in meta.porMiembro" :key="p.usuarioId">{{ i ? ' · ' : '' }}{{ nombreMiembro(p.usuarioId) }} {{ formatCurrency(p.monto) }}</template>
          <template v-if="!meta.porMiembro.length">Nadie ha aportado todavía.</template>
        </p>
        <p v-if="meta.faltaAlMes" class="mt-1 text-xs font-medium text-ink-secondary">
          Faltan {{ formatCurrency(meta.falta) }}: {{ formatCurrency(meta.faltaAlMes) }} al mes hasta {{ formatDate(meta.fechaMeta) }}
        </p>
        <p v-else-if="meta.fechaMeta && !meta.cumplida" class="mt-1 text-xs text-ink-tertiary">Para {{ formatDate(meta.fechaMeta) }}</p>

        <form v-if="moviendo === meta.id" class="mt-3 grid grid-cols-2 gap-2" @submit.prevent="guardarMovimiento(meta)">
          <FormField v-model="mov.monto" type="number" :label="mov.tipo === 'aporte' ? 'Aportas (COP)' : 'Retiras (COP)'" required />
          <FormField v-model="mov.fecha" type="date" label="Fecha" required />
          <label class="col-span-2 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
            <input v-model="mov.enCaja" type="checkbox" class="h-4 w-4 rounded accent-accent" />
            {{ mov.tipo === 'aporte' ? 'Sale de una de mis cuentas (baja mi Disponible)' : 'Llega a una de mis cuentas (sube mi Disponible)' }}
          </label>
          <div v-if="mov.enCaja" class="col-span-2">
            <label class="label" :for="`meta-cuenta-${meta.id}`">{{ mov.tipo === 'aporte' ? 'Sale de' : 'Llega a' }}</label>
            <select :id="`meta-cuenta-${meta.id}`" v-model="mov.metodoPagoId" class="field">
              <option value="">Sin definir</option>
              <option v-for="m in metodos.filter((x) => x.tipo !== 'tarjeta_credito')" :key="m.id" :value="m.id">{{ m.nombre }}</option>
            </select>
          </div>
          <p class="col-span-2 text-xs text-ink-tertiary">
            <template v-if="!mov.enCaja">{{ mov.tipo === 'aporte' ? 'Suma a la meta sin tocar tu Disponible: la plata vino de otra fuente o ya estaba ahorrada.' : 'Baja la meta sin tocar tu Disponible: la plata no llegó a una de tus cuentas.' }}</template>
            <template v-else>{{ mov.tipo === 'aporte' ? 'Baja tu Disponible pero no cuenta como gasto.' : 'Sube tu Disponible pero no cuenta como ingreso.' }}</template>
          </p>
          <div class="col-span-2 flex justify-end gap-2">
            <button type="button" class="btn-ghost btn-sm" @click="moviendo = null">Cancelar</button>
            <button type="submit" class="btn-primary btn-sm">Guardar</button>
          </div>
        </form>

        <div v-else class="mt-3 flex flex-wrap items-center gap-1.5">
          <button v-if="meta.activa" type="button" class="btn-secondary btn-sm" @click="abrirMovimiento(meta, 'aporte')">Aportar</button>
          <button v-if="meta.activa && meta.ahorrado > 0" type="button" class="btn-ghost btn-sm" @click="abrirMovimiento(meta, 'retiro')">Retirar</button>
          <button v-if="meta.movimientos.length" type="button" class="btn-ghost btn-sm" @click="verMovimientos = verMovimientos === meta.id ? null : meta.id">
            {{ verMovimientos === meta.id ? 'Ocultar movimientos' : 'Movimientos' }}
          </button>
          <template v-if="puedeEditar">
            <button type="button" class="btn-ghost btn-sm" @click="abrirEdicion(meta)">Editar</button>
            <button v-if="meta.movimientos.length" type="button" class="btn-ghost btn-sm" @click="alternarActiva(meta)">{{ meta.activa ? 'Desactivar' : 'Activar' }}</button>
            <button v-else type="button" class="btn-ghost btn-sm text-negative" @click="eliminar(meta)">Eliminar</button>
          </template>
        </div>

        <ul v-if="verMovimientos === meta.id" class="list mt-2">
          <li v-for="m in [...meta.movimientos].reverse()" :key="m.id" class="list-row !py-2 text-[13px]">
            <span class="text-ink-secondary">{{ formatDate(m.fecha) }} · {{ nombreMiembro(m.usuarioId) }} · {{ m.tipo === 'aporte' ? 'aporte' : 'retiro' }}<template v-if="m.enCaja === false"> · no tocó el Disponible</template></span>
            <span class="flex items-center gap-1.5">
              <span class="font-semibold" :class="m.tipo === 'aporte' ? 'text-ink-primary' : 'text-warning'">{{ m.tipo === 'aporte' ? '' : '−' }}{{ formatCurrency(m.monto) }}</span>
              <button v-if="m.usuarioId === yo" type="button" class="btn-icon !p-1" aria-label="Quitar movimiento" @click="quitarMovimiento(meta, m)">
                <AppIcon name="x" class="h-3.5 w-3.5" />
              </button>
            </span>
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>
