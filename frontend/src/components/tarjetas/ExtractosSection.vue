<script setup>
import { ref, reactive, computed, watch } from 'vue';
import {
  listarCiclosExtracto,
  obtenerCicloExtracto,
  guardarExtracto,
  revisarExtracto,
  agregarAjusteExtracto,
  resolverReclamoExtracto,
  eliminarAjusteExtracto,
} from '../../api/extractosTarjeta.js';
import { extractErrorMessage } from '../../api/client.js';
import { confirmar } from '../../composables/useConfirm.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import AppIcon from '../AppIcon.vue';
import AppModal from '../AppModal.vue';
import AlertError from '../AlertError.vue';
import FormField from '../FormField.vue';

/**
 * Extractos de una tarjeta de crédito: por cada ciclo de corte, lo que la
 * app esperaba contra lo que cobra el banco, con ajustes (corregir un valor,
 * agregar un cargo que faltaba, marcar un cargo no reconocido o algo que el
 * banco no cobró). Privado del usuario.
 */
const props = defineProps({ metodo: { type: Object, required: true } });
const emit = defineEmits(['cambio']);

const CONCEPTOS = [
  { valor: 'interes', label: 'Intereses' },
  { valor: 'cuota_manejo', label: 'Cuota de manejo' },
  { valor: 'seguro', label: 'Seguro' },
  { valor: 'mora', label: 'Interés de mora' },
  { valor: 'comision', label: 'Comisión' },
  { valor: 'avance', label: 'Avance' },
  { valor: 'otro', label: 'Otro' },
];
const ESTADO_RECLAMO = { pendiente: 'Reclamo pendiente', reversado: 'Reversado', aceptado: 'Era válido' };

const lista = ref(null);
const error = ref('');

const iso = (f) => String(f).slice(0, 10);

async function cargarLista() {
  error.value = '';
  lista.value = null;
  if (!props.metodo.diaCorte) return;
  try {
    lista.value = await listarCiclosExtracto(props.metodo.id);
  } catch (e) {
    error.value = extractErrorMessage(e);
  }
}
watch(() => props.metodo.id, cargarLista, { immediate: true });

function estadoCiclo(c) {
  if (c.enCurso) return { label: 'En curso', clase: 'badge-neutral' };
  if (c.estado === 'revisado') {
    return c.diferencia === 0 ? { label: 'Revisado', clase: 'badge-positive' } : { label: 'Revisado con diferencia', clase: 'badge-warning' };
  }
  if (c.totalBanco != null) return { label: 'En revisión', clase: 'badge-accent' };
  return { label: 'Sin revisar', clase: 'badge-neutral' };
}

// --- Detalle de un ciclo ---
const detalle = ref(null);
const errorDetalle = ref('');
const ocupado = ref(false);
const form = reactive({ totalBanco: '', notas: '' });

function aplicar(d) {
  detalle.value = d;
  form.totalBanco = d.extracto?.totalBanco ?? '';
  form.notas = d.extracto?.notas ?? '';
}

async function abrir(ciclo) {
  errorDetalle.value = '';
  corrigiendo.value = null;
  agregando.value = '';
  try {
    aplicar(await obtenerCicloExtracto(props.metodo.id, iso(ciclo.fechaCorte)));
  } catch (e) {
    error.value = extractErrorMessage(e);
  }
}

async function cerrar() {
  detalle.value = null;
  await cargarLista();
  emit('cambio');
}

const fechaCorte = computed(() => iso(detalle.value.ciclo.fechaCorte));
const revisado = computed(() => detalle.value?.extracto?.estado === 'revisado');
const ajustes = computed(() => detalle.value?.extracto?.ajustes ?? []);
const correccionDe = computed(() => new Map(ajustes.value.filter((a) => a.tipo === 'correccion').map((a) => [a.gastoId, a])));
const noCobradoDe = computed(() => new Map(ajustes.value.filter((a) => a.tipo === 'no_cobrado').map((a) => [a.gastoId, a])));
const cargoDe = computed(() => new Map(ajustes.value.filter((a) => a.gastoId && (a.tipo === 'cargo' || a.tipo === 'no_reconocido')).map((a) => [a.gastoId, a])));
const reclamos = computed(() => ajustes.value.filter((a) => a.tipo === 'no_reconocido'));

