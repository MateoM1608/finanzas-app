<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  listarGastosVariables,
  crearGastoVariable,
  actualizarGastoVariable,
  eliminarGastoVariable,
  pagarCuotaVariable,
  deshacerPagoCuotaVariable,
  convertirGastoHogarACompra,
} from '../../api/gastosVariables.js';
import {
  listarComprasHogar,
  crearCompraHogar,
  actualizarCompraHogar,
  eliminarCompraHogar,
  sugerirPrimeraCuota,
  convertirCompraHogarAGasto,
} from '../../api/comprasCuotas.js';
import RepartoMiembros from './RepartoMiembros.vue';
import { listarMetodosPago } from '../../api/metodosPagoPersonales.js';
import { useAuthStore } from '../../stores/auth.js';
import { confirmar } from '../../composables/useConfirm.js';
import { listarMiembros } from '../../api/hogares.js';
import { listarCategoriasHogar } from '../../api/categoriasHogar.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency, formatDate, formatReparto, hoyISO, modoCobroSugerido, formatTasa } from '../../utils/format.js';
import FormField from '../FormField.vue';
import AlertError from '../AlertError.vue';
import AppModal from '../AppModal.vue';
import AppIcon from '../AppIcon.vue';
import { useAncla } from '../../composables/useAncla.js';

const emit = defineEmits(['cambio']);

const gastos = ref([]);
const miembros = ref([]);
const loading = ref(true);
const error = ref('');
const eliminandoId = ref(null);
const mostrarForm = ref(false);

const item = ref('');
const valorTotal = ref('');
const pagoUsuarioId = ref('');
const fecha = ref(hoyISO());
const creando = ref(false);

const personalizarReparto = ref(false);
// { montos: [{ usuarioId, monto }], valido, cambiado } — de RepartoMiembros (en % o en pesos).
const repartoManual = ref({ montos: [], valido: false });

const auth = useAuthStore();
// Crear, editar y borrar gastos del hogar pide permiso; sin él, solo se ve.
const puedeEditar = computed(() => Boolean(auth.usuario?.esAdmin || auth.usuario?.puedeEditarGastos));
const LIMITE_LISTA = 8;
const verTodo = ref(false);
// Las cuotas futuras de una compra no se listan hasta su fecha (se ven en
// "Compras a cuotas" y en Cuadres → Próximos).
const gastosALaFecha = computed(() => {
  const hoy = hoyISO();
  return gastos.value.filter((g) => !g.compraId || g.fecha.slice(0, 10) <= hoy);
});
const visibles = computed(() =>
  verTodo.value ? gastosALaFecha.value : gastosALaFecha.value.slice(0, LIMITE_LISTA),
);

// --- Compras a cuotas ---
const compras = ref([]);
const misMetodos = ref([]);
const aCuotas = ref(false);
const numeroCuotas = ref('3');
const primeraCuota = ref('');
const modoCobro = ref('automatico');
// Compra que ya venía en curso: cuántas cuotas se pagaron antes de registrarla.
const enCurso = ref(false);
const cuotasPagadasAntes = ref('');
const hInteres = ref('sin');
const hTasa = ref('');
const hSistema = ref('capital_fijo');
const metodoPagoId = ref('');
// Categorías del hogar (E4): opcional al registrar, se cambia en cualquier momento.
const categorias = ref([]);
const categoriaId = ref('');
const categoriasPara = (gasto) => categorias.value.filter((c) => c.activo || c.id === gasto.categoriaId);
// En el formulario: las activas más la que ya tenía lo que se edita.
const categoriasForm = computed(() => categorias.value.filter((c) => c.activo || c.id === categoriaId.value));
const cambiandoCategoriaId = ref(null);
const eliminandoCompraId = ref(null);
const pagandoId = ref(null);

async function onCambiarCategoria(gasto, valor) {
  error.value = '';
  cambiandoCategoriaId.value = gasto.id;
  try {
    const actualizado = await actualizarGastoVariable(gasto.id, { categoriaId: valor || null });
    const idx = gastos.value.findIndex((g) => g.id === gasto.id);
    gastos.value[idx] = actualizado;
    emit('cambio');
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    cambiandoCategoriaId.value = null;
  }
}

