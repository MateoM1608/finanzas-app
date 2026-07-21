import { api } from './client.js';

export function listarGastos() {
  return api.get('/api/gastos-personales').then((r) => r.data.gastos);
}

export function crearGasto(payload) {
  return api.post('/api/gastos-personales', payload).then((r) => r.data.gasto);
}

export function eliminarGasto(id) {
  return api.delete(`/api/gastos-personales/${id}`);
}
