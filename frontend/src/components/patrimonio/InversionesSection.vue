<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import {
  listarInversiones,
  crearInversion,
  actualizarInversion,
  eliminarInversion,
  registrarMovimientoInversion,
  eliminarMovimientoInversion,
  registrarValoracion,
} from '../../api/inversiones.js';
import { listarMetodosPago } from '../../api/metodosPagoPersonales.js';
import { listarMiembros } from '../../api/hogares.js';
import { extractErrorMessage } from '../../api/client.js';
import { confirmar } from '../../composables/useConfirm.js';
import { useAuthStore } from '../../stores/auth.js';
import { formatCurrency, formatDate, hoyISO } from '../../utils/format.js';
import AppIcon from '../AppIcon.vue';
import AppModal from '../AppModal.vue';
import AlertError from '../AlertError.vue';
import FormField from '../FormField.vue';

/**
 * Inversiones personales y del hogar: valor actual (lo actualizas a mano),
 * ganancia y rentabilidad, aportes y retiros (salen o vuelven a tu caja sin
 * ser gasto ni ingreso), y en el hogar la parte de cada uno según lo que ha puesto.
 */
const emit = defineEmits(['cambio']);
const auth = useAuthStore();
const yo = computed(() => auth.usuario?.id);
const puedeEditarHogar = computed(() => auth.usuario?.esAdmin || auth.usuario?.puedeEditarGastos);

const TIPOS = [
  { valor: 'cdt', label: 'CDT' },
  { valor: 'fondo', label: 'Fondo' },
  { valor: 'acciones', label: 'Acciones' },
  { valor: 'cripto', label: 'Cripto' },
  { valor: 'finca_raiz', label: 'Finca raíz' },
  { valor: 'otro', label: 'Otro' },
];
const nombreTipo = (t) => TIPOS.find((x) => x.valor === t)?.label ?? t;
const ORIGEN_VALOR = { valoracion: 'según tu última actualización', estimado: 'estimado con la tasa', aportes: 'lo que has puesto' };

const datos = ref(null);
const metodos = ref([]);
const miembros = ref([]);
const error = ref('');
const pestana = ref('personales');

async function cargar() {
  datos.value = await listarInversiones();
}
onMounted(async () => {
  try {
    const [, m, mi] = await Promise.all([cargar(), listarMetodosPago(), listarMiembros()]);
    metodos.value = m;
    miembros.value = mi;
  } catch (e) {
    error.value = extractErrorMessage(e);
  }
});

const cuentas = computed(() => metodos.value.filter((m) => m.tipo !== 'tarjeta_credito'));
const nombreMiembro = (id) => (id === yo.value ? 'Tú' : (miembros.value.find((m) => m.id === id)?.nombre ?? '—'));
const lista = computed(() => (pestana.value === 'hogar' ? datos.value?.hogar : datos.value?.personales) ?? []);
const ordenada = computed(() => [...lista.value.filter((i) => i.activa), ...lista.value.filter((i) => !i.activa)]);
const editable = (i) => i.ambito === 'personal' || puedeEditarHogar.value;
const signo = (n) => (n > 0 ? '+' : '');

async function ejecutar(fn) {
  error.value = '';
  try {
    await fn();
    await cargar();
    emit('cambio');
    return true;
  } catch (e) {
    error.value = extractErrorMessage(e);
    return false;
  }
}

// --- Crear ---
const creando = ref(false);
const nueva = reactive({});
function abrirNueva() {
  Object.assign(nueva, { nombre: '', tipo: 'cdt', entidad: '', fechaInicio: hoyISO(), tasaEA: '', fechaVencimiento: '', monto: '', metodoPagoId: '', enCaja: true });
  creando.value = true;
}
async function onCrear() {
  const ok = await ejecutar(() =>
    crearInversion({
      ambito: pestana.value === 'hogar' ? 'hogar' : 'personal',
      nombre: nueva.nombre,
      tipo: nueva.tipo,
      entidad: nueva.entidad || undefined,
      fechaInicio: nueva.fechaInicio,
      tasaEA: nueva.tasaEA === '' ? null : Number(nueva.tasaEA),
      fechaVencimiento: nueva.fechaVencimiento || null,
      ...(nueva.monto ? { aporteInicial: { monto: Number(nueva.monto), fecha: nueva.fechaInicio, metodoPagoId: nueva.enCaja ? nueva.metodoPagoId || null : null, enCaja: nueva.enCaja } } : {}),
    }),
  );
  if (ok) creando.value = false;
}