// Solo quien paga puede asociar uno de SUS métodos de pago (privados).
const pagaYo = computed(() => pagoUsuarioId.value && pagoUsuarioId.value === auth.usuario?.id);

async function actualizarSugerencia() {
  if (llenando || !aCuotas.value || !fecha.value) return;
  const metodo = pagaYo.value ? misMetodos.value.find((m) => m.id === metodoPagoId.value) : null;
  modoCobro.value = modoCobroSugerido(metodo);
  hInteres.value = metodo?.tasaMensual > 0 && Number(numeroCuotas.value) !== 1 ? 'tarjeta' : 'sin';
  try {
    primeraCuota.value = await sugerirPrimeraCuota(fecha.value, pagaYo.value ? metodoPagoId.value || undefined : undefined);
  } catch {
    // sin sugerencia
  }
}
watch([aCuotas, metodoPagoId, fecha, pagoUsuarioId], actualizarSugerencia);

// La tasa de la tarjeta solo se conoce si quien paga es el usuario actual (sus métodos).
const metodoCompraHogar = computed(() => (pagaYo.value ? misMetodos.value.find((m) => m.id === metodoPagoId.value) : null));
// A 1 cuota la tarjeta no cobra interés: se paga entera con el extracto.
const unaCuota = computed(() => Number(numeroCuotas.value) === 1);
watch(unaCuota, (una) => {
  if (llenando) return;
  if (una && hInteres.value === 'tarjeta') hInteres.value = 'sin';
  else if (!una && hInteres.value === 'sin' && metodoCompraHogar.value?.tasaMensual > 0) hInteres.value = 'tarjeta';
});

const valorCuota = computed(() => {
  const n = Number(numeroCuotas.value);
  return n >= 1 && Number(valorTotal.value) > 0 ? Math.floor(Number(valorTotal.value) / n) : null;
});

const comprasActivas = computed(() => compras.value.filter((c) => c.cuotas.some((q) => q.estado !== 'cuadrado')));

// Incluye las que se pagaron antes de registrar la compra (en curso).
function cuotasCuadradas(compra) {
  return (compra.cuotasPagadasAntes ?? 0) + compra.cuotas.filter((q) => q.estado === 'cuadrado').length;
}

async function cargarCompras() {
  compras.value = await listarComprasHogar();
}

async function onEliminarCompra(compra) {
  const ok = await confirmar(`¿Eliminar la compra "${compra.item}" con sus ${compra.numeroCuotas} cuotas?`, {
    textoAceptar: 'Eliminar',
    peligroso: true,
  });
  if (!ok) return;
  error.value = '';
  eliminandoCompraId.value = compra.id;
  try {
    await eliminarCompraHogar(compra.id);
    await Promise.all([cargarCompras(), recargarGastos()]);
    emit('cambio');
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoCompraId.value = null;
  }
}

async function onPagarCuota(gasto) {
  error.value = '';
  pagandoId.value = gasto.id;
  try {
    const actualizado = await pagarCuotaVariable(gasto.id, { fechaPago: hoyISO() });
    const idx = gastos.value.findIndex((g) => g.id === gasto.id);
    gastos.value[idx] = actualizado;
    await cargarCompras();
    emit('cambio');
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    pagandoId.value = null;
  }
}

async function onDeshacerPagoCuota(gasto) {
  const ok = await confirmar(
    `¿Deshacer el pago de "${gasto.item}" de ${formatCurrency(gasto.valorTotal)}? Vuelve a quedar por pagar y sale del saldo del hogar.`,
    { textoAceptar: 'Deshacer pago', peligroso: false },
  );
  if (!ok) return;
  error.value = '';
  pagandoId.value = gasto.id;
  try {
    const actualizado = await deshacerPagoCuotaVariable(gasto.id);
    const idx = gastos.value.findIndex((g) => g.id === gasto.id);
    gastos.value[idx] = actualizado;
    await cargarCompras();
    emit('cambio');
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    pagandoId.value = null;
  }
}

async function recargarGastos() {
  gastos.value = ordenar(await listarGastosVariables());
}

