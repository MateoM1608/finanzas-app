<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { crearGasto, actualizarGasto, convertirGastoACompra } from '../../api/gastosPersonales.js';
import { crearIngreso } from '../../api/ingresosPersonales.js';
import { listarCategorias } from '../../api/categoriasPersonales.js';
import { listarMetodosPago } from '../../api/metodosPagoPersonales.js';
import {
  crearCompraPersonal,
  actualizarCompraPersonal,
  sugerirPrimeraCuota,
  convertirCompraPersonalAGasto,
} from '../../api/comprasCuotas.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, hoyISO, modoCobroSugerido, formatTasa, aCentavos } from '../../utils/format.js';
import { registro, cerrarRegistro, avisarCambioPersonal } from '../../stores/registro.js';
import AppModal from '../AppModal.vue';
import FormField from '../FormField.vue';
import AlertError from '../AlertError.vue';
import CamposDolares from './CamposDolares.vue';

/**
 * Registrar o editar un gasto, ingreso o compra a cuotas personal. Se abre
 * desde cualquier pantalla con stores/registro.js; al guardar avisa con
 * `avisarCambioPersonal()` para que cada pantalla vuelva a cargar.
 */
const error = ref('');
const categorias = ref([]);
const metodos = ref([]);
const categoriasParaGasto = computed(() => categorias.value.filter((c) => c.aplicaA.includes('gasto')));
const categoriasParaIngreso = computed(() => categorias.value.filter((c) => c.aplicaA.includes('ingreso')));

async function cargarCatalogos() {
  const [c, m] = await Promise.all([listarCategorias(), listarMetodosPago()]);
  categorias.value = c;
  metodos.value = m;
}

const editando = computed(() => registro.edicion);

// --- Gasto ---
const gMonto = ref('');
const gFecha = ref(hoyISO());
const gDescripcion = ref('');
const gCategoriaId = ref('');
const gMetodoPagoId = ref('');
const gEsObligatorio = ref(false);
const gEstado = ref('pagado');
const guardandoGasto = ref(false);
// Compra en dólares (solo con tarjeta de crédito).
const gEnDolares = ref(false);
const gUsd = ref('');
const gTrm = ref('');
// Compra a cuotas.
const gACuotas = ref(false);
const gNumeroCuotas = ref('3');
const gPrimeraCuota = ref('');
const gModoCobro = ref('automatico');
const gEnCurso = ref(false);
const gCuotasPagadas = ref('');
const gInteres = ref('sin');
const gTasa = ref('');
const gSistema = ref('capital_fijo');

// Mientras se llena el formulario para editar, las sugerencias no pisan lo que ya tiene.
let llenando = false;

async function actualizarSugerenciaCuota() {
  if (llenando || !gACuotas.value || !gFecha.value) return;
  const metodo = metodos.value.find((m) => m.id === gMetodoPagoId.value);
  gModoCobro.value = modoCobroSugerido(metodo);
  gInteres.value = metodo?.tasaMensual > 0 && Number(gNumeroCuotas.value) !== 1 ? 'tarjeta' : 'sin';
  try {
    gPrimeraCuota.value = await sugerirPrimeraCuota(gFecha.value, gMetodoPagoId.value || undefined);
  } catch {
    // sin sugerencia: el usuario la escribe
  }
}
watch([gACuotas, gMetodoPagoId, gFecha], actualizarSugerenciaCuota);

const metodoSeleccionado = computed(() => metodos.value.find((m) => m.id === gMetodoPagoId.value));
const gUnaCuota = computed(() => Number(gNumeroCuotas.value) === 1);
watch(gUnaCuota, (una) => {
  if (llenando) return;
  if (una && gInteres.value === 'tarjeta') gInteres.value = 'sin';
  else if (!una && gInteres.value === 'sin' && metodoSeleccionado.value?.tasaMensual > 0) gInteres.value = 'tarjeta';
});
const conTarjeta = computed(() => metodoSeleccionado.value?.tipo === 'tarjeta_credito');
watch(conTarjeta, (si) => {
  if (!si && !llenando) gEnDolares.value = false;
});
watch([gEnDolares, gUsd, gTrm], () => {
  if (llenando || !gEnDolares.value) return;
  const usd = Number(String(gUsd.value).replace(',', '.'));
  const trm = Number(String(gTrm.value).replace(',', '.'));
  if (usd > 0 && trm > 0) gMonto.value = String(Math.round(usd * trm));
});
const dolaresGasto = () =>
  gEnDolares.value ? { montoUsd: aCentavos(gUsd.value), trm: Number(String(gTrm.value).replace(',', '.')) } : {};

