<script setup>
import { ref, computed, onMounted } from 'vue';
import { confirmar } from '../../composables/useConfirm.js';
import {
  listarCategoriasHogar,
  crearCategoriaHogar,
  crearCategoriasBasicas,
  actualizarCategoriaHogar,
  eliminarCategoriaHogar,
  listarTopesHogar,
  crearTopeHogar,
  actualizarTopeHogar,
  eliminarTopeHogar,
} from '../../api/categoriasHogar.js';
import { extractErrorMessage } from '../../api/client.js';
import { formatCurrency } from '../../utils/format.js';
import AlertError from '../AlertError.vue';
import AppIcon from '../AppIcon.vue';
import FormField from '../FormField.vue';

/**
 * Categorías del hogar (compartidas) y topes mensuales de gasto (E4).
 * Las categorías se eligen en gastos variables, compras a cuotas y cuentas
 * fijas; los topes se ven como tarjetas en Panel del hogar.
 */
defineProps({ canEdit: { type: Boolean, default: false } });

const categorias = ref([]);
const topes = ref([]);
const cargando = ref(true);
const error = ref('');
const ocupado = ref(false);

const nuevaCategoria = ref('');
const editandoId = ref(null);
const editandoNombre = ref('');

const nuevoTope = ref({ categoriaId: '', montoMensual: '' });
const editandoTopeId = ref(null);
const editandoTopeMonto = ref('');

const activas = computed(() => categorias.value.filter((c) => c.activo));

async function cargar() {
  try {
    [categorias.value, topes.value] = await Promise.all([listarCategoriasHogar(), listarTopesHogar()]);
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    cargando.value = false;
  }
}
onMounted(cargar);

async function accion(fn) {
  error.value = '';
  ocupado.value = true;
  try {
    await fn();
    await cargar();
    return true;
  } catch (e) {
    error.value = extractErrorMessage(e);
    return false;
  } finally {
    ocupado.value = false;
  }
}

const crearBasicas = () => accion(() => crearCategoriasBasicas());

async function agregarCategoria() {
  const nombre = nuevaCategoria.value.trim();
  if (!nombre) return;
  if (await accion(() => crearCategoriaHogar({ nombre }))) nuevaCategoria.value = '';
}

function empezarEdicion(c) {
  editandoId.value = c.id;
  editandoNombre.value = c.nombre;
}
async function guardarNombre(c) {
  const nombre = editandoNombre.value.trim();
  if (!nombre || nombre === c.nombre) {
    editandoId.value = null;
    return;
  }
  if (await accion(() => actualizarCategoriaHogar(c.id, { nombre }))) editandoId.value = null;
}

async function cambiarActiva(c) {
  if (c.activo) {
    const tieneTope = topes.value.some((t) => t.categoriaId === c.id && t.activo);
    const ok = await confirmar(
      `¿Desactivar "${c.nombre}"? Ya no se podrá elegir en gastos nuevos; lo registrado la conserva.${tieneTope ? ' Su tope también se desactiva.' : ''}`,
      { textoAceptar: 'Desactivar' },
    );
    if (!ok) return;
  }
  await accion(() => actualizarCategoriaHogar(c.id, { activo: !c.activo }));
}

async function borrarCategoria(c) {
  const ok = await confirmar(`¿Eliminar la categoría "${c.nombre}"? Esta acción no se puede deshacer.`, {
    textoAceptar: 'Eliminar',
    peligroso: true,
  });
  if (ok) await accion(() => eliminarCategoriaHogar(c.id));
}

// --- Topes ---
const opcionesTope = computed(() => {
  const ocupadas = new Set(topes.value.filter((t) => t.activo).map((t) => t.categoriaId ?? 'total'));
  return [
    { value: 'total', label: 'Total del hogar', disabled: ocupadas.has('total') },
    ...activas.value.map((c) => ({ value: c.id, label: c.nombre, disabled: ocupadas.has(c.id) })),
  ];
});

async function agregarTope() {
  const monto = Number(nuevoTope.value.montoMensual);
  if (!nuevoTope.value.categoriaId || !monto) return;
  const payload = {
    categoriaId: nuevoTope.value.categoriaId === 'total' ? null : nuevoTope.value.categoriaId,
    montoMensual: monto,
  };
  if (await accion(() => crearTopeHogar(payload))) nuevoTope.value = { categoriaId: '', montoMensual: '' };
}