function ordenar(lista) {
  return [...lista].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

// Solo presentación: insignia por estado del gasto.
const ESTADO_INFO = {
  por_pagar: { label: 'Por pagar', clase: 'badge-negative' },
  pagado: { label: 'Sin cuadrar', clase: 'badge-warning' },
  en_cuadre: { label: 'En cuadre', clase: 'badge-accent' },
  cuadrado: { label: 'Cuadrado', clase: 'badge-positive' },
};

function estadoInfo(gasto) {
  return ESTADO_INFO[gasto.estado] ?? null;
}

function esEditable(gasto) {
  return puedeEditar.value && gasto.estado === 'pagado' && !gasto.compraId;
}

const repartoManualValido = computed(() => repartoManual.value.valido);

async function cargar() {
  loading.value = true;
  try {
    const [listaGastos, listaMiembros, listaCompras, metodos, listaCategorias] = await Promise.all([
      listarGastosVariables(),
      listarMiembros(),
      listarComprasHogar(),
      listarMetodosPago(),
      listarCategoriasHogar().catch(() => []),
    ]);
    categorias.value = listaCategorias;
    gastos.value = ordenar(listaGastos);
    miembros.value = listaMiembros;
    compras.value = listaCompras;
    misMetodos.value = metodos;
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

// --- Agregar y editar: el mismo formulario ---
// editando = { tipo: 'gasto' | 'compra', registro } o null (agregando).
const editando = ref(null);
// Mientras se llena el formulario para editar, las sugerencias (primera
// cuota, modo, interés) no pisan lo que ya tiene.
let llenando = false;
const formKey = ref(0);
// Reparto con que se abre la edición: { montos: { usuarioId: monto }, total }.
const repartoInicial = ref(null);
// Compra con cuotas cuadradas o pagadas a mano: solo se guardan nombre, categoría y cuenta.
const compraBloqueada = computed(() => {
  const c = editando.value?.tipo === 'compra' ? editando.value.registro : null;
  return Boolean(
    c?.cuotas.some((q) => q.estado === 'cuadrado' || (c.modoCobro === 'manual' && ['pagado', 'en_cuadre'].includes(q.estado))),
  );
});

function limpiarFormulario() {
  item.value = '';
  valorTotal.value = '';
  pagoUsuarioId.value = '';
  fecha.value = hoyISO();
  categoriaId.value = '';
  metodoPagoId.value = '';
  aCuotas.value = false;
  numeroCuotas.value = '3';
  primeraCuota.value = '';
  modoCobro.value = 'automatico';
  enCurso.value = false;
  cuotasPagadasAntes.value = '';
  hInteres.value = 'sin';
  hTasa.value = '';
  hSistema.value = 'capital_fijo';
  personalizarReparto.value = false;
  repartoInicial.value = null;
}

async function llenar(fn) {
  llenando = true;
  fn();
  formKey.value += 1;
  await nextTick();
  llenando = false;
}

async function abrirNuevo() {
  error.value = '';
  editando.value = null;
  await llenar(limpiarFormulario);
  mostrarForm.value = true;
}

async function abrirEdicion(gasto) {
  error.value = '';
  editando.value = { tipo: 'gasto', registro: gasto };
  await llenar(() => {
    limpiarFormulario();
    item.value = gasto.item;
    valorTotal.value = String(gasto.valorTotal);
    pagoUsuarioId.value = gasto.pagoUsuarioId;
    fecha.value = gasto.fecha.slice(0, 10);
    categoriaId.value = gasto.categoriaId ?? '';
    metodoPagoId.value = gasto.metodoPagoId ?? '';
    personalizarReparto.value = true;
    repartoInicial.value = {
      montos: Object.fromEntries(gasto.repartos.map((x) => [x.usuarioId, x.monto])),
      total: gasto.valorTotal,
    };
  });
  mostrarForm.value = true;
}

async function abrirEdicionCompra(compra) {
  error.value = '';
  editando.value = { tipo: 'compra', registro: compra };
  const metodo = misMetodos.value.find((m) => m.id === compra.metodoPagoId);
  const primera = compra.cuotas?.[0];
  await llenar(() => {
    limpiarFormulario();
    item.value = compra.item;
    valorTotal.value = String(compra.montoTotal);
    pagoUsuarioId.value = compra.pagoUsuarioId;
    fecha.value = (compra.fechaCompra ?? compra.fechaPrimeraCuota).slice(0, 10);
    categoriaId.value = compra.categoriaId ?? '';
    metodoPagoId.value = compra.metodoPagoId ?? '';
    aCuotas.value = true;
    numeroCuotas.value = String(compra.numeroCuotas);
    primeraCuota.value = compra.fechaPrimeraCuota.slice(0, 10);
    modoCobro.value = compra.modoCobro;
    enCurso.value = (compra.cuotasPagadasAntes ?? 0) > 0;
    cuotasPagadasAntes.value = compra.cuotasPagadasAntes ? String(compra.cuotasPagadasAntes) : '';
    const tasa = compra.tasaMensual ?? 0;
    hInteres.value = !tasa ? 'sin' : metodo?.tasaMensual === tasa ? 'tarjeta' : 'otra';
    hTasa.value = hInteres.value === 'otra' ? String(tasa) : '';
    hSistema.value = compra.sistemaInteres ?? 'capital_fijo';
    personalizarReparto.value = Boolean(primera?.repartos?.length);
    repartoInicial.value = primera?.repartos?.length
      ? { montos: Object.fromEntries(primera.repartos.map((x) => [x.usuarioId, x.monto])), total: primera.valorTotal }
      : null;
  });
  mostrarForm.value = true;
}

// Desde la fila de una cuota: abre la edición de su compra.
function editarCompraDe(gasto) {
  const compra = compras.value.find((c) => c.id === gasto.compraId);
  if (compra) abrirEdicionCompra(compra);
}

function cerrarFormulario() {
  mostrarForm.value = false;
  editando.value = null;
}

// Interés de la compra. Al editar va siempre explícito (si no, se quedaría el de antes).
function interesCompra(explicito) {
  if (hInteres.value === 'tarjeta') {
    return explicito
      ? {
          tasaMensual: metodoCompraHogar.value?.tasaMensual ?? 0,
          sistemaInteres: metodoCompraHogar.value?.sistemaInteres ?? hSistema.value,
        }
      : {};
  }
  return { tasaMensual: hInteres.value === 'otra' ? Number(hTasa.value) || 0 : 0, sistemaInteres: hSistema.value };
}

function payloadGasto() {
  return {
    item: item.value.trim(),
    valorTotal: Number(valorTotal.value),
    pagoUsuarioId: pagoUsuarioId.value,
    fecha: fecha.value,
    categoriaId: categoriaId.value || null,
    metodoPagoId: pagaYo.value ? metodoPagoId.value || null : null,
    ...(personalizarReparto.value ? { repartos: repartoManual.value.montos } : {}),
  };
}

function payloadCompra(explicito) {
  return {
    item: item.value.trim(),
    montoTotal: Number(valorTotal.value),
    numeroCuotas: Number(numeroCuotas.value),
    fechaCompra: fecha.value,
    fechaPrimeraCuota: primeraCuota.value,
    modoCobro: modoCobro.value,
    cuotasPagadasAntes: enCurso.value ? Number(cuotasPagadasAntes.value) || 0 : 0,
    ...interesCompra(explicito),
    pagoUsuarioId: pagoUsuarioId.value,
    metodoPagoId: pagaYo.value ? metodoPagoId.value || null : null,
    categoriaId: categoriaId.value || null,
    ...(personalizarReparto.value ? { repartos: repartoManual.value.montos } : {}),
  };
}

async function guardarEdicion() {
  const { tipo, registro } = editando.value;
  if (tipo === 'gasto') {
    if (aCuotas.value) {
      await convertirGastoHogarACompra(registro.id, payloadCompra(false));
    } else {
      const datos = payloadGasto();
      // El reparto solo se manda si cambió o si cambió el valor (en % se reescala).
      if (datos.repartos && !repartoManual.value.cambiado && datos.valorTotal === registro.valorTotal) delete datos.repartos;
      await actualizarGastoVariable(registro.id, datos);
    }
  } else if (!aCuotas.value) {
    await convertirCompraHogarAGasto(registro.id, payloadGasto());
  } else if (compraBloqueada.value) {
    await actualizarCompraHogar(registro.id, {
      item: item.value.trim(),
      categoriaId: categoriaId.value || null,
      ...(pagaYo.value ? { metodoPagoId: metodoPagoId.value || null } : {}),
    });
  } else {
    const datos = payloadCompra(true);
    // Un reparto igual al de antes no recalcula las cuotas.
    if (datos.repartos && !repartoManual.value.cambiado) delete datos.repartos;
    await actualizarCompraHogar(registro.id, datos);
  }
}

async function onGuardar() {
  error.value = '';
  creando.value = true;
  try {
    if (editando.value) {
      await guardarEdicion();
    } else if (aCuotas.value) {
      await crearCompraHogar(payloadCompra(false));
    } else {
      await crearGastoVariable(payloadGasto());
    }
    await Promise.all([cargarCompras(), recargarGastos()]);
    await llenar(limpiarFormulario);
    cerrarFormulario();
    emit('cambio');
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    creando.value = false;
  }
}

async function onEliminar(gasto) {
  if (!(await confirmar(`¿Eliminar "${gasto.item}" de ${formatCurrency(gasto.valorTotal)}? Cambia el saldo del hogar y no se puede deshacer.`))) return;
  error.value = '';
  eliminandoId.value = gasto.id;
  try {
    await eliminarGastoVariable(gasto.id);
    gastos.value = gastos.value.filter((g) => g.id !== gasto.id);
    emit('cambio');
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    eliminandoId.value = null;
  }
}

onMounted(cargar);

// "Ir" desde "Para pagar" o una notificación: /hogar#gasto-hogar-<id>. Una
// cuota futura no está en la lista: se resalta su compra.
useAncla(
  (hash) => {
    const m = /^#gasto-hogar-(.+)$/.exec(hash);
    if (!m) return null;
    const gasto = gastos.value.find((g) => g.id === m[1]);
    if (!gasto) return null;
    const i = gastosALaFecha.value.findIndex((g) => g.id === gasto.id);
    if (i === -1) return gasto.compraId ? `compra-hogar-${gasto.compraId}` : null;
    if (i >= LIMITE_LISTA) verTodo.value = true;
    return `gasto-hogar-${gasto.id}`;
  },
  () => !loading.value,
);

// Botón "+" de la barra del celular: /hogar?registrar=variable abre el formulario.
const rutaHogar = useRoute();
const routerHogar = useRouter();
watch(
  () => rutaHogar.query.registrar,
  (tipo) => {
    if (tipo !== 'variable') return;
    if (puedeEditar.value) abrirNuevo();
    routerHogar.replace({ query: { ...rutaHogar.query, registrar: undefined } });
  },
  { immediate: true },
);
</script>

<template>
  <section class="card card-pad" aria-labelledby="gastos-variables-titulo">
    <div class="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div class="min-w-0">
        <h3 id="gastos-variables-titulo" class="section-title">Gastos variables</h3>
        <p class="section-hint">Mercado, compras y gastos puntuales. Ya están pagados, así que entran al saldo de una vez.</p>
      </div>
      <button v-if="puedeEditar" class="btn-primary" @click="abrirNuevo">
        <AppIcon name="plus" class="h-4 w-4" />
        Agregar gasto variable
      </button>
    </div>

    <AlertError v-if="!mostrarForm" :message="error" class="mb-4" />

    <AppModal
      v-if="mostrarForm"
      :title="editando ? `Editar ${editando.registro.item}` : 'Agregar gasto variable'"
      @close="cerrarFormulario"
    >
      <form :key="formKey" class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onGuardar">
        <AlertError :message="error" class="sm:col-span-2" />
        <p v-if="compraBloqueada" class="sm:col-span-2 rounded-lg bg-warning/10 px-3 py-2 text-[13px] font-medium text-warning">
          Esta compra ya tiene cuotas cuadradas o pagadas a mano: solo se guardan el nombre, la categoría y la cuenta.
        </p>
        <FormField v-model="item" label="Item" required placeholder="Mercado, cafetera…" />
        <FormField v-model="valorTotal" type="number" label="Valor total (COP)" required />
        <div>
          <label class="label" for="gasto-variable-pagador">Quién pagó</label>
          <select id="gasto-variable-pagador" v-model="pagoUsuarioId" class="field" required>
            <option value="" disabled>Selecciona</option>
            <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
        </div>
        <FormField v-model="fecha" type="date" label="Fecha del gasto" required />
        <div v-if="categoriasForm.length">
          <label class="label" for="gasto-hogar-categoria">Categoría</label>
          <select id="gasto-hogar-categoria" v-model="categoriaId" class="field">
            <option value="">Sin categoría</option>
            <option v-for="c in categoriasForm" :key="c.id" :value="c.id">{{ c.nombre }}</option>
          </select>
        </div>

        <div v-if="pagaYo">
          <label class="label" for="gasto-hogar-metodo">Con qué lo pagaste (solo lo ves tú)</label>
          <select id="gasto-hogar-metodo" v-model="metodoPagoId" class="field">
            <option value="">Sin definir</option>
            <option v-for="m in misMetodos" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
        </div>

        <div class="sm:col-span-2">
          <label class="inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
            <input v-model="aCuotas" type="checkbox" class="checkbox" :disabled="compraBloqueada" />
            Es una compra a cuotas
          </label>
        </div>
        <template v-if="aCuotas">
          <label class="sm:col-span-2 inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
            <input v-model="enCurso" type="checkbox" class="checkbox" />
            La compra ya va en curso (ya se pagaron algunas cuotas)
          </label>
          <FormField
            v-model="numeroCuotas"
            type="number"
            :label="enCurso ? 'Total de cuotas de la compra' : 'Número de cuotas'"
            hint="1 si la pagas completa con el extracto de la tarjeta."
            required
          />
          <FormField
            v-if="enCurso"
            v-model="cuotasPagadasAntes"
            type="number"
            label="Cuotas ya pagadas"
            required
            hint="No entran al saldo ni a los cuadres. La app crea solo las que faltan."
          />
          <FormField
            v-model="primeraCuota"
            type="date"
            :label="enCurso ? 'Fecha de la próxima cuota' : 'Primera cuota'"
            required
          />
          <div>
            <label class="label" for="compra-hogar-modo">Cómo se paga cada cuota</label>
            <select id="compra-hogar-modo" v-model="modoCobro" class="field">
              <option value="automatico">Automático (tarjeta: entra sola en su fecha)</option>
              <option value="manual">Manual (crédito de almacén: se marca al pagar)</option>
            </select>
          </div>
          <div class="sm:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="label" for="compra-hogar-interes">Interés</label>
              <select id="compra-hogar-interes" v-model="hInteres" class="field">
                <option v-if="metodoCompraHogar?.tasaMensual > 0 && !unaCuota" value="tarjeta">
                  El de la tarjeta ({{ formatTasa(metodoCompraHogar.tasaMensual) }})
                </option>
                <option value="sin">Sin interés</option>
                <option value="otra">Otra tasa</option>
              </select>
              <p v-if="unaCuota && hInteres === 'sin'" class="mt-1 text-xs text-ink-tertiary">
                A 1 cuota la tarjeta no cobra interés: se paga completa con el extracto.
              </p>
            </div>
            <template v-if="hInteres === 'otra'">
              <FormField v-model="hTasa" type="number" step="0.01" label="Tasa mensual (%)" required />
              <div class="sm:col-span-2 sm:max-w-sm">
                <label class="label" for="compra-hogar-sistema">Cómo se calcula</label>
                <select id="compra-hogar-sistema" v-model="hSistema" class="field">
                  <option value="capital_fijo">Capital fijo + interés sobre lo que falta (cuotas bajan)</option>
                  <option value="cuota_fija">Cuota fija (todas iguales)</option>
                </select>
              </div>
            </template>
          </div>
          <p class="sm:col-span-2 text-[13px] text-ink-tertiary">
            <template v-if="valorCuota">≈ {{ formatCurrency(valorCuota) }} de capital por cuota. </template>
            El valor total es el de la compra y la fecha es el día en que compraron; el reparto acordado ese día se
            aplica a todas las cuotas.
          </p>
        </template>

        <div class="sm:col-span-2">
          <label class="inline-flex items-center gap-2.5 text-sm text-ink-secondary cursor-pointer">
            <input v-model="personalizarReparto" type="checkbox" class="checkbox" />
            Personalizar el reparto de este gasto
          </label>
        </div>

        <RepartoMiembros
          v-if="personalizarReparto"
          v-model="repartoManual"
          class="sm:col-span-2"
          :miembros="miembros"
          :total="Number(valorTotal) || 0"
          :inicial="repartoInicial?.montos ?? null"
          :inicial-total="repartoInicial?.total ?? null"
          id-prefijo="reparto-form"
        />

        <div class="sm:col-span-2 pt-1">
          <p v-if="!personalizarReparto" class="text-[13px] text-ink-tertiary mb-3">
            El reparto se calcula automáticamente según el reparto de Configuración del hogar.
          </p>
          <p v-if="editando && aCuotas !== (editando.tipo === 'compra')" class="text-[13px] font-medium text-warning mb-3">
            {{ aCuotas ? 'Este gasto pasa a ser una compra a cuotas.' : 'Esta compra pasa a ser un gasto de un solo pago.' }}
          </p>
          <div class="flex flex-wrap justify-end gap-2">
            <button v-if="editando" type="button" class="btn-ghost" @click="cerrarFormulario">Cancelar</button>
            <button
              type="submit"
              class="btn-primary w-full sm:w-auto"
              :disabled="creando || (personalizarReparto && !compraBloqueada && !repartoManualValido)"
            >
              <template v-if="creando">Guardando…</template>
              <template v-else-if="editando">Guardar cambios</template>
              <template v-else>{{ aCuotas ? 'Agregar compra' : 'Agregar gasto' }}</template>
            </button>
          </div>
        </div>
      </form>
    </AppModal>

    <p v-if="loading" class="text-sm text-ink-tertiary">Cargando…</p>
    <div v-else-if="!gastosALaFecha.length" class="empty flex flex-col items-center gap-2">
      <AppIcon name="receipt" class="h-6 w-6" />
      Aún no hay gastos variables registrados.
    </div>

    <ul v-else class="list">
      <li v-for="gasto in visibles" :id="`gasto-hogar-${gasto.id}`" :key="gasto.id" class="py-3.5">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0" :class="{ 'opacity-60': !esEditable(gasto) }">
            <p class="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-primary">
              <span class="break-words">{{ gasto.item }}</span>
              <span v-if="estadoInfo(gasto)" :class="estadoInfo(gasto).clase">
                {{ estadoInfo(gasto).label }}
              </span>
              <span v-if="gasto.compra" class="badge-neutral">Cuota {{ gasto.numeroCuota }}/{{ gasto.compra.numeroCuotas }}</span>
            </p>
            <p class="text-[13px] text-ink-tertiary mt-1">
              {{ formatDate(gasto.fecha) }} · Pagó {{ gasto.pagador.nombre }}<template v-if="gasto.metodoPago"> con {{ gasto.metodoPago.nombre }}</template>
            </p>
            <template v-if="categorias.length">
              <label :for="`categoria-${gasto.id}`" class="sr-only">Categoría de {{ gasto.item }}</label>
              <select
                v-if="puedeEditar && !gasto.compraId"
                :id="`categoria-${gasto.id}`"
                class="field mt-1.5 !w-auto !py-0.5 !pl-2.5 !pr-7 !text-xs !rounded-full"
                :value="gasto.categoriaId ?? ''"
                :disabled="cambiandoCategoriaId === gasto.id"
                @change="onCambiarCategoria(gasto, $event.target.value)"
              >
                <option value="">Sin categoría</option>
                <option v-for="c in categoriasPara(gasto)" :key="c.id" :value="c.id">{{ c.nombre }}</option>
              </select>
              <span v-else-if="gasto.categoria" class="badge-neutral mt-1.5">{{ gasto.categoria.nombre }}</span>
            </template>
          </div>
          <span
            class="shrink-0 text-right text-sm font-medium text-ink-primary"
            :class="{ 'opacity-60': !esEditable(gasto) }"
          >
            {{ formatCurrency(gasto.valorTotal) }}
          </span>
        </div>

        <div v-if="gasto.compraId" class="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p class="min-w-0 text-[13px] text-ink-tertiary">Reparto: {{ formatReparto(gasto.repartos) }}</p>
          <div class="ml-auto flex items-center gap-1.5">
          <button
            v-if="puedeEditar && gasto.estado !== 'cuadrado' && compras.some((c) => c.id === gasto.compraId)"
            type="button"
            class="btn-ghost btn-sm"
            :aria-label="`Editar la compra ${gasto.item}`"
            @click="editarCompraDe(gasto)"
          >
            <AppIcon name="edit" class="h-3.5 w-3.5" />
            Editar compra
          </button>
          <button
            v-if="puedeEditar && gasto.estado === 'por_pagar'"
            type="button"
            class="btn-secondary btn-sm"
            :disabled="pagandoId === gasto.id"
            @click="onPagarCuota(gasto)"
          >
            <AppIcon name="check" class="h-3.5 w-3.5" />
            Lo pagué
          </button>
          <button
            v-else-if="puedeEditar && gasto.estado === 'pagado' && gasto.compra?.modoCobro === 'manual'"
            type="button"
            class="btn-ghost btn-sm"
            :disabled="pagandoId === gasto.id"
            @click="onDeshacerPagoCuota(gasto)"
          >
            Deshacer
          </button>
          </div>
        </div>
        <div v-else class="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p class="min-w-0 text-[13px] text-ink-tertiary" :class="{ 'opacity-60': !esEditable(gasto) }">
            Reparto: {{ formatReparto(gasto.repartos) }}
          </p>
          <div v-if="esEditable(gasto)" class="flex items-center gap-1.5 ml-auto">
            <button class="btn-ghost btn-sm" :aria-label="`Editar ${gasto.item}`" @click="abrirEdicion(gasto)">
              <AppIcon name="edit" class="h-3.5 w-3.5" />
              Editar
            </button>
            <button
              class="btn-icon !p-1.5 hover:!text-negative hover:!bg-negative/10"
              :aria-label="`Eliminar ${gasto.item}`"
              title="Eliminar"
              :disabled="eliminandoId === gasto.id"
              @click="onEliminar(gasto)"
            >
              <AppIcon name="trash" class="h-4 w-4" />
            </button>
          </div>
        </div>
      </li>
    </ul>
    <div v-if="gastosALaFecha.length > LIMITE_LISTA" class="mt-2 flex justify-center">
      <button type="button" class="btn-ghost btn-sm" @click="verTodo = !verTodo">
        {{ verTodo ? 'Ver menos' : `Ver los ${gastosALaFecha.length}` }}
      </button>
    </div>

    <div v-if="comprasActivas.length" class="mt-5 border-t border-border pt-4">
      <p class="mb-1 text-[13px] font-medium text-ink-secondary">Compras a cuotas</p>
      <ul class="list">
        <li v-for="compra in comprasActivas" :id="`compra-hogar-${compra.id}`" :key="compra.id" class="list-row !py-3 group">
          <div class="min-w-0">
            <p class="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink-primary">
              <span class="truncate">{{ compra.item }}</span>
              <span class="badge-neutral">{{ cuotasCuadradas(compra) }}/{{ compra.numeroCuotas }} cuadradas</span>
            </p>
            <p class="truncate text-[13px] text-ink-tertiary">
              {{ formatCurrency(compra.montoTotal) }} · paga {{ compra.pagador.nombre }} ·
              {{ compra.modoCobro === 'automatico' ? 'automático' : 'manual' }}
              <template v-if="compra.metodoPago"> · {{ compra.metodoPago.nombre }}</template>
            </p>
          </div>
          <div v-if="puedeEditar" class="flex shrink-0 items-center gap-1">
          <button
            type="button"
            class="btn-icon !p-1.5"
            :aria-label="`Editar ${compra.item}`"
            title="Editar compra"
            @click="abrirEdicionCompra(compra)"
          >
            <AppIcon name="edit" class="h-4 w-4" />
          </button>
          <button
            v-if="!compra.cuotas.some((q) => q.estado === 'cuadrado')"
            type="button"
            class="btn-icon !p-1.5 hover:!text-negative"
            :disabled="eliminandoCompraId === compra.id"
            :aria-label="`Eliminar ${compra.item}`"
            title="Eliminar compra"
            @click="onEliminarCompra(compra)"
          >
            <AppIcon name="trash" class="h-4 w-4" />
          </button>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
