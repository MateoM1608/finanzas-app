import { api } from './client.js';

export function listarGastos() {
  return api.get('/api/gastos-personales').then((r) => r.data.gastos);
}

export function crearGasto(payload) {
  return api.post('/api/gastos-personales', payload).then((r) => r.data.gasto);
}

export function actualizarGasto(id, payload) {
  return api.patch(`/api/gastos-personales/${id}`, payload).then((r) => r.data.gasto);
}

export function eliminarGasto(id) {
  return api.delete(`/api/gastos-personales/${id}`);
}

export function cambiarMetodoGasto(id, metodoPagoId) {
  return api.patch(`/api/gastos-personales/${id}/metodo`, { metodoPagoId }).then((r) => r.data.gasto);
}

// Editar un gasto suelto que pasa a ser compra a cuotas (crea la compra y borra el gasto).
export function convertirGastoACompra(id, payload) {
  return api.post(`/api/gastos-personales/${id}/convertir-a-compra`, payload).then((r) => r.data.compra);
}
