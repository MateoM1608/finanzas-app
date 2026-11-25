const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const localDateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatCurrency(monto) {
  // Signo menos tipográfico (−) en vez del guion: se lee mejor en montos.
  return currencyFormatter.format(monto).replace('-', '−');
}

/**
 * Fecha de calendario (fecha de un gasto, fecha de una cuota…). El
 * backend las guarda como medianoche UTC de ese día, así que se formatean en
 * UTC: formateadas en hora de Colombia (UTC-5) salían un día antes.
 */
export function formatDate(fecha) {
  return dateFormatter.format(new Date(fecha));
}

/** Momento real (ej. cuándo se cerró un cuadre): en la hora local del navegador. */
export function formatDateLocal(fecha) {
  return localDateFormatter.format(new Date(fecha));
}

/**
 * Hoy como 'YYYY-MM-DD' en la hora local — para el valor por defecto de un
 * <input type="date">. `toISOString()` da la fecha UTC, que desde las 7pm en
 * Colombia ya es mañana.
 */
export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatReparto(repartos) {
  if (!repartos?.length) return '(sin definir)';
  return repartos.map((r) => `${r.usuario.nombre} ${formatCurrency(r.monto)}`).join(' · ');
}

/**
 * Resume una lista de balances de cuadre [{ usuario: { nombre }, balance }] en
 * texto legible. Con 2 miembros da el formato "X le debe $N a Y"; con más,
 * lista el balance de cada quien.
 */
export function formatearBalances(balances) {
  if (!balances.length) return '';

  if (balances.length === 2) {
    const [a, b] = balances;
    if (a.balance === 0 && b.balance === 0) return 'Todo cuadrado, nadie debe nada';
    const deudor = a.balance < 0 ? a : b;
    const acreedor = a.balance < 0 ? b : a;
    return `${deudor.usuario.nombre} le debe ${formatCurrency(Math.abs(deudor.balance))} a ${acreedor.usuario.nombre}`;
  }

  return balances
    .map((b) => `${b.usuario.nombre}: ${b.balance >= 0 ? '+' : ''}${formatCurrency(b.balance)}`)
    .join(' · ');
}

function textoDia(dia) {
  return dia == null ? 'último día' : `día ${dia}`;
}

/** Describe el calendario de una cuenta fija: "Cada mes, día 30" / "Cada quincena, día 15 y último día". */
export function describirCalendario(cuenta) {
  if (cuenta.frecuencia === 'quincenal') {
    return `Cada quincena, ${textoDia(cuenta.diaMes ?? 15)} y ${textoDia(cuenta.diaMes2)}`;
  }
  return `Cada mes, ${textoDia(cuenta.diaMes)}`;
}

export const TIPOS_METODO = [
  { valor: 'efectivo', label: 'Efectivo' },
  { valor: 'debito', label: 'Débito o cuenta' },
  { valor: 'tarjeta_credito', label: 'Tarjeta de crédito' },
  { valor: 'credito_almacen', label: 'Crédito de almacén' },
  { valor: 'otro', label: 'Otro' },
];

/** "Tarjeta de crédito ··1234 · corte 25 · pago 10" */
export function describirMetodo(metodo) {
  const partes = [TIPOS_METODO.find((t) => t.valor === metodo.tipo)?.label ?? 'Otro'];
  if (metodo.ultimos4) partes[0] += ` ··${metodo.ultimos4}`;
  if (metodo.diaCorte) partes.push(`corte ${metodo.diaCorte}`);
  if (metodo.diaPago) partes.push(`pago ${metodo.diaPago}`);
  if (metodo.cupo) partes.push(`cupo ${formatCurrency(metodo.cupo)}`);
  if (metodo.tasaMensual > 0) partes.push(formatTasa(metodo.tasaMensual));
  return partes.join(' · ');
}

/** Modo de cobro sugerido para una compra a cuotas según el método. */
export function modoCobroSugerido(metodo) {
  return metodo && (metodo.tipo === 'credito_almacen' || metodo.tipo === 'efectivo') ? 'manual' : 'automatico';
}

/** "2,1 % mensual" */
export function formatTasa(tasa) {
  return `${String(tasa).replace('.', ',')} % mensual`;
}
