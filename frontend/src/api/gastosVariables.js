import { api } from './client.js';

export function listarGastosVariables() {
  return api.get('/api/gastos-variables').then((r) => r.data.gastos);
}

export function crearGastoVariable(payload) {
  return api.post('/api/gastos-variables', payload).then((r) => r.data.gasto);
}

export function actualizarGastoVariable(id, payload) {
  return api.patch(`/api/gastos-variables/${id}`, payload).then((r) => r.data.gasto);
}

export function eliminarGastoVariable(id) {
  return api.delete(`/api/gastos-variables/${id}`);
}

export function pagarCuotaVariable(id, payload = {}) {
  return api.post(`/api/gastos-variables/${id}/pagar`, payload).then((r) => r.data.gasto);
}

export function deshacerPagoCuotaVariable(id) {
  return api.post(`/api/gastos-variables/${id}/deshacer-pago`).then((r) => r.data.gasto);
}