async function ejecutar(fn) {
  ocupado.value = true;
  errorDetalle.value = '';
  try {
    aplicar(await fn());
    return true;
  } catch (e) {
    errorDetalle.value = extractErrorMessage(e);
    return false;
  } finally {
    ocupado.value = false;
  }
}

function guardarTotal() {
  return ejecutar(() =>
    guardarExtracto(props.metodo.id, fechaCorte.value, {
      totalBanco: form.totalBanco === '' ? null : Number(form.totalBanco),
      notas: form.notas,
    }),
  );
}

async function marcarRevisado(valor) {
  if (valor && String(form.totalBanco) !== String(detalle.value.extracto?.totalBanco ?? '')) {
    if (!(await guardarTotal())) return;
  }
  await ejecutar(() => revisarExtracto(props.metodo.id, fechaCorte.value, valor));
}

// Corregir el valor de un cargo
const corrigiendo = ref(null);
const valorCorregido = ref('');
function empezarCorreccion(linea) {
  corrigiendo.value = linea.id;
  valorCorregido.value = linea.monto;
}
async function guardarCorreccion(linea) {
  const ok = await ejecutar(() =>
    agregarAjusteExtracto(props.metodo.id, fechaCorte.value, { tipo: 'correccion', gastoId: linea.id, monto: Number(valorCorregido.value) }),
  );
  if (ok) corrigiendo.value = null;
}

function marcarNoCobrado(linea) {
  return ejecutar(() => agregarAjusteExtracto(props.metodo.id, fechaCorte.value, { tipo: 'no_cobrado', gastoId: linea.id }));
}

async function quitarAjuste(ajuste, mensaje) {
  if (mensaje && !(await confirmar(mensaje, { textoAceptar: 'Quitar' }))) return;
  await ejecutar(() => eliminarAjusteExtracto(ajuste.id));
}

// Agregar un cargo que faltaba o uno no reconocido
const agregando = ref('');
const nuevo = reactive({ concepto: 'interes', monto: '', descripcion: '', fecha: '' });
function abrirAgregar(tipo) {
  agregando.value = tipo;
  nuevo.concepto = 'interes';
  nuevo.monto = '';
  nuevo.descripcion = '';
  nuevo.fecha = '';
}
async function guardarNuevo() {
  const payload =
    agregando.value === 'cargo'
      ? { tipo: 'cargo', concepto: nuevo.concepto, monto: Number(nuevo.monto), descripcion: nuevo.descripcion || undefined }
      : { tipo: 'no_reconocido', monto: Number(nuevo.monto), descripcion: nuevo.descripcion, fecha: nuevo.fecha || undefined };
  if (await ejecutar(() => agregarAjusteExtracto(props.metodo.id, fechaCorte.value, payload))) agregando.value = '';
}

function resolver(ajuste, estado) {
  return ejecutar(() => resolverReclamoExtracto(ajuste.id, estado));
}

async function resolverDesdeLista(reclamo, estado) {
  error.value = '';
  try {
    await resolverReclamoExtracto(reclamo.id, estado);
    await cargarLista();
    emit('cambio');
  } catch (e) {
    error.value = extractErrorMessage(e);
  }
}

const ETIQUETA_LINEA = { cuota: 'Cuota', ajuste: 'Ajuste del extracto' };
</script>

