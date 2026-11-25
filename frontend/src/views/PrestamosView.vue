<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  listarPrestamos,
  crearPrestamo,
  actualizarPrestamo,
  eliminarPrestamo,
  pagarCuotaPrestamo,
  deshacerPagoCuotaPrestamo,
  abonarPrestamo,
  eliminarAbonoPrestamo,
} from '../api/prestamos.js';
import { listarMetodosPago } from '../api/metodosPagoPersonales.js';
import { listarCategorias } from '../api/categoriasPersonales.js';
import { listarMiembros } from '../api/hogares.js';
import { extractErrorMessage } from '../api/client.js';
import { confirmar } from '../composables/useConfirm.js';
import { useAuthStore } from '../stores/auth.js';
import { formatCurrency, formatDate, hoyISO, formatTasa } from '../utils/format.js';
import AppLayout from '../components/AppLayout.vue';
import AppIcon from '../components/AppIcon.vue';
import AppModal from '../components/AppModal.vue';
import AlertError from '../components/AlertError.vue';
import FormField from '../components/FormField.vue';
import PrestamoForm from '../components/prestamos/PrestamoForm.vue';
import InversionesSection from '../components/patrimonio/InversionesSection.vue';
import { obtenerResumenPersonal } from '../api/resumenPersonal.js';

/**
 * Patrimonio: lo que tienes menos lo que debes, con dos vistas (Préstamos e
 * Inversiones, ?vista=inversiones). Préstamos personales y del hogar: saldo, cuotas (con "Lo pagué" para los
 * manuales), abonos extra a capital y un orden sugerido de pago.
 */
const auth = useAuthStore();
const yo = computed(() => auth.usuario?.id);

const datos = ref(null);
const metodos = ref([]);
const categorias = ref([]);
const miembros = ref([]);
const cargando = ref(true);
const error = ref('');
const pestana = ref('personales');

const TIPO = {
  libre_inversion: 'Libre inversión',
  vehiculo: 'Vehículo',
  vivienda: 'Vivienda',
  educativo: 'Educativo',
  persona: 'Con una persona',
  otro: 'Otro',
};

async function cargar() {
  error.value = '';
  try {
    datos.value = await listarPrestamos();
  } catch (e) {
    error.value = extractErrorMessage(e);
  }
}

// --- Patrimonio y vista ---
const route = useRoute();
const router = useRouter();
const vista = ref(route.query.vista === 'inversiones' ? 'inversiones' : 'prestamos');
watch(vista, (v) => router.replace({ query: v === 'inversiones' ? { vista: v } : {} }));
const patrimonio = ref(null);
async function cargarPatrimonio() {
  try {
    patrimonio.value = (await obtenerResumenPersonal()).patrimonio;
  } catch {
    // El patrimonio es informativo: si falla, la pantalla sigue.
  }
}
cargarPatrimonio();

onMounted(async () => {
  try {
    const [, m, c, mi] = await Promise.all([cargar(), listarMetodosPago(), listarCategorias(), listarMiembros()]);
    metodos.value = m;
    categorias.value = c;
    miembros.value = mi;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    cargando.value = false;
  }
});

const lista = computed(() => (pestana.value === 'hogar' ? datos.value?.hogar : datos.value?.personales) ?? []);
const activos = computed(() => lista.value.filter((p) => !p.terminado));
const terminados = computed(() => lista.value.filter((p) => p.terminado));
const nombreMiembro = (id) => miembros.value.find((m) => m.id === id)?.nombre ?? '—';
const nombreMetodo = (id) => metodos.value.find((m) => m.id === id)?.nombre ?? null;
const puedeEditarHogar = computed(() => auth.usuario?.esAdmin || auth.usuario?.puedeEditarGastos);
const editable = (p) => p.ambito === 'personal' || puedeEditarHogar.value;

