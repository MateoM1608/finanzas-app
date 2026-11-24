import { api } from './client.js';

export function obtenerCuentasHogar() {
  return api.get('/api/cuentas-hogar').then((r) => r.data);
}

export function pagarCuota(id, payload) {
  return api.post(`/api/cuentas-hogar/${id}/pagar`, payload).then((r) => r.data.cuota);
}

export function deshacerPagoCuota(id) {
  return api.post(`/api/cuentas-hogar/${id}/deshacer-pago`).then((r) => r.data.cuota);
}
