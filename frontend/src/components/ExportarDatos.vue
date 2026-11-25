<script setup>
import { ref, computed } from 'vue';
import { api, extractErrorMessage } from '../api/client.js';
import { hoyISO } from '../utils/format.js';
import AlertError from './AlertError.vue';
import AppIcon from './AppIcon.vue';

/**
 * Descarga tus datos en Excel (XLSX: una hoja por tema) o CSV (una tabla).
 * Solo tus datos personales y los de tu hogar; nada se guarda en el servidor.
 */
const props = defineProps({
  desdeInicial: { type: String, default: '' },
  hastaInicial: { type: String, default: '' },
});

const TABLAS = [
  { valor: 'movimientos', label: 'Movimientos (gastos e ingresos)' },
  { valor: 'consumo', label: 'Consumo por mes y categoría' },
  { valor: 'hogar', label: 'Gastos del hogar' },
  { valor: 'cuadres', label: 'Cuadres' },
  { valor: 'prestamos', label: 'Préstamos (cuotas)' },
  { valor: 'ahorros', label: 'Inversiones y ahorros' },
];

const formato = ref('xlsx');
const tabla = ref('movimientos');
const desde = ref(props.desdeInicial);
const hasta = ref(props.hastaInicial);
const descargando = ref(false);
const error = ref('');
const listo = ref('');

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function rango(tipo) {
  const hoy = new Date();
  if (tipo === 'mes') {
    desde.value = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    hasta.value = iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
  } else if (tipo === 'mesAnterior') {
    desde.value = iso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
    hasta.value = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0));
  } else if (tipo === 'anio') {
    desde.value = `${hoy.getFullYear()}-01-01`;
    hasta.value = hoyISO();
  } else {
    desde.value = '';
    hasta.value = '';
  }
}

const descripcionRango = computed(() => {
  if (!desde.value && !hasta.value) return 'Todo el historial';
  return `${desde.value || 'el inicio'} → ${hasta.value || 'hoy'}`;
});

function nombreArchivo(cabecera, defecto) {
  const m = /filename="([^"]+)"/.exec(cabecera ?? '');
  return m ? m[1] : defecto;
}

async function descargar() {
  error.value = '';
  listo.value = '';
  descargando.value = true;
  try {
    const params = { formato: formato.value };
    if (formato.value === 'csv') params.tabla = tabla.value;
    if (desde.value) params.desde = desde.value;
    if (hasta.value) params.hasta = hasta.value;
    const r = await api.get('/api/exportar', { params, responseType: 'blob' });
    const nombre = nombreArchivo(r.headers['content-disposition'], `finanzas.${formato.value}`);
    const url = URL.createObjectURL(r.data);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    listo.value = `Descargado: ${nombre}`;
  } catch (e) {
    // Con responseType blob, el mensaje de error del backend llega como Blob.
    if (e?.response?.data instanceof Blob) {
      try {
        const cuerpo = JSON.parse(await e.response.data.text());
        error.value = cuerpo.error ?? cuerpo.message ?? 'No se pudo exportar';
      } catch {
        error.value = 'No se pudo exportar';
      }
    } else {
      error.value = extractErrorMessage(e);
    }
  } finally {
    descargando.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <AlertError :message="error" />

    <div>
      <p class="label">Formato</p>
      <div class="tabs" role="radiogroup" aria-label="Formato">
        <button type="button" role="radio" class="tab" :class="{ 'tab-active': formato === 'xlsx' }" :aria-checked="formato === 'xlsx'" @click="formato = 'xlsx'">
          Excel (.xlsx)
        </button>
        <button type="button" role="radio" class="tab" :class="{ 'tab-active': formato === 'csv' }" :aria-checked="formato === 'csv'" @click="formato = 'csv'">
          CSV
        </button>
      </div>
      <p class="mt-1.5 text-xs text-ink-tertiary">
        <template v-if="formato === 'xlsx'">Un archivo con una hoja por tema: movimientos, consumo, hogar, cuadres, préstamos e inversiones y ahorros.</template>
        <template v-else>Un CSV tiene una sola tabla: elige cuál. Se abre en Excel o Google Sheets (separado por punto y coma).</template>
      </p>
    </div>

    <div v-if="formato === 'csv'">
      <label class="label" for="exportar-tabla">Qué exportar</label>
      <select id="exportar-tabla" v-model="tabla" class="field">
        <option v-for="t in TABLAS" :key="t.valor" :value="t.valor">{{ t.label }}</option>
      </select>
    </div>

    <div>
      <p class="label">Fechas</p>
      <div class="grid grid-cols-2 gap-2">
        <label class="sr-only" for="exportar-desde">Desde</label>
        <input id="exportar-desde" v-model="desde" type="date" class="field" aria-label="Desde" />
        <label class="sr-only" for="exportar-hasta">Hasta</label>
        <input id="exportar-hasta" v-model="hasta" type="date" class="field" aria-label="Hasta" />
      </div>
      <div class="mt-2 flex flex-wrap gap-1.5">
        <button type="button" class="btn-ghost btn-sm" @click="rango('mes')">Este mes</button>
        <button type="button" class="btn-ghost btn-sm" @click="rango('mesAnterior')">Mes anterior</button>
        <button type="button" class="btn-ghost btn-sm" @click="rango('anio')">Este año</button>
        <button type="button" class="btn-ghost btn-sm" @click="rango('todo')">Todo</button>
      </div>
      <p class="mt-1.5 text-xs text-ink-tertiary">{{ descripcionRango }}. Los préstamos salen con todas sus cuotas.</p>
    </div>

    <p class="text-xs text-ink-tertiary">Solo salen tus datos y los de tu hogar; las cuentas con que pagó otro miembro no aparecen. Nada queda guardado en el servidor.</p>

    <div class="flex items-center justify-end gap-3">
      <span v-if="listo" class="text-[13px] text-positive">{{ listo }}</span>
      <button type="button" class="btn-primary" :disabled="descargando" @click="descargar">
        <AppIcon name="arrowDownLeft" class="h-4 w-4" />
        {{ descargando ? 'Preparando…' : 'Descargar' }}
      </button>
    </div>
  </div>
</template>