function reemplazar(prestamo) {
  const clave = prestamo.ambito === 'hogar' ? 'hogar' : 'personales';
  const i = datos.value[clave].findIndex((p) => p.id === prestamo.id);
  if (i >= 0) datos.value[clave][i] = { ...prestamo, pagador: datos.value[clave][i].pagador };
}

async function ejecutar(fn, { recargarTodo = false } = {}) {
  error.value = '';
  try {
    const r = await fn();
    // El resumen (deuda total, orden sugerido) depende de todos: se recarga.
    if (recargarTodo || !r) await cargar();
    else {
      reemplazar(r);
      await cargar();
    }
    cargarPatrimonio();
    return true;
  } catch (e) {
    error.value = extractErrorMessage(e);
    return false;
  }
}

// --- Crear ---
const creando = ref(false);
const guardando = ref(false);
async function onCrear(payload) {
  guardando.value = true;
  if (await ejecutar(() => crearPrestamo(payload), { recargarTodo: true })) creando.value = false;
  guardando.value = false;
}

// --- Detalle abierto ---
const abiertoId = ref(null);
const verTodas = ref(false);
function alternar(p) {
  abiertoId.value = abiertoId.value === p.id ? null : p.id;
  verTodas.value = false;
  pagando.numero = null;
  abonando.value = null;
}
function cuotasVisibles(p) {
  if (verTodas.value) return p.cuotas;
  // Las pagadas recientes y las próximas 6.
  const primeraPendiente = p.cuotas.findIndex((c) => !c.pagada);
  const desde = Math.max(0, (primeraPendiente === -1 ? p.cuotas.length : primeraPendiente) - 2);
  return p.cuotas.slice(desde, desde + 8);
}
function estadoCuota(c) {
  if (c.pagada) return { label: c.enCuadre ? 'Cuadrada' : 'Pagada', clase: 'badge-positive' };
  const hoy = hoyISO();
  const f = String(c.fecha).slice(0, 10);
  if (f < hoy) return { label: 'Atrasada', clase: 'badge-negative' };
  if (f === hoy) return { label: 'Por pagar', clase: 'badge-warning' };
  return { label: 'Próxima', clase: 'badge-neutral' };
}

// --- Lo pagué ---
const pagando = reactive({ prestamoId: null, numero: null, fecha: '', monto: '', metodoPagoId: '', pagoUsuarioId: '' });
function abrirPago(p, c) {
  pagando.prestamoId = p.id;
  pagando.numero = c.numero;
  pagando.fecha = hoyISO();
  pagando.monto = c.monto;
  pagando.pagoUsuarioId = p.pagoUsuarioId ?? yo.value;
  pagando.metodoPagoId = p.pagoUsuarioId === yo.value || p.ambito === 'personal' ? (p.metodoPagoId ?? '') : '';
}
async function onPagar(p, c) {
  const pagaYo = p.ambito === 'personal' || pagando.pagoUsuarioId === yo.value;
  const ok = await ejecutar(() =>
    pagarCuotaPrestamo(p.id, c.numero, {
      fecha: pagando.fecha,
      monto: Number(pagando.monto),
      metodoPagoId: pagaYo ? pagando.metodoPagoId || null : undefined,
      ...(p.ambito === 'hogar' ? { pagoUsuarioId: pagando.pagoUsuarioId } : {}),
    }),
  );
  if (ok) pagando.numero = null;
}
async function onDeshacer(p, c) {
  if (!(await confirmar(`¿Deshacer el pago de la cuota ${c.numero}?`, { textoAceptar: 'Deshacer', peligroso: false }))) return;
  await ejecutar(() => deshacerPagoCuotaPrestamo(p.id, c.numero));
}