// --- Detalle ---
const abiertaId = ref(null);
const accion = reactive({ tipo: null, monto: '', fecha: '', metodoPagoId: '', enCaja: true });
function abrirAccion(tipo) {
  Object.assign(accion, { tipo, monto: '', fecha: hoyISO(), metodoPagoId: '', enCaja: true });
}
async function onAccion(inv) {
  const ok = await ejecutar(() =>
    accion.tipo === 'valor'
      ? registrarValoracion(inv.id, { valor: Number(accion.monto), fecha: accion.fecha })
      : registrarMovimientoInversion(inv.id, {
          tipo: accion.tipo,
          monto: Number(accion.monto),
          fecha: accion.fecha,
          metodoPagoId: accion.enCaja ? accion.metodoPagoId || null : null,
          enCaja: accion.enCaja,
        }),
  );
  if (ok) accion.tipo = null;
}
async function quitarMovimiento(inv, m) {
  if (!(await confirmar(`¿Quitar este ${m.tipo} de ${formatCurrency(m.monto)}?`, { textoAceptar: 'Quitar' }))) return;
  await ejecutar(() => eliminarMovimientoInversion(inv.id, m.id));
}

// --- Editar / cerrar / eliminar ---
const editando = ref(null);
const edicion = reactive({});
function abrirEdicion(inv) {
  editando.value = inv;
  Object.assign(edicion, {
    nombre: inv.nombre,
    tipo: inv.tipo,
    entidad: inv.entidad ?? '',
    tasaEA: inv.tasaEA ?? '',
    fechaVencimiento: inv.fechaVencimiento ? String(inv.fechaVencimiento).slice(0, 10) : '',
  });
}
async function onGuardarEdicion() {
  const ok = await ejecutar(() =>
    actualizarInversion(editando.value.id, {
      nombre: edicion.nombre,
      tipo: edicion.tipo,
      entidad: edicion.entidad || null,
      tasaEA: edicion.tasaEA === '' ? null : Number(edicion.tasaEA),
      fechaVencimiento: edicion.fechaVencimiento || null,
    }),
  );
  if (ok) editando.value = null;
}
async function alternarActiva(inv) {
  await ejecutar(() => actualizarInversion(inv.id, { activa: !inv.activa }));
}
async function onEliminar(inv) {
  if (!(await confirmar(`¿Eliminar la inversión "${inv.nombre}"?`))) return;
  await ejecutar(() => eliminarInversion(inv.id));
}

defineExpose({ abrirNueva });
</script>

