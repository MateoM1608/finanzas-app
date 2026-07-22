const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatCurrency(monto) {
  return currencyFormatter.format(monto);
}

export function formatDate(fecha) {
  return dateFormatter.format(new Date(fecha));
}

export function formatReparto(repartos) {
  if (!repartos?.length) return '(sin definir)';
  return repartos.map((r) => `${r.usuario.nombre} ${formatCurrency(r.monto)}`).join(' · ');
}

/**
 * Resume una lista de balances de corte [{ usuario: { nombre }, balance }] en
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