// --- Abono a capital ---
const abonando = ref(null);
const abono = reactive({ monto: '', fecha: '', modo: 'reducir_plazo', metodoPagoId: '', pagoUsuarioId: '' });
function abrirAbono(p) {
  abonando.value = p.id;
  abono.monto = '';
  abono.fecha = hoyISO();
  abono.modo = 'reducir_plazo';
  abono.metodoPagoId = '';
  abono.pagoUsuarioId = yo.value;
}
async function onAbonar(p) {
  const pagaYo = p.ambito === 'personal' || abono.pagoUsuarioId === yo.value;
  const ok = await ejecutar(() =>
    abonarPrestamo(p.id, {
      monto: Number(abono.monto),
      fecha: abono.fecha,
      modo: abono.modo,
      metodoPagoId: pagaYo ? abono.metodoPagoId || null : undefined,
      ...(p.ambito === 'hogar' ? { pagoUsuarioId: abono.pagoUsuarioId } : {}),
    }),
  );
  if (ok) abonando.value = null;
}
async function onQuitarAbono(p, a) {
  if (!(await confirmar(`¿Quitar el abono de ${formatCurrency(a.monto)}? Las cuotas sin pagar se recalculan.`, { textoAceptar: 'Quitar' }))) return;
  await ejecutar(() => eliminarAbonoPrestamo(p.id, a.id));
}

// --- Editar / eliminar ---
const editando = ref(null);
const edicion = reactive({ nombre: '', entidad: '', modoCobro: 'manual', metodoPagoId: '', pagoUsuarioId: '' });
function abrirEdicion(p) {
  editando.value = p;
  edicion.nombre = p.nombre;
  edicion.entidad = p.entidad ?? '';
  edicion.modoCobro = p.modoCobro;
  edicion.metodoPagoId = p.metodoPagoId ?? '';
  edicion.pagoUsuarioId = p.pagoUsuarioId ?? '';
}
async function onGuardarEdicion() {
  const p = editando.value;
  const pagaYo = p.ambito === 'personal' || edicion.pagoUsuarioId === yo.value;
  const ok = await ejecutar(() =>
    actualizarPrestamo(p.id, {
      nombre: edicion.nombre,
      entidad: edicion.entidad || null,
      modoCobro: edicion.modoCobro,
      ...(pagaYo ? { metodoPagoId: edicion.metodoPagoId || null } : {}),
      ...(p.ambito === 'hogar' ? { pagoUsuarioId: edicion.pagoUsuarioId } : {}),
    }),
  );
  if (ok) editando.value = null;
}
async function onEliminar(p) {
  if (!(await confirmar(`¿Eliminar el préstamo "${p.nombre}" con todas sus cuotas?`))) return;
  await ejecutar(() => eliminarPrestamo(p.id), { recargarTodo: true });
}

function progreso(p) {
  return p.totalCuotas ? Math.round((p.cuotasPagadas / p.totalCuotas) * 100) : 0;
}
</script>