<template>
  <section class="card card-pad">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 class="section-title">Extractos</h2>
        <p class="section-hint">Compara lo que la app esperaba en cada corte con lo que te cobra el banco.</p>
      </div>
    </div>

    <AlertError :message="error" class="mt-3" />

    <p v-if="!metodo.diaCorte" class="empty mt-3">
      Configura el día de corte (y de pago) de esta tarjeta en Personal → Configuración → Métodos de pago para revisar sus extractos.
    </p>
    <p v-else-if="!lista" class="empty mt-3">Cargando…</p>

    <template v-else>
      <!-- Reclamos pendientes de cualquier extracto -->
      <div v-if="lista.reclamosPendientes.length" class="mt-4 rounded-xl border border-warning/40 bg-warning/5 p-3">
        <p class="flex items-center gap-1.5 text-sm font-medium text-ink-primary">
          <AppIcon name="alert" class="h-4 w-4 text-warning" />
          Reclamos pendientes
        </p>
        <ul class="mt-2 space-y-2">
          <li v-for="r in lista.reclamosPendientes" :key="r.id" class="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span class="min-w-0 text-ink-secondary">
              {{ r.descripcion }} · {{ formatCurrency(r.monto) }}
              <span class="text-xs text-ink-tertiary">(extracto del {{ formatDate(r.fechaCorte) }})</span>
            </span>
            <span class="flex gap-1.5">
              <button type="button" class="btn-secondary btn-sm" @click="resolverDesdeLista(r, 'reversado')">El banco lo reversó</button>
              <button type="button" class="btn-ghost btn-sm" @click="resolverDesdeLista(r, 'aceptado')">Era válido</button>
            </span>
          </li>
        </ul>
      </div>

      <ul class="list mt-3">
        <li v-for="c in lista.ciclos" :key="c.fechaCorte">
          <button type="button" class="list-row w-full !py-3 text-left hover:bg-surface-hover rounded-lg" @click="abrir(c)">
            <div class="min-w-0">
              <p class="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink-primary">
                Corte {{ formatDate(c.fechaCorte) }}
                <span :class="estadoCiclo(c).clase">{{ estadoCiclo(c).label }}</span>
              </p>
              <p class="text-[13px] text-ink-tertiary">
                <template v-if="c.fechaPago">Pago {{ formatDate(c.fechaPago) }} · </template>{{ c.cargos }} cargo{{ c.cargos === 1 ? '' : 's' }}
                <template v-if="c.diferencia != null && c.diferencia !== 0">
                  · <span class="text-warning">diferencia {{ formatCurrency(c.diferencia) }}</span>
                </template>
              </p>
            </div>
            <span class="flex shrink-0 items-center gap-2">
              <span class="text-right">
                <span class="block text-sm font-semibold text-ink-primary">{{ formatCurrency(c.esperado - c.noCobrado) }}</span>
                <span v-if="c.totalBanco != null" class="block text-xs text-ink-tertiary">banco {{ formatCurrency(c.totalBanco) }}</span>
              </span>
              <AppIcon name="chevronRight" class="h-4 w-4 text-ink-tertiary" />
            </span>
          </button>
        </li>
      </ul>
    </template>

    <!-- Detalle / revisión de un extracto -->
    <AppModal v-if="detalle" :title="`Extracto del corte ${formatDate(detalle.ciclo.fechaCorte)}`" size="lg" @close="cerrar">
      <div class="space-y-5">
        <AlertError :message="errorDetalle" />

        <p class="text-[13px] text-ink-tertiary">
          Compras del {{ formatDate(detalle.ciclo.corteAnterior) }} (sin incluir) al {{ formatDate(detalle.ciclo.fechaCorte) }}<template
            v-if="detalle.ciclo.fechaPago"
          >, más las cuotas que se pagan hasta el {{ formatDate(detalle.ciclo.fechaPago) }}</template>.
          <template v-if="detalle.ciclo.enCurso"> Este ciclo aún no ha cerrado: pueden entrar más compras.</template>
        </p>

        <!-- Totales -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="rounded-xl border border-border p-3">
            <p class="stat-label">La app esperaba</p>
            <p class="mt-1 text-xl font-semibold text-ink-primary">{{ formatCurrency(detalle.totales.esperado - detalle.totales.noCobrado) }}</p>
            <p v-if="detalle.totales.noCobrado" class="text-xs text-ink-tertiary">sin {{ formatCurrency(detalle.totales.noCobrado) }} que el banco no cobró</p>
          </div>
          <div class="rounded-xl border border-border p-3">
            <label class="stat-label" for="extracto-total">Cobra el banco</label>
            <div class="mt-1 flex gap-2">
              <input
                id="extracto-total"
                v-model="form.totalBanco"
                type="number"
                min="0"
                inputmode="numeric"
                class="field !py-1.5"
                placeholder="Total del extracto"
                :disabled="revisado"
              />
              <button
                v-if="!revisado"
                type="button"
                class="btn-secondary btn-sm shrink-0"
                :disabled="ocupado"
                @click="guardarTotal"
              >
                Guardar
              </button>
            </div>
            <p class="mt-1 text-xs text-ink-tertiary">El pago del mes del extracto (sin el saldo de cuotas futuras).</p>
          </div>
          <div class="rounded-xl border p-3" :class="detalle.totales.diferencia === 0 ? 'border-positive/40 bg-positive/5' : detalle.totales.diferencia == null ? 'border-border' : 'border-warning/40 bg-warning/5'">
            <p class="stat-label">Diferencia</p>
            <p
              class="mt-1 text-xl font-semibold"
              :class="detalle.totales.diferencia === 0 ? 'text-positive' : detalle.totales.diferencia == null ? 'text-ink-tertiary' : 'text-warning'"
            >
              <template v-if="detalle.totales.diferencia == null">—</template>
              <template v-else-if="detalle.totales.diferencia === 0">Cuadra</template>
              <template v-else>{{ formatCurrency(detalle.totales.diferencia) }}</template>
            </p>
            <p v-if="detalle.totales.diferencia > 0" class="text-xs text-ink-tertiary">El banco cobró más: busca el cargo que falta.</p>
            <p v-else-if="detalle.totales.diferencia < 0" class="text-xs text-ink-tertiary">El banco cobró menos: algo no entró o cambió de valor.</p>
            <p v-if="detalle.totales.reclamos" class="text-xs text-ink-tertiary">Ya descuenta {{ formatCurrency(detalle.totales.reclamos) }} en reclamos.</p>
          </div>
        </div>

        <!-- Cargos que la app esperaba -->
        <div>
          <p class="section-title !text-sm">Cargos que la app tiene en este extracto</p>
          <p v-if="!detalle.lineas.length" class="empty mt-2">La app no tiene cargos con esta tarjeta en este ciclo.</p>
          <ul v-else class="list mt-1">
            <li v-for="l in detalle.lineas" :key="l.id" class="list-row !items-start !py-2.5">
              <div class="min-w-0">
                <p class="flex flex-wrap items-center gap-1.5 text-sm text-ink-primary" :class="{ 'line-through text-ink-tertiary': noCobradoDe.get(l.id) }">
                  <span class="truncate">{{ l.descripcion }}</span>
                  <span v-if="l.delHogar" class="badge-neutral">Hogar</span>
                  <span v-if="ETIQUETA_LINEA[l.tipo]" class="badge-neutral">{{ ETIQUETA_LINEA[l.tipo] }}</span>
                  <span v-if="l.estado === 'pendiente'" class="badge-warning">Pendiente</span>
                </p>
                <p class="text-xs text-ink-tertiary">
                  {{ formatDate(l.fecha) }}<template v-if="l.interes"> · {{ formatCurrency(l.interes) }} de interés</template>
                  <template v-if="correccionDe.get(l.id)"> · corregido, antes {{ formatCurrency(correccionDe.get(l.id).montoAntes) }}</template>
                  <template v-if="noCobradoDe.get(l.id)"> · el banco no lo cobró en este extracto</template>
                </p>

                <form v-if="corrigiendo === l.id" class="mt-2 flex flex-wrap items-center gap-2" @submit.prevent="guardarCorreccion(l)">
                  <input v-model="valorCorregido" type="number" min="1" inputmode="numeric" class="field !w-40 !py-1.5" aria-label="Valor que cobró el banco" required />
                  <button type="submit" class="btn-primary btn-sm" :disabled="ocupado">Guardar</button>
                  <button type="button" class="btn-ghost btn-sm" @click="corrigiendo = null">Cancelar</button>
                </form>
                <div v-else-if="!revisado" class="mt-1.5 flex flex-wrap gap-1.5">
                  <template v-if="cargoDe.get(l.id)">
                    <button
                      v-if="cargoDe.get(l.id).tipo === 'cargo'"
                      type="button"
                      class="btn-ghost btn-sm"
                      @click="quitarAjuste(cargoDe.get(l.id), '¿Quitar este cargo? Se borra el gasto que se registró con la tarjeta.')"
                    >
                      Quitar
                    </button>
                  </template>
                  <template v-else>
                    <button v-if="l.corregible && !correccionDe.get(l.id) && !noCobradoDe.get(l.id)" type="button" class="btn-ghost btn-sm" @click="empezarCorreccion(l)">
                      Otro valor
                    </button>
                    <button
                      v-if="correccionDe.get(l.id)"
                      type="button"
                      class="btn-ghost btn-sm"
                      @click="quitarAjuste(correccionDe.get(l.id), `¿Volver al valor anterior (${formatCurrency(correccionDe.get(l.id).montoAntes)})?`)"
                    >
                      Deshacer corrección
                    </button>
                    <button v-if="!noCobradoDe.get(l.id)" type="button" class="btn-ghost btn-sm" @click="marcarNoCobrado(l)">No lo cobró</button>
                    <button v-else type="button" class="btn-ghost btn-sm" @click="quitarAjuste(noCobradoDe.get(l.id))">Sí lo cobró</button>
                  </template>
                </div>
              </div>
              <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-ink-primary">{{ formatCurrency(l.monto) }}</span>
            </li>
          </ul>
          <p v-if="detalle.lineas.some((l) => l.delHogar)" class="mt-2 text-xs text-ink-tertiary">
            Los pagos del hogar muestran el 100 % que pagaste con la tarjeta; su valor se cambia desde Hogar.
          </p>
        </div>

        <!-- Agregar lo que está en el banco y no en la app -->
        <div v-if="!revisado">
          <div v-if="!agregando" class="flex flex-wrap gap-2">
            <button type="button" class="btn-secondary btn-sm" @click="abrirAgregar('cargo')">
              <AppIcon name="plus" class="h-4 w-4" />
              Cargo que faltaba
            </button>
            <button type="button" class="btn-secondary btn-sm" @click="abrirAgregar('no_reconocido')">
              <AppIcon name="alert" class="h-4 w-4" />
              Cargo que no reconozco
            </button>
          </div>
          <form v-else class="grid grid-cols-1 gap-3 rounded-xl border border-border p-4 sm:grid-cols-2" @submit.prevent="guardarNuevo">
            <p class="sm:col-span-2 text-sm font-medium text-ink-primary">
              {{ agregando === 'cargo' ? 'Cargo que la app no tenía' : 'Cargo que no reconoces (reclamo)' }}
            </p>
            <div v-if="agregando === 'cargo'">
              <label class="label" for="extracto-concepto">Qué es</label>
              <select id="extracto-concepto" v-model="nuevo.concepto" class="field">
                <option v-for="c in CONCEPTOS" :key="c.valor" :value="c.valor">{{ c.label }}</option>
              </select>
            </div>
            <FormField v-model="nuevo.monto" type="number" label="Valor (COP)" required />
            <FormField
              v-model="nuevo.descripcion"
              :label="agregando === 'cargo' ? 'Descripción (opcional)' : 'Cómo aparece en el extracto'"
              :required="agregando !== 'cargo'"
            />
            <FormField v-if="agregando === 'no_reconocido'" v-model="nuevo.fecha" type="date" label="Fecha del cargo (opcional)" />
            <p class="sm:col-span-2 text-xs text-ink-tertiary">
              <template v-if="agregando === 'cargo'">Se registra como un gasto con esta tarjeta el día del corte.</template>
              <template v-else>No se registra como gasto mientras lo reclamas. Cuando el banco responda, márcalo reversado o válido.</template>
            </p>
            <div class="flex justify-end gap-2 sm:col-span-2">
              <button type="button" class="btn-ghost btn-sm" @click="agregando = ''">Cancelar</button>
              <button type="submit" class="btn-primary btn-sm" :disabled="ocupado">Agregar</button>
            </div>
          </form>
        </div>

        <!-- Reclamos de este extracto -->
        <div v-if="reclamos.length">
          <p class="section-title !text-sm">Cargos no reconocidos</p>
          <ul class="list mt-1">
            <li v-for="r in reclamos" :key="r.id" class="list-row !items-start !py-2.5">
              <div class="min-w-0">
                <p class="flex flex-wrap items-center gap-1.5 text-sm text-ink-primary">
                  <span class="truncate">{{ r.descripcion }}</span>
                  <span :class="r.estadoReclamo === 'pendiente' ? 'badge-warning' : r.estadoReclamo === 'reversado' ? 'badge-positive' : 'badge-neutral'">
                    {{ ESTADO_RECLAMO[r.estadoReclamo] }}
                  </span>
                </p>
                <p v-if="r.fecha" class="text-xs text-ink-tertiary">{{ formatDate(r.fecha) }}</p>
                <div class="mt-1.5 flex flex-wrap gap-1.5">
                  <button v-if="r.estadoReclamo !== 'reversado'" type="button" class="btn-ghost btn-sm" :disabled="ocupado" @click="resolver(r, 'reversado')">
                    El banco lo reversó
                  </button>
                  <button v-if="r.estadoReclamo !== 'aceptado'" type="button" class="btn-ghost btn-sm" :disabled="ocupado" @click="resolver(r, 'aceptado')">
                    Era válido
                  </button>
                  <button v-if="r.estadoReclamo !== 'pendiente'" type="button" class="btn-ghost btn-sm" :disabled="ocupado" @click="resolver(r, 'pendiente')">
                    Volver a pendiente
                  </button>
                  <button
                    v-if="!revisado"
                    type="button"
                    class="btn-ghost btn-sm"
                    @click="quitarAjuste(r, '¿Quitar este cargo no reconocido?')"
                  >
                    Quitar
                  </button>
                </div>
              </div>
              <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-ink-primary">{{ formatCurrency(r.monto) }}</span>
            </li>
          </ul>
        </div>

        <div>
          <label class="label" for="extracto-notas">Notas (opcional)</label>
          <textarea id="extracto-notas" v-model="form.notas" rows="2" class="field" :disabled="revisado" maxlength="500" />
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <p class="text-xs text-ink-tertiary">
            <template v-if="revisado">Revisado el {{ formatDate(detalle.extracto.revisadoEn) }}. La app esperaba {{ formatCurrency(detalle.extracto.totalEsperado) }}.</template>
            <template v-else>Márcalo revisado cuando cuadre o cuando ya sepas qué explica la diferencia.</template>
          </p>
          <div class="flex gap-2">
            <button v-if="revisado" type="button" class="btn-secondary" :disabled="ocupado" @click="marcarRevisado(false)">Reabrir</button>
            <template v-else>
              <button type="button" class="btn-ghost" :disabled="ocupado" @click="guardarTotal">Guardar</button>
              <button type="button" class="btn-primary" :disabled="ocupado || form.totalBanco === ''" @click="marcarRevisado(true)">
                <AppIcon name="check" class="h-4 w-4" />
                Marcar revisado
              </button>
            </template>
          </div>
        </div>
      </div>
    </AppModal>
  </section>
</template>