function nombreTope(t) {
  return t.categoria?.nombre ?? 'Total del hogar';
}

function empezarTope(t) {
  editandoTopeId.value = t.id;
  editandoTopeMonto.value = t.montoMensual;
}
async function guardarTope(t) {
  const monto = Number(editandoTopeMonto.value);
  if (!monto || monto === t.montoMensual) {
    editandoTopeId.value = null;
    return;
  }
  if (await accion(() => actualizarTopeHogar(t.id, { montoMensual: monto }))) editandoTopeId.value = null;
}

const cambiarTopeActivo = (t) => accion(() => actualizarTopeHogar(t.id, { activo: !t.activo }));

async function borrarTope(t) {
  const ok = await confirmar(`¿Eliminar el tope de ${nombreTope(t)}? También se borra su historial de meses.`, {
    textoAceptar: 'Eliminar',
    peligroso: true,
  });
  if (ok) await accion(() => eliminarTopeHogar(t.id));
}
</script>

<template>
  <div class="space-y-6">
    <AlertError :message="error" />

    <section class="card card-pad">
      <h3 class="section-title">Categorías del hogar</h3>
      <p class="section-hint mb-4">
        Las comparten todos los miembros. Se eligen en los gastos variables, las compras a cuotas y las cuentas fijas,
        y con ellas se arma el gasto por categoría y los topes.
      </p>

      <p v-if="cargando" class="empty">Cargando…</p>
      <template v-else>
        <div v-if="!categorias.length" class="empty flex flex-col items-center gap-3">
          <AppIcon name="chart" class="h-6 w-6" />
          Todavía no hay categorías.
          <button v-if="canEdit" type="button" class="btn-primary btn-sm" :disabled="ocupado" @click="crearBasicas">
            Crear las básicas
          </button>
          <span v-if="canEdit" class="text-xs">Mercado, Servicios, Arriendo, Salidas, Transporte, Mascotas, Salud y Otros.</span>
        </div>

        <ul v-else class="list">
          <li v-for="c in categorias" :key="c.id" class="list-row !py-2.5">
            <div class="min-w-0 flex-1" :class="{ 'opacity-60': !c.activo }">
              <form v-if="editandoId === c.id" class="flex gap-2" @submit.prevent="guardarNombre(c)">
                <input v-model="editandoNombre" class="field !py-1.5" maxlength="60" :aria-label="`Nuevo nombre de ${c.nombre}`" />
                <button type="submit" class="btn-primary btn-sm" :disabled="ocupado">Guardar</button>
                <button type="button" class="btn-ghost btn-sm" @click="editandoId = null">Cancelar</button>
              </form>
              <p v-else class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-medium text-ink-primary">{{ c.nombre }}</span>
                <span v-if="!c.activo" class="badge-warning">Inactiva</span>
                <span v-if="c.usos" class="text-xs text-ink-tertiary">{{ c.usos }} {{ c.usos === 1 ? 'uso' : 'usos' }}</span>
              </p>
            </div>
            <div v-if="canEdit && editandoId !== c.id" class="flex shrink-0 items-center gap-1">
              <label class="mr-1 inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-secondary">
                <input type="checkbox" class="checkbox" :checked="c.activo" :disabled="ocupado" @change="cambiarActiva(c)" />
                <span class="sr-only sm:not-sr-only">Activa</span>
              </label>
              <button type="button" class="btn-icon" :aria-label="`Renombrar ${c.nombre}`" @click="empezarEdicion(c)">
                <AppIcon name="edit" class="h-4 w-4" />
              </button>
              <button
                v-if="!c.usos"
                type="button"
                class="btn-icon hover:!text-negative hover:!bg-negative/10"
                :aria-label="`Eliminar ${c.nombre}`"
                :disabled="ocupado"
                @click="borrarCategoria(c)"
              >
                <AppIcon name="trash" class="h-4 w-4" />
              </button>
            </div>
          </li>
        </ul>

        <form v-if="canEdit && categorias.length" class="mt-4 flex items-end gap-2" @submit.prevent="agregarCategoria">
          <div class="flex-1">
            <FormField v-model="nuevaCategoria" label="Nueva categoría" placeholder="Ej. Hijos, Viajes…" />
          </div>
          <button type="submit" class="btn-secondary" :disabled="ocupado || !nuevaCategoria.trim()">
            <AppIcon name="plus" class="h-4 w-4" /> Agregar
          </button>
        </form>
      </template>
    </section>

    <section class="card card-pad">
      <h3 class="section-title">Topes de gasto mensual</h3>
      <p class="section-hint mb-4">
        Cuánto quieren gastar como máximo al mes en una categoría o en todo el hogar. Cuenta lo pagado en el mes,
        sin importar quién pagó. Les avisamos al llegar al 80 % y si se pasan.
      </p>

      <p v-if="cargando" class="empty">Cargando…</p>
      <template v-else>
        <p v-if="!topes.length" class="empty">Todavía no hay topes.</p>
        <ul v-else class="list">
          <li v-for="t in topes" :key="t.id" class="list-row !py-2.5">
            <div class="min-w-0 flex-1" :class="{ 'opacity-60': !t.activo }">
              <form v-if="editandoTopeId === t.id" class="flex items-end gap-2" @submit.prevent="guardarTope(t)">
                <div class="flex-1">
                  <FormField v-model.number="editandoTopeMonto" :label="`Tope de ${nombreTope(t)}`" type="number" inputmode="numeric" />
                </div>
                <button type="submit" class="btn-primary btn-sm" :disabled="ocupado">Guardar</button>
                <button type="button" class="btn-ghost btn-sm" @click="editandoTopeId = null">Cancelar</button>
              </form>
              <p v-else class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-medium text-ink-primary">{{ nombreTope(t) }}</span>
                <span class="badge-accent">{{ formatCurrency(t.montoMensual) }} al mes</span>
                <span v-if="!t.activo" class="badge-warning">Inactivo</span>
              </p>
            </div>
            <div v-if="canEdit && editandoTopeId !== t.id" class="flex shrink-0 items-center gap-1">
              <label class="mr-1 inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-secondary">
                <input
                  type="checkbox"
                  class="checkbox"
                  :checked="t.activo"
                  :disabled="ocupado || (!t.activo && t.categoria && !t.categoria.activo)"
                  @change="cambiarTopeActivo(t)"
                />
                <span class="sr-only sm:not-sr-only">Activo</span>
              </label>
              <button type="button" class="btn-icon" :aria-label="`Cambiar el tope de ${nombreTope(t)}`" @click="empezarTope(t)">
                <AppIcon name="edit" class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="btn-icon hover:!text-negative hover:!bg-negative/10"
                :aria-label="`Eliminar el tope de ${nombreTope(t)}`"
                :disabled="ocupado"
                @click="borrarTope(t)"
              >
                <AppIcon name="trash" class="h-4 w-4" />
              </button>
            </div>
          </li>
        </ul>

        <form v-if="canEdit" class="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" @submit.prevent="agregarTope">
          <div>
            <label class="label" for="tope-categoria">Tope para</label>
            <select id="tope-categoria" v-model="nuevoTope.categoriaId" class="field">
              <option value="" disabled>Elige…</option>
              <option v-for="o in opcionesTope" :key="o.value" :value="o.value" :disabled="o.disabled">
                {{ o.label }}{{ o.disabled ? ' (ya tiene tope)' : '' }}
              </option>
            </select>
          </div>
          <FormField v-model.number="nuevoTope.montoMensual" label="Monto al mes" type="number" inputmode="numeric" placeholder="Ej. 1200000" />
          <button type="submit" class="btn-secondary" :disabled="ocupado || !nuevoTope.categoriaId || !nuevoTope.montoMensual">
            <AppIcon name="plus" class="h-4 w-4" /> Agregar tope
          </button>
        </form>
        <p v-if="canEdit && !activas.length" class="mt-2 text-xs text-ink-tertiary">
          Para topes por categoría, crea primero las categorías.
        </p>
      </template>
    </section>
  </div>
</template>