<template>
  <AppLayout title="Patrimonio" subtitle="Lo que tienes y lo que debes: préstamos e inversiones.">
    <template #actions>
      <button v-if="vista === 'prestamos'" type="button" class="btn-primary" @click="creando = true">
        <AppIcon name="plus" class="h-4 w-4" :stroke-width="2.2" />
        Registrar préstamo
      </button>
    </template>

    <div class="space-y-6">
      <!-- Patrimonio: lo que tienes − lo que debes -->
      <section v-if="patrimonio" class="card card-pad">
        <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p class="stat-label">Tu patrimonio</p>
            <p class="stat-value-lg" :class="patrimonio.total < 0 ? 'text-negative' : 'text-ink-primary'">{{ formatCurrency(patrimonio.total) }}</p>
          </div>
          <dl class="grid grid-cols-2 gap-x-5 gap-y-1 text-[13px] sm:flex sm:flex-wrap sm:gap-x-6">
            <div class="flex justify-between gap-2 sm:block"><dt class="text-ink-tertiary">Disponible</dt><dd class="font-medium text-ink-primary">{{ formatCurrency(patrimonio.disponible) }}</dd></div>
            <div v-if="patrimonio.ahorros" class="flex justify-between gap-2 sm:block"><dt class="text-ink-tertiary">Ahorros</dt><dd class="font-medium text-positive">+{{ formatCurrency(patrimonio.ahorros) }}</dd></div>
            <div class="flex justify-between gap-2 sm:block"><dt class="text-ink-tertiary">Inversiones</dt><dd class="font-medium text-positive">+{{ formatCurrency(patrimonio.inversiones) }}</dd></div>
            <div v-if="patrimonio.metasHogar" class="flex justify-between gap-2 sm:block"><dt class="text-ink-tertiary"><span class="sm:hidden">Metas</span><span class="hidden sm:inline">Metas del hogar</span></dt><dd class="font-medium text-positive">+{{ formatCurrency(patrimonio.metasHogar) }}</dd></div>
            <div class="flex justify-between gap-2 sm:block"><dt class="text-ink-tertiary">Tarjetas</dt><dd class="font-medium text-warning">−{{ formatCurrency(patrimonio.deudaTarjetas) }}</dd></div>
            <div class="flex justify-between gap-2 sm:block"><dt class="text-ink-tertiary">Préstamos</dt><dd class="font-medium text-warning">−{{ formatCurrency(patrimonio.prestamos) }}</dd></div>
          </dl>
        </div>
        <p class="stat-hint">Incluye tu parte de las inversiones y préstamos del hogar.</p>
      </section>

      <div class="tabs w-full sm:w-auto" role="tablist" aria-label="Patrimonio">
        <button type="button" role="tab" class="tab flex-1 sm:flex-none" :class="{ 'tab-active': vista === 'prestamos' }" :aria-selected="vista === 'prestamos'" @click="vista = 'prestamos'">
          Préstamos
        </button>
        <button type="button" role="tab" class="tab flex-1 sm:flex-none" :class="{ 'tab-active': vista === 'inversiones' }" :aria-selected="vista === 'inversiones'" @click="vista = 'inversiones'">
          Inversiones
        </button>
      </div>

      <InversionesSection v-if="vista === 'inversiones'" @cambio="cargarPatrimonio" />

      <template v-else>
      <AlertError :message="error" />
      <div v-if="cargando" class="card card-pad"><p class="empty">Cargando…</p></div>

      <template v-else-if="datos">
        <!-- Resumen -->
        <div class="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
          <section class="card card-pad relative overflow-hidden col-span-2 sm:col-span-1">
            <div class="pointer-events-none absolute inset-x-0 top-0 h-1 bg-warning" aria-hidden="true" />
            <p class="stat-label">Debes (personal)</p>
            <p class="stat-value-lg text-ink-primary">
              {{ formatCurrency(datos.resumen.deudaPersonal) }}
            </p>
            <p class="stat-hint">Capital que falta de tus préstamos.</p>
          </section>
          <section class="card card-pad">
            <p class="stat-label">Del hogar</p>
            <p class="stat-value text-ink-primary">
              {{ formatCurrency(datos.resumen.deudaHogar) }}
            </p>
            <p class="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-ink-tertiary">Tu parte: {{ formatCurrency(datos.resumen.miParteHogar) }}</p>
          </section>
          <section class="card card-pad">
            <p class="stat-label">Intereses por pagar</p>
            <p class="stat-value text-warning">
              {{ formatCurrency(datos.resumen.interesesPendientes) }}
            </p>
            <p class="stat-hint">Si pagas cada cuota como está planeada.</p>
          </section>
        </div>

        <!-- Orden sugerido -->
        <section v-if="datos.resumen.ordenSugerido.length > 1" class="card card-pad">
          <h2 class="section-title">Si te sobra plata, abona primero a…</h2>
          <p class="section-hint mb-3">De la tasa más alta a la más baja: cada peso abonado ahí te ahorra más intereses.</p>
          <ol class="space-y-1.5">
            <li v-for="(o, i) in datos.resumen.ordenSugerido" :key="o.id" class="flex items-center justify-between gap-3 text-sm">
              <span class="flex min-w-0 items-center gap-2">
                <span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-sunken text-xs font-semibold text-ink-secondary">{{ i + 1 }}</span>
                <span class="truncate text-ink-primary">{{ o.nombre }}</span>
                <span v-if="o.ambito === 'hogar'" class="badge-neutral">Hogar</span>
              </span>
              <span class="shrink-0 text-ink-secondary">{{ formatTasa(Number(o.tasaMensual.toFixed(2))) }}<span class="hidden sm:inline"> · {{ formatCurrency(o.saldoCapital) }}</span></span>
            </li>
          </ol>
        </section>

        <div class="tabs" role="tablist" aria-label="Préstamos">
          <button type="button" role="tab" class="tab" :class="{ 'tab-active': pestana === 'personales' }" :aria-selected="pestana === 'personales'" @click="pestana = 'personales'">
            Personales ({{ datos.personales.length }})
          </button>
          <button type="button" role="tab" class="tab" :class="{ 'tab-active': pestana === 'hogar' }" :aria-selected="pestana === 'hogar'" @click="pestana = 'hogar'">
            Del hogar ({{ datos.hogar.length }})
          </button>
        </div>

        <div v-if="!lista.length" class="card card-pad empty flex flex-col items-center gap-2">
          <AppIcon name="receipt" class="h-6 w-6" />
          {{ pestana === 'hogar' ? 'El hogar no tiene préstamos registrados.' : 'No tienes préstamos registrados.' }}
        </div>

        <section v-for="p in [...activos, ...terminados]" :key="p.id" class="card" :class="{ 'opacity-60': p.terminado }">
          <button type="button" class="flex w-full flex-wrap items-start justify-between gap-x-3 gap-y-2 p-4 text-left sm:flex-nowrap sm:p-6" :aria-expanded="abiertoId === p.id" @click="alternar(p)">
            <div class="min-w-0 flex-1 basis-60">
              <p class="flex flex-wrap items-center gap-1.5 text-[15px] sm:text-base font-semibold text-ink-primary">
                <span class="truncate">{{ p.nombre }}</span>
                <span class="badge-neutral">{{ TIPO[p.tipo] }}</span>
                <span v-if="p.terminado" class="badge-positive">Pagado</span>
                <span v-else-if="p.atrasadas" class="badge-negative">{{ p.atrasadas }} atrasada{{ p.atrasadas === 1 ? '' : 's' }}</span>
                <span class="badge-neutral">{{ p.modoCobro === 'automatico' ? 'Automático' : 'Manual' }}</span>
              </p>
              <p class="mt-0.5 text-[13px] text-ink-tertiary">
                <template v-if="p.entidad">{{ p.entidad }} · </template>
                {{ p.tasaIngresada ? `${String(p.tasaIngresada).replace('.', ',')} % ${p.tasaEsAnual ? 'E.A.' : 'mensual'}` : 'Sin interés' }}
                <template v-if="p.ambito === 'hogar'"> · paga {{ p.pagador?.nombre ?? '—' }} · tu parte {{ Math.round(p.miPorcentaje ?? 0) }} %</template>
              </p>
              <div class="mt-3 flex items-center gap-3">
                <div class="h-1.5 w-20 sm:w-40 shrink-0 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" :aria-valuenow="progreso(p)" aria-valuemin="0" aria-valuemax="100" :aria-label="`Cuotas pagadas de ${p.nombre}`">
                  <div class="h-full rounded-full bg-positive" :style="{ width: progreso(p) + '%' }" />
                </div>
                <span class="text-xs text-ink-tertiary">{{ p.cuotasPagadas }}/{{ p.totalCuotas }} cuotas<template v-if="p.terminaEn"> · termina {{ formatDate(p.terminaEn) }}</template></span>
              </div>
            </div>
            <span class="flex shrink-0 items-start gap-2 sm:text-right">
              <span>
                <span class="block text-base sm:text-lg font-semibold text-ink-primary">{{ formatCurrency(p.saldoCapital) }}</span>
                <span class="block text-xs text-ink-tertiary">capital que falta</span>
                <span v-if="p.proximaCuota" class="mt-1 block text-[13px] text-ink-secondary">
                  Próxima {{ formatDate(p.proximaCuota.fecha) }} · {{ formatCurrency(p.proximaCuota.monto) }}
                </span>
              </span>
              <AppIcon :name="abiertoId === p.id ? 'chevronDown' : 'chevronRight'" class="mt-1 h-4 w-4 text-ink-tertiary" />
            </span>
          </button>

          <div v-if="abiertoId === p.id" class="space-y-5 border-t border-border px-4 pb-4 pt-4 sm:px-6 sm:pb-5">
            <div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><p class="stat-label">Intereses pagados</p><p class="mt-1 font-semibold text-ink-primary">{{ formatCurrency(p.interesesPagados) }}</p></div>
              <div><p class="stat-label">Intereses por pagar</p><p class="mt-1 font-semibold text-warning">{{ formatCurrency(p.interesesPendientes) }}</p></div>
              <div><p class="stat-label">Falta pagar en cuotas</p><p class="mt-1 font-semibold text-ink-primary">{{ formatCurrency(p.totalPendiente) }}</p></div>
              <div v-if="p.metodoPagoId"><p class="stat-label">Se paga con</p><p class="mt-1 font-semibold text-ink-primary">{{ nombreMetodo(p.metodoPagoId) ?? '—' }}</p></div>
            </div>

            <!-- Cuotas -->
            <div class="overflow-x-auto">
              <table class="w-full min-w-[560px] text-sm">
                <thead>
                  <tr class="text-left text-[13px] text-ink-tertiary">
                    <th class="py-2 pr-3 font-medium">#</th>
                    <th class="py-2 pr-3 font-medium">Fecha</th>
                    <th class="py-2 pr-3 text-right font-medium">Capital</th>
                    <th class="py-2 pr-3 text-right font-medium">Interés</th>
                    <th class="py-2 pr-3 text-right font-medium">Cuota</th>
                    <th class="py-2 pr-3 font-medium">Estado</th>
                    <th class="py-2" />
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <template v-for="c in cuotasVisibles(p)" :key="c.id">
                    <tr>
                      <td class="py-2 pr-3 text-ink-tertiary">{{ c.numero }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">
                        {{ formatDate(c.fechaVencimiento) }}
                        <span v-if="c.fechaPago && String(c.fechaPago).slice(0, 10) !== String(c.fechaVencimiento).slice(0, 10)" class="block text-xs text-ink-tertiary">pagada {{ formatDate(c.fechaPago) }}</span>
                      </td>
                      <td class="py-2 pr-3 text-right whitespace-nowrap">{{ formatCurrency(c.capital ?? 0) }}</td>
                      <td class="py-2 pr-3 text-right whitespace-nowrap">
                        {{ formatCurrency(c.interes ?? 0) }}
                        <span v-if="c.mora" class="block text-xs text-negative">+{{ formatCurrency(c.mora) }} mora</span>
                      </td>
                      <td class="py-2 pr-3 text-right whitespace-nowrap font-semibold text-ink-primary">
                        {{ formatCurrency(c.monto) }}
                        <span v-if="p.ambito === 'hogar'" class="block text-xs font-normal text-ink-tertiary">tu parte {{ formatCurrency(c.miParte) }}</span>
                      </td>
                      <td class="py-2 pr-3"><span :class="estadoCuota(c).clase">{{ estadoCuota(c).label }}</span></td>
                      <td class="py-2 text-right whitespace-nowrap">
                        <template v-if="editable(p)">
                          <button v-if="!c.pagada && !(p.ambito === 'hogar' && c.estado !== 'por_pagar')" type="button" class="btn-secondary btn-sm" @click="abrirPago(p, c)">Lo pagué</button>
                          <button v-else-if="c.pagada && !c.enCuadre && p.modoCobro === 'manual'" type="button" class="btn-ghost btn-sm" @click="onDeshacer(p, c)">Deshacer</button>
                        </template>
                      </td>
                    </tr>
                    <tr v-if="pagando.prestamoId === p.id && pagando.numero === c.numero">
                      <td colspan="7" class="py-3">
                        <form class="panel-sunken grid grid-cols-1 gap-3 p-4 sm:grid-cols-4" @submit.prevent="onPagar(p, c)">
                          <FormField v-model="pagando.fecha" type="date" label="Fecha de pago" required />
                          <FormField v-model="pagando.monto" type="number" label="Valor pagado" required hint="Si pagaste más (mora), escríbelo." />
                          <div v-if="p.ambito === 'hogar'">
                            <label class="label" :for="`pago-quien-${c.id}`">Quién pagó</label>
                            <select :id="`pago-quien-${c.id}`" v-model="pagando.pagoUsuarioId" class="field">
                              <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
                            </select>
                          </div>
                          <div v-if="p.ambito === 'personal' || pagando.pagoUsuarioId === yo">
                            <label class="label" :for="`pago-cuenta-${c.id}`">Con qué cuenta</label>
                            <select :id="`pago-cuenta-${c.id}`" v-model="pagando.metodoPagoId" class="field">
                              <option value="">Sin definir</option>
                              <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
                            </select>
                          </div>
                          <div class="flex items-end justify-end gap-2 sm:col-span-4">
                            <button type="button" class="btn-ghost btn-sm" @click="pagando.numero = null">Cancelar</button>
                            <button type="submit" class="btn-primary btn-sm">Guardar pago</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
            <button v-if="p.cuotas.length > 8" type="button" class="btn-ghost btn-sm" @click="verTodas = !verTodas">
              {{ verTodas ? 'Ver menos' : `Ver las ${p.cuotas.length} cuotas` }}
            </button>

            <!-- Abonos -->
            <div v-if="p.abonos.length">
              <p class="section-title !text-sm">Abonos a capital</p>
              <ul class="list mt-1">
                <li v-for="a in p.abonos" :key="a.id" class="list-row !py-2">
                  <span class="text-sm text-ink-secondary">
                    {{ formatDate(a.fecha) }} · {{ a.modo === 'reducir_plazo' ? 'bajó el plazo' : 'bajó la cuota' }}
                    <template v-if="p.ambito === 'hogar'"> · pagó {{ nombreMiembro(a.pagoUsuarioId) }}</template>
                  </span>
                  <span class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-ink-primary">{{ formatCurrency(a.monto) }}</span>
                    <button v-if="editable(p)" type="button" class="btn-ghost btn-sm" @click="onQuitarAbono(p, a)">Quitar</button>
                  </span>
                </li>
              </ul>
            </div>

            <form v-if="abonando === p.id" class="panel-sunken grid grid-cols-1 gap-3 p-4 sm:grid-cols-2" @submit.prevent="onAbonar(p)">
              <p class="sm:col-span-2 text-sm font-medium text-ink-primary">Abono extra a capital</p>
              <FormField v-model="abono.monto" type="number" label="Valor (COP)" required :hint="`Máximo ${formatCurrency(p.saldoCapital)}`" />
              <FormField v-model="abono.fecha" type="date" label="Fecha" required />
              <div class="sm:col-span-2">
                <p class="label">¿Qué quieres que baje?</p>
                <div class="flex flex-wrap gap-4 text-sm text-ink-secondary">
                  <label class="inline-flex items-center gap-2"><input v-model="abono.modo" type="radio" value="reducir_plazo" class="accent-accent" /> El plazo (terminas antes, mismo valor de cuota)</label>
                  <label class="inline-flex items-center gap-2"><input v-model="abono.modo" type="radio" value="reducir_cuota" class="accent-accent" /> La cuota (mismo plazo, pagas menos cada mes)</label>
                </div>
              </div>
              <div v-if="p.ambito === 'hogar'">
                <label class="label" :for="`abono-quien-${p.id}`">Quién abonó</label>
                <select :id="`abono-quien-${p.id}`" v-model="abono.pagoUsuarioId" class="field">
                  <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
                </select>
              </div>
              <div v-if="p.ambito === 'personal' || abono.pagoUsuarioId === yo">
                <label class="label" :for="`abono-cuenta-${p.id}`">Desde</label>
                <select :id="`abono-cuenta-${p.id}`" v-model="abono.metodoPagoId" class="field">
                  <option value="">Sin definir</option>
                  <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
                </select>
              </div>
              <p class="sm:col-span-2 text-xs text-ink-tertiary">
                Baja tu Disponible pero no cuenta como gasto en informes ni Límites.
                <template v-if="p.ambito === 'hogar'">Se reparte con el porcentaje del hogar y entra al siguiente cuadre.</template>
              </p>
              <div class="flex justify-end gap-2 sm:col-span-2">
                <button type="button" class="btn-ghost btn-sm" @click="abonando = null">Cancelar</button>
                <button type="submit" class="btn-primary btn-sm">Abonar</button>
              </div>
            </form>

            <div v-if="editable(p)" class="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <button v-if="!p.terminado && abonando !== p.id" type="button" class="btn-secondary btn-sm" @click="abrirAbono(p)">Abonar a capital</button>
              <button type="button" class="btn-ghost btn-sm" @click="abrirEdicion(p)">
                <AppIcon name="edit" class="h-4 w-4" /> Editar
              </button>
              <button v-if="!p.cuotas.some((c) => c.pagada) && !p.abonos.length" type="button" class="btn-ghost btn-sm text-negative" @click="onEliminar(p)">
                <AppIcon name="trash" class="h-4 w-4" /> Eliminar
              </button>
            </div>
          </div>
        </section>
      </template>
      </template>
    </div>

    <AppModal v-if="creando" :title="pestana === 'hogar' ? 'Préstamo del hogar' : 'Préstamo personal'" size="lg" @close="creando = false">
      <AlertError :message="error" class="mb-4" />
      <PrestamoForm
        :ambito="pestana === 'hogar' ? 'hogar' : 'personal'"
        :metodos="metodos"
        :categorias="categorias"
        :miembros="miembros"
        :usuario-id="yo"
        :guardando="guardando"
        @guardar="onCrear"
        @cancelar="creando = false"
      />
    </AppModal>

    <AppModal v-if="editando" :title="`Editar ${editando.nombre}`" @close="editando = null">
      <form class="grid grid-cols-1 gap-4" @submit.prevent="onGuardarEdicion">
        <FormField v-model="edicion.nombre" label="Nombre" required />
        <FormField v-model="edicion.entidad" label="Entidad" />
        <div>
          <label class="label" for="editar-modo">Cómo se paga cada cuota</label>
          <select id="editar-modo" v-model="edicion.modoCobro" class="field">
            <option value="manual">Manual: lo marco cuando pague</option>
            <option value="automatico">Automático: débito en su fecha</option>
          </select>
        </div>
        <div v-if="editando.ambito === 'hogar'">
          <label class="label" for="editar-pagador">Quién paga</label>
          <select id="editar-pagador" v-model="edicion.pagoUsuarioId" class="field">
            <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
        </div>
        <div v-if="editando.ambito === 'personal' || edicion.pagoUsuarioId === yo">
          <label class="label" for="editar-cuenta">Cuenta con que se paga</label>
          <select id="editar-cuenta" v-model="edicion.metodoPagoId" class="field">
            <option value="">Sin definir</option>
            <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
        </div>
        <p class="text-xs text-ink-tertiary">Los cambios se aplican a las cuotas que no se han pagado. El monto, la tasa y el plazo no se editan: para cambiarlos usa un abono, o elimínalo y regístralo de nuevo mientras no tenga pagos.</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="editando = null">Cancelar</button>
          <button type="submit" class="btn-primary">Guardar</button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>