<template>
  <div class="space-y-6">
    <AlertError :message="error" />
    <p v-if="!datos" class="card card-pad empty">Cargando…</p>

    <template v-else>
      <div class="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
        <section class="card card-pad relative overflow-hidden col-span-2 sm:col-span-1">
          <div class="pointer-events-none absolute inset-x-0 top-0 h-1 bg-positive" aria-hidden="true" />
          <p class="stat-label">Tus inversiones</p>
          <p class="stat-value-lg text-ink-primary">{{ formatCurrency(datos.resumen.valorPersonal) }}</p>
          <p class="stat-hint">Valor actual de las que tienes abiertas.</p>
        </section>
        <section class="card card-pad">
          <p class="stat-label">Del hogar</p>
          <p class="stat-value text-ink-primary">{{ formatCurrency(datos.resumen.valorHogar) }}</p>
          <p class="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-ink-tertiary">Tu parte: {{ formatCurrency(datos.resumen.miParteHogar) }}</p>
        </section>
        <section class="card card-pad">
          <p class="stat-label">Ganancia (tuyas)</p>
          <p class="stat-value" :class="datos.resumen.gananciaPersonal < 0 ? 'text-negative' : 'text-positive'">
            {{ signo(datos.resumen.gananciaPersonal) }}{{ formatCurrency(datos.resumen.gananciaPersonal) }}
          </p>
          <p class="stat-hint">Valor + retiros − aportes.</p>
        </section>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="tabs" role="tablist" aria-label="Inversiones">
          <button type="button" role="tab" class="tab" :class="{ 'tab-active': pestana === 'personales' }" :aria-selected="pestana === 'personales'" @click="pestana = 'personales'">
            Personales ({{ datos.personales.length }})
          </button>
          <button type="button" role="tab" class="tab" :class="{ 'tab-active': pestana === 'hogar' }" :aria-selected="pestana === 'hogar'" @click="pestana = 'hogar'">
            Del hogar ({{ datos.hogar.length }})
          </button>
        </div>
        <button v-if="pestana === 'personales' || puedeEditarHogar" type="button" class="btn-secondary btn-sm" @click="abrirNueva">
          <AppIcon name="plus" class="h-4 w-4" /> Nueva inversión
        </button>
      </div>

      <div v-if="!lista.length" class="card card-pad empty flex flex-col items-center gap-2">
        <AppIcon name="trendingUp" class="h-6 w-6" />
        {{ pestana === 'hogar' ? 'El hogar no tiene inversiones registradas.' : 'No tienes inversiones registradas.' }}
      </div>

      <section v-for="inv in ordenada" :key="inv.id" class="card" :class="{ 'opacity-60': !inv.activa }">
        <button type="button" class="flex w-full flex-wrap items-start justify-between gap-x-3 gap-y-2 p-4 text-left sm:flex-nowrap sm:p-6" :aria-expanded="abiertaId === inv.id" @click="abiertaId = abiertaId === inv.id ? null : inv.id; accion.tipo = null">
          <div class="min-w-0 flex-1 basis-56">
            <p class="flex flex-wrap items-center gap-1.5 text-[15px] sm:text-base font-semibold text-ink-primary">
              <span class="truncate">{{ inv.nombre }}</span>
              <span class="badge-neutral">{{ nombreTipo(inv.tipo) }}</span>
              <span v-if="!inv.activa" class="badge-neutral">Cerrada</span>
            </p>
            <p class="mt-0.5 text-[13px] text-ink-tertiary">
              <template v-if="inv.entidad">{{ inv.entidad }} · </template>desde {{ formatDate(inv.fechaInicio) }}
              <template v-if="inv.tasaEA"> · {{ String(inv.tasaEA).replace('.', ',') }} % E.A.</template>
              <template v-if="inv.fechaVencimiento"> · vence {{ formatDate(inv.fechaVencimiento) }}</template>
            </p>
            <p v-if="inv.ambito === 'hogar' && inv.participaciones?.length" class="mt-1 text-xs text-ink-tertiary">
              <template v-for="(p, i) in inv.participaciones" :key="p.usuarioId">{{ i ? ' · ' : '' }}{{ nombreMiembro(p.usuarioId) }} {{ Math.round(p.porcentaje) }} %</template>
            </p>
          </div>
          <span class="flex shrink-0 items-start gap-2 sm:text-right">
            <span>
              <span class="block text-base sm:text-lg font-semibold text-ink-primary">{{ formatCurrency(inv.valorActual) }}</span>
              <span class="block text-xs text-ink-tertiary">{{ ORIGEN_VALOR[inv.origenValor] }}</span>
              <span v-if="inv.aportes" class="mt-1 block text-[13px]" :class="inv.ganancia < 0 ? 'text-negative' : 'text-positive'">
                {{ signo(inv.ganancia) }}{{ formatCurrency(inv.ganancia) }}<template v-if="inv.rentabilidadPct != null"> ({{ signo(inv.rentabilidadPct) }}{{ inv.rentabilidadPct.toFixed(1).replace('.', ',') }} %)</template>
              </span>
            </span>
            <AppIcon :name="abiertaId === inv.id ? 'chevronDown' : 'chevronRight'" class="mt-1 h-4 w-4 text-ink-tertiary" />
          </span>
        </button>

        <div v-if="abiertaId === inv.id" class="space-y-4 border-t border-border px-4 pb-4 pt-4 sm:px-6 sm:pb-5">
          <div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><p class="stat-label">Aportado</p><p class="mt-1 font-semibold text-ink-primary">{{ formatCurrency(inv.aportes) }}</p></div>
            <div><p class="stat-label">Retirado</p><p class="mt-1 font-semibold text-ink-primary">{{ formatCurrency(inv.retiros) }}</p></div>
            <div v-if="inv.ambito === 'hogar'"><p class="stat-label">Tu parte</p><p class="mt-1 font-semibold text-ink-primary">{{ formatCurrency(inv.miParte) }}</p></div>
            <div v-if="inv.valorAlVencer"><p class="stat-label">Al vencer (estimado)</p><p class="mt-1 font-semibold text-positive">{{ formatCurrency(inv.valorAlVencer) }}</p></div>
          </div>

          <form v-if="accion.tipo" class="panel-sunken grid grid-cols-2 gap-3 p-4 sm:grid-cols-3" @submit.prevent="onAccion(inv)">
            <FormField
              v-model="accion.monto"
              type="number"
              :label="accion.tipo === 'valor' ? 'Valor actual (COP)' : accion.tipo === 'aporte' ? 'Aportas (COP)' : 'Retiras (COP)'"
              required
            />
            <FormField v-model="accion.fecha" type="date" label="Fecha" required />
            <label v-if="accion.tipo !== 'valor'" class="col-span-2 sm:col-span-3 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
              <input v-model="accion.enCaja" type="checkbox" class="h-4 w-4 rounded accent-accent" />
              {{ accion.tipo === 'aporte' ? 'Sale de una de mis cuentas (baja mi Disponible)' : 'Llega a una de mis cuentas (sube mi Disponible)' }}
            </label>
            <div v-if="accion.tipo !== 'valor' && accion.enCaja" class="col-span-2 sm:col-span-1">
              <label class="label" :for="`inv-cuenta-${inv.id}`">{{ accion.tipo === 'aporte' ? 'Sale de' : 'Llega a' }}</label>
              <select :id="`inv-cuenta-${inv.id}`" v-model="accion.metodoPagoId" class="field">
                <option value="">Sin definir</option>
                <option v-for="m in cuentas" :key="m.id" :value="m.id">{{ m.nombre }}</option>
              </select>
            </div>
            <p class="col-span-2 sm:col-span-3 text-xs text-ink-tertiary">
              <template v-if="accion.tipo === 'valor'">Lo que dice tu extracto o la app de la entidad. Los aportes y retiros posteriores se suman o restan solos.</template>
              <template v-else-if="!accion.enCaja && accion.tipo === 'aporte'">Suma a la inversión y a tu patrimonio sin tocar tu Disponible: la plata vino de otra fuente o ya estaba invertida.</template>
              <template v-else-if="!accion.enCaja">Baja la inversión sin tocar tu Disponible: la plata no llegó a una de tus cuentas.</template>
              <template v-else-if="accion.tipo === 'aporte'">Baja tu Disponible pero no cuenta como gasto.</template>
              <template v-else>Sube tu Disponible pero no cuenta como ingreso.</template>
            </p>
            <div class="col-span-2 sm:col-span-3 flex justify-end gap-2">
              <button type="button" class="btn-ghost btn-sm" @click="accion.tipo = null">Cancelar</button>
              <button type="submit" class="btn-primary btn-sm">Guardar</button>
            </div>
          </form>

          <div v-else class="flex flex-wrap gap-1.5">
            <template v-if="inv.activa">
              <button type="button" class="btn-secondary btn-sm" @click="abrirAccion('aporte')">Aportar</button>
              <button type="button" class="btn-ghost btn-sm" @click="abrirAccion('retiro')">Retirar</button>
              <button v-if="editable(inv)" type="button" class="btn-ghost btn-sm" @click="abrirAccion('valor')">Actualizar valor</button>
            </template>
            <template v-if="editable(inv)">
              <button type="button" class="btn-ghost btn-sm" @click="abrirEdicion(inv)"><AppIcon name="edit" class="h-4 w-4" /> Editar</button>
              <button v-if="inv.movimientos.length" type="button" class="btn-ghost btn-sm" @click="alternarActiva(inv)">{{ inv.activa ? 'Cerrar' : 'Reabrir' }}</button>
              <button v-else type="button" class="btn-ghost btn-sm text-negative" @click="onEliminar(inv)"><AppIcon name="trash" class="h-4 w-4" /> Eliminar</button>
            </template>
          </div>

          <div v-if="inv.movimientos.length || inv.valoraciones.length">
            <p class="section-title !text-sm">Historial</p>
            <ul class="list mt-1">
              <li
                v-for="item in [
                  ...inv.movimientos.map((m) => ({ ...m, clase: 'mov' })),
                  ...inv.valoraciones.map((v) => ({ ...v, clase: 'valor' })),
                ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))"
                :key="item.id"
                class="list-row !py-2 text-[13px]"
              >
                <span class="text-ink-secondary">
                  {{ formatDate(item.fecha) }} ·
                  <template v-if="item.clase === 'valor'">valor actualizado</template>
                  <template v-else>{{ item.tipo }}<template v-if="inv.ambito === 'hogar'"> de {{ nombreMiembro(item.usuarioId) }}</template><template v-if="item.enCaja === false"> · no tocó el Disponible</template></template>
                </span>
                <span class="flex items-center gap-1.5">
                  <span class="font-semibold" :class="item.clase === 'valor' ? 'text-accent' : item.tipo === 'retiro' ? 'text-warning' : 'text-ink-primary'">
                    {{ item.clase === 'mov' && item.tipo === 'retiro' ? '−' : '' }}{{ formatCurrency(item.clase === 'valor' ? item.valor : item.monto) }}
                  </span>
                  <button v-if="item.clase === 'mov' && item.usuarioId === yo" type="button" class="btn-icon !p-1" aria-label="Quitar movimiento" @click="quitarMovimiento(inv, item)">
                    <AppIcon name="x" class="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </template>

    <AppModal v-if="creando" :title="pestana === 'hogar' ? 'Inversión del hogar' : 'Inversión personal'" @close="creando = false">
      <AlertError :message="error" class="mb-4" />
      <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="onCrear">
        <FormField v-model="nueva.nombre" label="Nombre" required placeholder="CDT Bancolombia" />
        <div>
          <label class="label" for="inv-tipo">Tipo</label>
          <select id="inv-tipo" v-model="nueva.tipo" class="field">
            <option v-for="t in TIPOS" :key="t.valor" :value="t.valor">{{ t.label }}</option>
          </select>
        </div>
        <FormField v-model="nueva.entidad" label="Entidad (opcional)" />
        <FormField v-model="nueva.fechaInicio" type="date" label="Fecha de inicio" required />
        <FormField v-model="nueva.tasaEA" type="number" step="0.01" label="Tasa E.A. % (opcional)" hint="Para estimar el valor (CDT)." />
        <FormField v-model="nueva.fechaVencimiento" type="date" label="Vencimiento (opcional)" />
        <FormField v-model="nueva.monto" type="number" label="Aporte inicial (opcional)" />
        <label v-if="nueva.monto" class="sm:col-span-2 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
          <input v-model="nueva.enCaja" type="checkbox" class="h-4 w-4 rounded accent-accent" />
          Sale de una de mis cuentas (baja mi Disponible)
        </label>
        <div v-if="nueva.monto && nueva.enCaja">
          <label class="label" for="inv-cuenta">Sale de</label>
          <select id="inv-cuenta" v-model="nueva.metodoPagoId" class="field">
            <option value="">Sin definir</option>
            <option v-for="m in cuentas" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
        </div>
        <p class="sm:col-span-2 text-xs text-ink-tertiary">
          Los aportes que salen de tus cuentas bajan tu Disponible pero no cuentan como gasto. Si ya la tenías o la plata vino de otra fuente, desmarca la casilla.
          <template v-if="pestana === 'hogar'">En el hogar, la parte de cada uno sale de lo que ha puesto.</template>
        </p>
        <div class="flex justify-end gap-2 sm:col-span-2">
          <button type="button" class="btn-ghost" @click="creando = false">Cancelar</button>
          <button type="submit" class="btn-primary">Guardar</button>
        </div>
      </form>
    </AppModal>

    <AppModal v-if="editando" :title="`Editar ${editando.nombre}`" @close="editando = null">
      <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="onGuardarEdicion">
        <FormField v-model="edicion.nombre" label="Nombre" required />
        <div>
          <label class="label" for="inv-edit-tipo">Tipo</label>
          <select id="inv-edit-tipo" v-model="edicion.tipo" class="field">
            <option v-for="t in TIPOS" :key="t.valor" :value="t.valor">{{ t.label }}</option>
          </select>
        </div>
        <FormField v-model="edicion.entidad" label="Entidad" />
        <FormField v-model="edicion.tasaEA" type="number" step="0.01" label="Tasa E.A. %" />
        <FormField v-model="edicion.fechaVencimiento" type="date" label="Vencimiento" />
        <div class="flex items-end justify-end gap-2 sm:col-span-2">
          <button type="button" class="btn-ghost" @click="editando = null">Cancelar</button>
          <button type="submit" class="btn-primary">Guardar</button>
        </div>
      </form>
    </AppModal>
  </div>
</template>
