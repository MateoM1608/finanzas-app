import { api } from './client.js';

export function listarInversiones() {
  return api.get('/api/inversiones').then((r) => r.data);
}
export function crearInversion(payload) {
  return api.post('/api/inversiones', payload).then((r) => r.data.inversion);
}
export function actualizarInversion(id, payload) {
  return api.patch(`/api/inversiones/${id}`, payload).then((r) => r.data.inversion);
}
export function eliminarInversion(id) {
  return api.delete(`/api/inversiones/${id}`);
}
export function registrarMovimientoInversion(id, payload) {
  return api.post(`/api/inversiones/${id}/movimientos`, payload).then((r) => r.data.inversion);
}
export function eliminarMovimientoInversion(id, movId) {
  return api.delete(`/api/inversiones/${id}/movimientos/${movId}`).then((r) => r.data.inversion);
}
export function registrarValoracion(id, payload) {
  return api.post(`/api/inversiones/${id}/valoraciones`, payload).then((r) => r.data.inversion);
}
export function eliminarValoracion(id, valId) {
  return api.delete(`/api/inversiones/${id}/valoraciones/${valId}`).then((r) => r.data.inversion);
}
