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