const valorCuota = computed(() => {
  const n = Number(gNumeroCuotas.value);
  const total = Number(gMonto.value);
  return n >= 1 && total > 0 ? Math.floor(total / n) : null;
});

// Compra manual con cuotas pagadas a mano: solo se guardan descripción, categoría, cuenta y obligatoria.
const compraBloqueada = computed(() => {
  const c = editando.value?.tipo === 'compra' ? editando.value.registro : null;
  return Boolean(c && c.modoCobro === 'manual' && c.cuotas?.some((q) => q.estado === 'pagado'));
});

function limpiarGasto() {
  gMonto.value = '';
  gFecha.value = hoyISO();
  gDescripcion.value = '';
  gCategoriaId.value = '';
  gMetodoPagoId.value = '';
  gEsObligatorio.value = false;
  gEstado.value = 'pagado';
  gEnDolares.value = false;
  gUsd.value = '';
  gTrm.value = '';
  gACuotas.value = false;
  gNumeroCuotas.value = '3';
  gPrimeraCuota.value = '';
  gModoCobro.value = 'automatico';
  gEnCurso.value = false;
  gCuotasPagadas.value = '';
  gInteres.value = 'sin';
  gTasa.value = '';
  gSistema.value = 'capital_fijo';
}

function llenarDesdeGasto(gasto) {
  gMonto.value = String(gasto.monto);
  gFecha.value = String(gasto.fecha).slice(0, 10);
  gDescripcion.value = gasto.descripcion ?? '';
  gCategoriaId.value = gasto.categoriaId ?? '';
  gMetodoPagoId.value = gasto.metodoPagoId ?? '';
  gEsObligatorio.value = Boolean(gasto.esObligatorio);
  gEstado.value = gasto.estado ?? 'pagado';
  gEnDolares.value = Boolean(gasto.montoUsd);
  gUsd.value = gasto.montoUsd ? String(gasto.montoUsd / 100) : '';
  gTrm.value = gasto.trm ? String(gasto.trm) : '';
}

function llenarDesdeCompra(compra) {
  const metodo = metodos.value.find((m) => m.id === compra.metodoPagoId);
  gMonto.value = String(compra.montoTotal);
  gFecha.value = String(compra.creadoEn ?? compra.fechaPrimeraCuota).slice(0, 10);
  gDescripcion.value = compra.descripcion ?? '';
  gCategoriaId.value = compra.categoriaId ?? '';
  gMetodoPagoId.value = compra.metodoPagoId ?? '';
  gEsObligatorio.value = Boolean(compra.esObligatorio);
  gEnDolares.value = Boolean(compra.montoUsd);
  gUsd.value = compra.montoUsd ? String(compra.montoUsd / 100) : '';
  gTrm.value = compra.trm ? String(compra.trm) : '';
  gACuotas.value = true;
  gNumeroCuotas.value = String(compra.numeroCuotas);
  gPrimeraCuota.value = String(compra.fechaPrimeraCuota).slice(0, 10);
  gModoCobro.value = compra.modoCobro;
  gEnCurso.value = (compra.cuotasPagadasAntes ?? 0) > 0;
  gCuotasPagadas.value = compra.cuotasPagadasAntes ? String(compra.cuotasPagadasAntes) : '';
  const tasa = compra.tasaMensual ?? 0;
  gInteres.value = !tasa ? 'sin' : metodo?.tasaMensual === tasa ? 'tarjeta' : 'otra';
  gTasa.value = gInteres.value === 'otra' ? String(tasa) : '';
  gSistema.value = compra.sistemaInteres ?? 'capital_fijo';
}

// Interés de la compra. Al editar va siempre explícito (si no, se quedaría el de antes).
function interesCompra(explicito) {
  if (gInteres.value === 'tarjeta') {
    return explicito
      ? {
          tasaMensual: metodoSeleccionado.value?.tasaMensual ?? 0,
          sistemaInteres: metodoSeleccionado.value?.sistemaInteres ?? gSistema.value,
        }
      : {};
  }
  return { tasaMensual: gInteres.value === 'otra' ? Number(gTasa.value) || 0 : 0, sistemaInteres: gSistema.value };
}

// Al editar, quitar los dólares de algo que los tenía se manda explícito.
function dolaresEdicion(reg) {
  if (gEnDolares.value) return dolaresGasto();
  return reg?.montoUsd ? { montoUsd: null, trm: null } : {};
}

