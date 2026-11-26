import { api } from './client.js';

export function listarMetodosPago() {
  return api.get('/api/metodos-pago-personales').then((r) => r.data.metodos);
}

export function crearMetodoPago(payload) {
  return api.post('/api/metodos-pago-personales', payload).then((r) => r.data.metodo);
}

export function actualizarMetodoPago(id, payload) {
  return api.patch(`/api/metodos-pago-personales/${id}`, payload).then((r) => r.data.metodo);
}

/** Punto de partida: saldo de hoy de una cuenta o deuda de hoy de una tarjeta (0 lo quita). */
export function guardarSaldoInicial(id, payload) {
  return api.put(`/api/metodos-pago-personales/${id}/saldo-inicial`, payload).then((r) => r.data.saldoInicial);
}

export function registrarPagoTarjeta(id, payload) {
  return api.post(`/api/metodos-pago-personales/${id}/pagos`, payload).then((r) => r.data.pago);
}

export function eliminarMetodoPago(id) {
  return api.delete(`/api/metodos-pago-personales/${id}`);
}

/**
 * TRM oficial de una fecha (YYYY-MM-DD) o de hoy: { valor, vigencia, fuente }
 * (fuente 'oficial' o 'ultima_usada'), o null si no hay ninguna.
 */
export function obtenerTrm(fecha) {
  return api.get('/api/metodos-pago-personales/trm', { params: fecha ? { fecha } : {} }).then((r) => r.data.trm);
}
