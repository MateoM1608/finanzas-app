// Etiquetas e íconos de los movimientos de caja que vienen de otras pantallas
// (hogar, cuadres, tarjetas, préstamos, inversiones, ahorros).
export const ORIGEN_MOVIMIENTO = {
  pago_hogar: { badge: 'Pago del hogar', icono: 'home' },
  liquidacion_hogar: { badge: 'Cuadre', icono: 'scale' },
  pago_tarjeta: { badge: 'Pago de tarjeta', icono: 'creditCard' },
  abono_prestamo: { badge: 'Abono a préstamo', icono: 'receipt' },
  desembolso_prestamo: { badge: 'Desembolso', icono: 'receipt' },
  aporte_inversion: { badge: 'Inversión', icono: 'trendingUp' },
  retiro_inversion: { badge: 'Inversión', icono: 'trendingUp' },
  aporte_meta_hogar: { badge: 'Meta del hogar', icono: 'piggy' },
  retiro_meta_hogar: { badge: 'Meta del hogar', icono: 'piggy' },
  aporte_ahorro: { badge: 'Ahorro', icono: 'piggy' },
  retiro_ahorro: { badge: 'Ahorro', icono: 'piggy' },
  saldo_inicial: { badge: 'Punto de partida', icono: 'wallet' },
};

export function esDelHogar(mov) {
  return mov.origen === 'pago_hogar' || mov.origen === 'liquidacion_hogar';
}

// Se manejan desde Patrimonio (préstamos, inversiones, ahorros), la meta del
// hogar o la cuenta (saldo inicial).
const ORIGENES_DE_OTRA_PANTALLA = [
  'abono_prestamo',
  'aporte_inversion',
  'retiro_inversion',
  'aporte_meta_hogar',
  'retiro_meta_hogar',
  'aporte_ahorro',
  'retiro_ahorro',
  'saldo_inicial',
];
export function esDeOtraPantalla(mov) {
  return Boolean(mov.prestamoId) || ORIGENES_DE_OTRA_PANTALLA.includes(mov.origen);
}

export function tituloMovimiento(mov, tipo) {
  return mov.descripcion || mov.categoria?.nombre || (tipo === 'ingreso' ? 'Ingreso personal' : 'Gasto personal');
}