function payloadGasto(reg = null) {
  return {
    monto: Number(gMonto.value),
    fecha: gFecha.value,
    descripcion: gDescripcion.value.trim() || (reg ? null : undefined),
    categoriaId: gCategoriaId.value || (reg ? null : undefined),
    metodoPagoId: gMetodoPagoId.value || (reg ? null : undefined),
    esObligatorio: gEsObligatorio.value,
    estado: gEstado.value,
    ...(reg ? dolaresEdicion(reg) : dolaresGasto()),
  };
}

function payloadCompra(explicito, reg = null) {
  return {
    descripcion: gDescripcion.value.trim(),
    montoTotal: Number(gMonto.value),
    numeroCuotas: Number(gNumeroCuotas.value),
    fechaPrimeraCuota: gPrimeraCuota.value,
    modoCobro: gModoCobro.value,
    cuotasPagadasAntes: gEnCurso.value ? Number(gCuotasPagadas.value) || 0 : 0,
    ...interesCompra(explicito),
    metodoPagoId: gMetodoPagoId.value || null,
    categoriaId: gCategoriaId.value || null,
    esObligatorio: gEsObligatorio.value,
    ...(reg ? dolaresEdicion(reg) : dolaresGasto()),
  };
}

async function guardarGasto() {
  const ed = editando.value;
  if (!ed) {
    if (gACuotas.value) {
      const datos = payloadCompra(false);
      if (!datos.cuotasPagadasAntes) delete datos.cuotasPagadasAntes;
      if (!datos.metodoPagoId) delete datos.metodoPagoId;
      if (!datos.categoriaId) delete datos.categoriaId;
      await crearCompraPersonal(datos);
    } else {
      await crearGasto(payloadGasto());
    }
    return;
  }
  const { tipo, registro: reg } = ed;
  if (tipo === 'gasto') {
    if (gACuotas.value) {
      const datos = payloadCompra(false);
      if (datos.montoUsd === undefined) delete datos.montoUsd;
      await convertirGastoACompra(reg.id, datos);
    } else {
      await actualizarGasto(reg.id, payloadGasto(reg));
    }
  } else if (!gACuotas.value) {
    const datos = payloadGasto();
    if (datos.descripcion === undefined) delete datos.descripcion;
    await convertirCompraPersonalAGasto(reg.id, datos);
  } else if (compraBloqueada.value) {
    await actualizarCompraPersonal(reg.id, {
      descripcion: gDescripcion.value.trim(),
      categoriaId: gCategoriaId.value || null,
      metodoPagoId: gMetodoPagoId.value || null,
      esObligatorio: gEsObligatorio.value,
    });
  } else {
    await actualizarCompraPersonal(reg.id, payloadCompra(true, reg));
  }
}

// --- Ingreso ---
const iMonto = ref('');
const iFecha = ref(hoyISO());
const iDescripcion = ref('');
const iCategoriaId = ref('');
const iMetodoPagoId = ref('');
const iEstado = ref('recibido');

function limpiarIngreso() {
  iMonto.value = '';
  iFecha.value = hoyISO();
  iDescripcion.value = '';
  iCategoriaId.value = '';
  iMetodoPagoId.value = '';
  iEstado.value = 'recibido';
}

async function guardarIngreso() {
  await crearIngreso({
    monto: Number(iMonto.value),
    fecha: iFecha.value,
    descripcion: iDescripcion.value || undefined,
    categoriaId: iCategoriaId.value || undefined,
    metodoPagoId: iMetodoPagoId.value || undefined,
    estado: iEstado.value,
  });
}

// --- Abrir, guardar, cerrar ---
const guardando = ref(false);

watch(
  () => registro.abierto,
  async (abierto) => {
    if (!abierto) return;
    error.value = '';
    llenando = true;
    limpiarGasto();
    limpiarIngreso();
    try {
      await cargarCatalogos();
    } catch (e) {
      error.value = extractErrorMessage(e);
    }
    const ed = registro.edicion;
    if (ed?.tipo === 'gasto') llenarDesdeGasto(ed.registro);
    else if (ed?.tipo === 'compra') llenarDesdeCompra(ed.registro);
    await nextTick();
    llenando = false;
  },
);

async function guardar() {
  error.value = '';
  guardando.value = true;
  guardandoGasto.value = true;
  try {
    if (registro.tipo === 'gasto') await guardarGasto();
    else await guardarIngreso();
    avisarCambioPersonal();
    cerrarRegistro();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardando.value = false;
    guardandoGasto.value = false;
  }
}

const titulo = computed(() => {
  const ed = editando.value;
  if (ed) return `Editar ${ed.registro.descripcion || 'gasto'}`;
  return 'Registrar movimiento';
});
</script>

