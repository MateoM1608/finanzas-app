<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  listarGastosVariables,
  crearGastoVariable,
  actualizarGastoVariable,
  eliminarGastoVariable,
  pagarCuotaVariable,
  deshacerPagoCuotaVariable,
} from '../../api/gastosVariables.js';
import {
  listarComprasHogar,
  crearCompraHogar,
  actualizarCompraHogar,
  eliminarCompraHogar,
  sugerirPrimeraCuota,
} from '../../api/comprasCuotas.js';
import CompraCuotasForm from '../CompraCuotasForm.vue';
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
const repartoManual = reactive({}); // usuarioId -> string

const editandoRepartoId = ref(null);
const repartoEdicion = reactive({}); // usuarioId -> string
const guardandoRepartoId = ref(null);

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
const categoriasActivas = computed(() => categorias.value.filter((c) => c.activo));
const categoriasPara = (gasto) => categorias.value.filter((c) => c.activo || c.id === gasto.categoriaId);
const cambiandoCategoriaId = ref(null);

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
const eliminandoCompraId = ref(null);
const editandoCompra = ref(null);
const guardandoCompra = ref(false);
const errorCompra = ref('');

function abrirEdicionCompra(compra) {
  errorCompra.value = '';
  editandoCompra.value = compra;
}

async function onGuardarCompra(payload) {
  errorCompra.value = '';
  guardandoCompra.value = true;
  try {
    await actualizarCompraHogar(editandoCompra.value.id, payload);
    editandoCompra.value = null;
    await Promise.all([cargarCompras(), recargarGastos()]);
    emit('cambio');
  } catch (e) {
    errorCompra.value = extractErrorMessage(e);
  } finally {
    guardandoCompra.value = false;
  }
}
const pagandoId = ref(null);

// Solo quien paga puede asociar uno de SUS métodos de pago (privados).
const pagaYo = computed(() => pagoUsuarioId.value && pagoUsuarioId.value === auth.usuario?.id);

async function actualizarSugerencia() {
  if (!aCuotas.value || !fecha.value) return;
  const metodo = pagaYo.value ? misMetodos.value.find((m) => m.id === metodoPagoId.value) : null;
  modoCobro.value = modoCobroSugerido(metodo);
  hInteres.value = metodo?.tasaMensual > 0 ? 'tarjeta' : 'sin';
  try {
    primeraCuota.value = await sugerirPrimeraCuota(fecha.value, pagaYo.value ? metodoPagoId.value || undefined : undefined);
  } catch {
    // sin sugerencia
  }
}
watch([aCuotas, metodoPagoId, fecha, pagoUsuarioId], actualizarSugerencia);

// La tasa de la tarjeta solo se conoce si quien paga es el usuario actual (sus métodos).
const metodoCompraHogar = computed(() => (pagaYo.value ? misMetodos.value.find((m) => m.id === metodoPagoId.value) : null));

