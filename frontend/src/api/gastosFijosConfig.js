import { api } from './client.js';

export function listarGastosFijos() {
  return api.get('/api/gastos-fijos-config').then((r) => r.data.gastosFijos);
}

export function crearGastoFijo(payload) {
  return api.post('/api/gastos-fijos-config', payload).then((r) => r.data.gastoFijo);
}

export function actualizarGastoFijo(id, payload) {
  return api.patch(`/api/gastos-fijos-config/${id}`, payload).then((r) => r.data.gastoFijo);
}

export function eliminarGastoFijo(id) {
  return api.delete(`/api/gastos-fijos-config/${id}`);
}