<template>
  <AppModal v-if="registro.abierto" :title="titulo" @close="cerrarRegistro">
    <div v-if="!editando" class="tabs w-full mb-5" role="tablist" aria-label="Tipo de movimiento">
      <button
        type="button"
        role="tab"
        class="tab flex-1"
        :class="{ 'tab-active': registro.tipo === 'gasto' }"
        :aria-selected="registro.tipo === 'gasto'"
        @click="registro.tipo = 'gasto'"
      >
        Gasto
      </button>
      <button
        type="button"
        role="tab"
        class="tab flex-1"
        :class="{ 'tab-active': registro.tipo === 'ingreso' }"
        :aria-selected="registro.tipo === 'ingreso'"
        @click="registro.tipo = 'ingreso'"
      >
        Ingreso
      </button>
    </div>

    <form v-if="registro.tipo === 'gasto'" class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="guardar">
      <p v-if="compraBloqueada" class="sm:col-span-2 rounded-lg bg-warning/10 px-3 py-2 text-[13px] font-medium text-warning">
        Ya marcaste cuotas de esta compra como pagadas: solo se guardan la descripción, la categoría, la cuenta y si es obligatoria.
      </p>
      <FormField
        v-model="gMonto"
        type="number"
        :label="gEnDolares ? 'Valor en pesos (COP)' : 'Monto (COP)'"
        required
        placeholder="30000"
        :hint="gEnDolares ? 'Sale de los dólares y la tasa; corrígelo si tu banco lo pasó distinto.' : ''"
      />
      <FormField v-model="gFecha" type="date" label="Fecha" required />
      <div class="sm:col-span-2">
        <FormField v-model="gDescripcion" :label="gACuotas ? 'Descripción' : 'Descripción (opcional)'" placeholder="Ej. Mercado, Netflix…" />
      </div>
      <div>
        <label class="label" for="g-categoria">Categoría (opcional)</label>
        <select id="g-categoria" v-model="gCategoriaId" class="field">
          <option value="">Sin definir</option>
          <option v-for="c in categoriasParaGasto" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="g-metodo">Método de pago (opcional)</label>
        <select id="g-metodo" v-model="gMetodoPagoId" class="field">
          <option value="">Sin definir</option>
          <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
        </select>
      </div>
      <template v-if="conTarjeta">
        <label class="sm:col-span-2 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
          <input v-model="gEnDolares" type="checkbox" class="checkbox" />
          Compra en dólares (va a la deuda en US$ de la tarjeta)
        </label>
        <CamposDolares
          v-if="gEnDolares"
          v-model:usd="gUsd"
          v-model:trm="gTrm"
          class="sm:col-span-2"
          :fecha="gFecha"
          :etiqueta-usd="gACuotas ? 'Valor total en dólares (US$)' : 'Valor en dólares (US$)'"
        />
      </template>
      <div v-if="!gACuotas">
        <label class="label" for="g-estado">Estado</label>
        <select id="g-estado" v-model="gEstado" class="field">
          <option value="pagado">Ya pagado</option>
          <option value="pendiente">Pendiente</option>
        </select>
      </div>
      <label
        class="flex items-center gap-2.5 self-end rounded-xl border border-border px-3.5 py-2.5 text-sm text-ink-secondary cursor-pointer hover:border-border-strong"
      >
        <input v-model="gEsObligatorio" type="checkbox" class="checkbox" />
        Es un gasto obligatorio
      </label>

      <label class="sm:col-span-2 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
        <input v-model="gACuotas" type="checkbox" class="checkbox" :disabled="compraBloqueada" />
        Es una compra a cuotas
      </label>
      <template v-if="gACuotas">
        <label class="sm:col-span-2 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
          <input v-model="gEnCurso" type="checkbox" class="checkbox" />
          La compra ya va en curso (ya pagué algunas cuotas)
        </label>
        <FormField
          v-model="gNumeroCuotas"
          type="number"
          :label="gEnCurso ? 'Total de cuotas de la compra' : 'Número de cuotas'"
          hint="1 si la pagas completa con el extracto de la tarjeta."
          required
        />
        <FormField
          v-if="gEnCurso"
          v-model="gCuotasPagadas"
          type="number"
          label="Cuotas que ya pagaste"
          required
          hint="No se registran: no bajan tu Disponible ni cuentan como gasto. La app crea solo las que faltan."
        />
        <FormField
          v-model="gPrimeraCuota"
          type="date"
          :label="gEnCurso ? 'Fecha de la próxima cuota' : 'Primera cuota'"
          required
          :hint="gEnCurso ? 'La de la próxima cuota que vas a pagar.' : 'Sugerida con el día de corte y pago de la tarjeta; puedes cambiarla.'"
        />
        <div>
          <label class="label" for="g-modo-cobro">Cómo se paga cada cuota</label>
          <select id="g-modo-cobro" v-model="gModoCobro" class="field">
            <option value="automatico">Automático (tarjeta o débito)</option>
            <option value="manual">Manual (la marco yo al pagar)</option>
          </select>
        </div>
        <p class="self-end pb-2.5 text-[13px] text-ink-secondary">
          <template v-if="valorCuota">≈ {{ formatCurrency(valorCuota) }} de capital por cuota</template>
        </p>
        <div class="sm:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="g-interes">Interés</label>
            <select id="g-interes" v-model="gInteres" class="field">
              <option v-if="metodoSeleccionado?.tasaMensual > 0 && !gUnaCuota" value="tarjeta">
                El de la tarjeta ({{ formatTasa(metodoSeleccionado.tasaMensual) }})
              </option>
              <option value="sin">Sin interés</option>
              <option value="otra">Otra tasa</option>
            </select>
            <p v-if="gUnaCuota && gInteres === 'sin'" class="mt-1 text-xs text-ink-tertiary">
              A 1 cuota la tarjeta no cobra interés: se paga completa con el extracto.
            </p>
          </div>
          <template v-if="gInteres === 'otra'">
            <FormField v-model="gTasa" type="number" step="0.01" label="Tasa mensual (%)" required />
            <div class="sm:col-span-2 sm:max-w-sm">
              <label class="label" for="g-sistema">Cómo se calcula</label>
              <select id="g-sistema" v-model="gSistema" class="field">
                <option value="capital_fijo">Capital fijo + interés sobre lo que falta (cuotas bajan)</option>
                <option value="cuota_fija">Cuota fija (todas iguales)</option>
              </select>
            </div>
          </template>
        </div>
        <p class="sm:col-span-2 text-[13px] text-ink-tertiary">
          El monto es el total de la compra. Se crean todas las cuotas; las automáticas se dan por pagadas en su fecha.
        </p>
      </template>

      <div v-if="error" class="sm:col-span-2"><AlertError :message="error" /></div>

      <p
        v-if="editando && gACuotas !== (editando.tipo === 'compra')"
        class="sm:col-span-2 text-[13px] font-medium text-warning"
      >
        {{ gACuotas ? 'Este gasto pasa a ser una compra a cuotas.' : 'Esta compra pasa a ser un gasto de un solo pago.' }}
      </p>
      <div class="sm:col-span-2 flex justify-end gap-2 pt-1">
        <button type="button" class="btn-ghost" @click="cerrarRegistro">Cancelar</button>
        <button
          type="submit"
          class="btn-primary"
          :disabled="
            guardandoGasto ||
            (gEnDolares && (!aCentavos(gUsd) || !(Number(gTrm) > 0))) ||
            (gACuotas &&
              (!gDescripcion.trim() ||
                Number(gNumeroCuotas) < 1 ||
                (gEnCurso && !(Number(gCuotasPagadas) >= 1 && Number(gCuotasPagadas) < Number(gNumeroCuotas)))))
          "
        >
          {{ guardandoGasto ? 'Guardando…' : editando ? 'Guardar cambios' : gACuotas ? 'Agregar compra' : 'Agregar gasto' }}
        </button>
      </div>
    </form>

    <form v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="guardar">
      <FormField v-model="iMonto" type="number" label="Monto (COP)" required placeholder="3000000" />
      <FormField v-model="iFecha" type="date" label="Fecha" required />
      <div class="sm:col-span-2">
        <FormField v-model="iDescripcion" label="Descripción (opcional)" placeholder="Ej. Salario, freelance…" />
      </div>
      <div>
        <label class="label" for="i-categoria">Categoría (opcional)</label>
        <select id="i-categoria" v-model="iCategoriaId" class="field">
          <option value="">Sin definir</option>
          <option v-for="c in categoriasParaIngreso" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="i-metodo">Dónde entró (opcional)</label>
        <select id="i-metodo" v-model="iMetodoPagoId" class="field">
          <option value="">Sin definir</option>
          <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
        </select>
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="i-estado">Estado</label>
        <select id="i-estado" v-model="iEstado" class="field">
          <option value="recibido">Ya recibido</option>
          <option value="pendiente">Pendiente</option>
        </select>
      </div>

      <div v-if="error" class="sm:col-span-2"><AlertError :message="error" /></div>

      <div class="sm:col-span-2 flex justify-end gap-2 pt-1">
        <button type="button" class="btn-ghost" @click="cerrarRegistro">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="guardando">
          {{ guardando ? 'Guardando…' : 'Agregar ingreso' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>