const valorCuota = computed(() => {
  const n = Number(numeroCuotas.value);
  return n >= 2 && Number(valorTotal.value) > 0 ? Math.floor(Number(valorTotal.value) / n) : null;
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

function inicializarRepartoManual() {
  for (const m of miembros.value) {
    repartoManual[m.id] = repartoManual[m.id] ?? '';
  }
}

const sumaRepartoManual = computed(() =>
  miembros.value.reduce((acc, m) => acc + (Number(repartoManual[m.id]) || 0), 0),
);
const repartoManualValido = computed(
  () => Number(valorTotal.value) > 0 && sumaRepartoManual.value === Number(valorTotal.value),
);

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
    inicializarRepartoManual();
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onCrear() {
  error.value = '';
  creando.value = true;
  try {
    const payload = {
      item: item.value,
      valorTotal: Number(valorTotal.value),
      pagoUsuarioId: pagoUsuarioId.value,
      fecha: fecha.value,
      categoriaId: categoriaId.value || undefined,
    };
    if (personalizarReparto.value) {
      payload.repartos = miembros.value.map((m) => ({
        usuarioId: m.id,
        monto: Number(repartoManual[m.id]) || 0,
      }));
    }
    if (aCuotas.value) {
      await crearCompraHogar({
        item: payload.item,
        montoTotal: payload.valorTotal,
        numeroCuotas: Number(numeroCuotas.value),
        fechaCompra: payload.fecha,
        fechaPrimeraCuota: primeraCuota.value,
        modoCobro: modoCobro.value,
        ...(enCurso.value ? { cuotasPagadasAntes: Number(cuotasPagadasAntes.value) || 0 } : {}),
        ...(hInteres.value === 'tarjeta'
          ? {}
          : { tasaMensual: hInteres.value === 'otra' ? Number(hTasa.value) || 0 : 0, sistemaInteres: hSistema.value }),
        pagoUsuarioId: payload.pagoUsuarioId,
        metodoPagoId: pagaYo.value && metodoPagoId.value ? metodoPagoId.value : undefined,
        repartos: payload.repartos,
        categoriaId: payload.categoriaId,
      });
      await Promise.all([cargarCompras(), recargarGastos()]);
      aCuotas.value = false;
      enCurso.value = false;
      cuotasPagadasAntes.value = '';
      metodoPagoId.value = '';
    } else {
      if (pagaYo.value && metodoPagoId.value) payload.metodoPagoId = metodoPagoId.value;
      const nuevo = await crearGastoVariable(payload);
      gastos.value = ordenar([...gastos.value, nuevo]);
      metodoPagoId.value = '';
    }
    item.value = '';
    categoriaId.value = '';
    valorTotal.value = '';
    pagoUsuarioId.value = '';
    fecha.value = hoyISO();
    personalizarReparto.value = false;
    for (const m of miembros.value) repartoManual[m.id] = '';
    mostrarForm.value = false;
    emit('cambio');
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    creando.value = false;
  }
}

async function onCambiarPagador(gasto, usuarioId) {
  error.value = '';
  try {
    const actualizado = await actualizarGastoVariable(gasto.id, { pagoUsuarioId: usuarioId });
    const idx = gastos.value.findIndex((g) => g.id === gasto.id);
    gastos.value[idx] = actualizado;
    emit('cambio');
  } catch (e) {
    error.value = extractErrorMessage(e);
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

function onIniciarEditarReparto(gasto) {
  error.value = '';
  const actuales = new Map(gasto.repartos.map((r) => [r.usuarioId, r.monto]));
  for (const m of miembros.value) {
    repartoEdicion[m.id] = actuales.get(m.id) ?? 0;
  }
  editandoRepartoId.value = gasto.id;
}

function onCancelarEditarReparto() {
  editandoRepartoId.value = null;
}

function sumaRepartoEdicion() {
  return miembros.value.reduce((acc, m) => acc + (Number(repartoEdicion[m.id]) || 0), 0);
}

async function onGuardarReparto(gasto) {
  error.value = '';
  guardandoRepartoId.value = gasto.id;
  try {
    const repartos = miembros.value.map((m) => ({
      usuarioId: m.id,
      monto: Number(repartoEdicion[m.id]) || 0,
    }));
    const actualizado = await actualizarGastoVariable(gasto.id, { repartos });
    const idx = gastos.value.findIndex((g) => g.id === gasto.id);
    gastos.value[idx] = actualizado;
    editandoRepartoId.value = null;
    emit('cambio');
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    guardandoRepartoId.value = null;
  }
}

onMounted(cargar);

// Botón "+" de la barra del celular: /hogar?registrar=variable abre el formulario.
const rutaHogar = useRoute();
const routerHogar = useRouter();
watch(
  () => rutaHogar.query.registrar,
  (tipo) => {
    if (tipo !== 'variable') return;
    if (puedeEditar.value) mostrarForm.value = true;
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
      <button v-if="puedeEditar" class="btn-primary" @click="mostrarForm = true">
        <AppIcon name="plus" class="h-4 w-4" />
        Agregar gasto variable
      </button>
    </div>

    <AlertError :message="error" class="mb-4" />

    <AppModal v-if="mostrarForm" title="Agregar gasto variable" @close="mostrarForm = false">
      <form class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="onCrear">
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
        <div v-if="categoriasActivas.length">
          <label class="label" for="gasto-hogar-categoria">Categoría</label>
          <select id="gasto-hogar-categoria" v-model="categoriaId" class="field">
            <option value="">Sin categoría</option>
            <option v-for="c in categoriasActivas" :key="c.id" :value="c.id">{{ c.nombre }}</option>
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
            <input v-model="aCuotas" type="checkbox" class="checkbox" />
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
                <option v-if="metodoCompraHogar?.tasaMensual > 0" value="tarjeta">
                  El de la tarjeta ({{ formatTasa(metodoCompraHogar.tasaMensual) }})
                </option>
                <option value="sin">Sin interés</option>
                <option value="otra">Otra tasa</option>
              </select>
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

        <template v-if="personalizarReparto">
          <div v-for="m in miembros" :key="m.id">
            <FormField
              v-model="repartoManual[m.id]"
              type="number"
              :label="`Le toca a ${m.nombre} (COP)`"
            />
          </div>
          <p
            class="sm:col-span-2 flex items-center gap-2 text-[13px] font-medium rounded-lg px-3 py-2"
            :class="repartoManualValido ? 'text-positive bg-positive/10' : 'text-negative bg-negative/10'"
          >
            <AppIcon :name="repartoManualValido ? 'check' : 'alert'" class="h-4 w-4 shrink-0" />
            <span>
              Suma del reparto: {{ formatCurrency(sumaRepartoManual) }}
              <span v-if="valorTotal"> de {{ formatCurrency(Number(valorTotal)) }}</span>
            </span>
          </p>
        </template>

        <div class="sm:col-span-2 pt-1">
          <p v-if="!personalizarReparto" class="text-[13px] text-ink-tertiary mb-3">
            El reparto se calcula automáticamente según el reparto configurado en Configuración.
          </p>
          <button
            type="submit"
            class="btn-primary w-full sm:w-auto"
            :disabled="creando || (personalizarReparto && !repartoManualValido)"
          >
            {{ creando ? 'Agregando…' : aCuotas ? 'Agregar compra' : 'Agregar gasto' }}
          </button>
        </div>
      </form>
    </AppModal>

    <p v-if="loading" class="text-sm text-ink-tertiary">Cargando…</p>
    <div v-else-if="!gastosALaFecha.length" class="empty flex flex-col items-center gap-2">
      <AppIcon name="receipt" class="h-6 w-6" />
      Aún no hay gastos variables registrados.
    </div>

    <ul v-else class="list">
      <li v-for="gasto in visibles" :key="gasto.id" class="py-3.5">
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
          <button
            v-if="puedeEditar && gasto.estado === 'por_pagar'"
            type="button"
            class="btn-secondary btn-sm ml-auto"
            :disabled="pagandoId === gasto.id"
            @click="onPagarCuota(gasto)"
          >
            <AppIcon name="check" class="h-3.5 w-3.5" />
            Lo pagué
          </button>
          <button
            v-else-if="puedeEditar && gasto.estado === 'pagado' && gasto.compra?.modoCobro === 'manual'"
            type="button"
            class="btn-ghost btn-sm ml-auto"
            :disabled="pagandoId === gasto.id"
            @click="onDeshacerPagoCuota(gasto)"
          >
            Deshacer
          </button>
        </div>
        <div
          v-else-if="!esEditable(gasto) || editandoRepartoId !== gasto.id"
          class="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
        >
          <p class="min-w-0 text-[13px] text-ink-tertiary" :class="{ 'opacity-60': !esEditable(gasto) }">
            Reparto: {{ formatReparto(gasto.repartos) }}
          </p>
          <div v-if="esEditable(gasto)" class="flex items-center gap-1.5 ml-auto">
            <label :for="`pagador-${gasto.id}`" class="sr-only">Quién pagó {{ gasto.item }}</label>
            <select
              :id="`pagador-${gasto.id}`"
              class="field !w-auto !py-1.5 !pl-2.5 !pr-8 !text-[13px] !rounded-lg"
              :value="gasto.pagoUsuarioId"
              @change="onCambiarPagador(gasto, $event.target.value)"
            >
              <option v-for="m in miembros" :key="m.id" :value="m.id">{{ m.nombre }}</option>
            </select>
            <button class="btn-ghost btn-sm" @click="onIniciarEditarReparto(gasto)">
              <AppIcon name="edit" class="h-3.5 w-3.5" />
              Editar reparto
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

        <div v-else class="panel-sunken mt-3 p-4 space-y-3">
          <p class="text-[13px] font-medium text-ink-secondary">Reparto de este gasto</p>
          <div v-for="m in miembros" :key="m.id" class="flex items-center justify-between gap-4">
            <label :for="`reparto-${gasto.id}-${m.id}`" class="text-sm text-ink-primary truncate">{{ m.nombre }}</label>
            <input
              :id="`reparto-${gasto.id}-${m.id}`"
              v-model="repartoEdicion[m.id]"
              type="number"
              inputmode="numeric"
              class="field !w-36 text-right"
            />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
            <span
              class="text-[13px] font-medium"
              :class="sumaRepartoEdicion() === gasto.valorTotal ? 'text-positive' : 'text-negative'"
            >
              Suma: {{ formatCurrency(sumaRepartoEdicion()) }} de {{ formatCurrency(gasto.valorTotal) }}
            </span>
            <div class="flex gap-2 ml-auto">
              <button class="btn-ghost btn-sm" @click="onCancelarEditarReparto">
                Cancelar
              </button>
              <button
                class="btn-primary btn-sm"
                :disabled="guardandoRepartoId === gasto.id || sumaRepartoEdicion() !== gasto.valorTotal"
                @click="onGuardarReparto(gasto)"
              >
                Guardar
              </button>
            </div>
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
        <li v-for="compra in comprasActivas" :key="compra.id" class="list-row !py-3 group">
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
            v-if="!cuotasCuadradas(compra)"
            type="button"
            class="btn-icon !p-1.5 hover:!text-negative sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
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
    <AppModal v-if="editandoCompra" :title="`Editar ${editandoCompra.item}`" size="lg" @close="editandoCompra = null">
      <AlertError :message="errorCompra" class="mb-4" />
      <CompraCuotasForm
        tipo="hogar"
        :compra="editandoCompra"
        :metodos="misMetodos"
        :categorias="categorias"
        :miembros="miembros"
        :usuario-actual-id="auth.usuario?.id ?? ''"
        :guardando="guardandoCompra"
        @guardar="onGuardarCompra"
        @cancelar="editandoCompra = null"
      />
    </AppModal>
  </section>
</template>
