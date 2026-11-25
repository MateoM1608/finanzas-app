import { api } from './client.js';

export function listarMetasHogar() {
  return api.get('/api/metas-hogar').then((r) => r.data.metas);
}
export function crearMetaHogar(payload) {
  return api.post('/api/metas-hogar', payload).then((r) => r.data.meta);
}
export function actualizarMetaHogar(id, payload) {
  return api.patch(`/api/metas-hogar/${id}`, payload).then((r) => r.data.meta);
}
export function eliminarMetaHogar(id) {
  return api.delete(`/api/metas-hogar/${id}`);
}
export function registrarMovimientoMeta(id, payload) {
  return api.post(`/api/metas-hogar/${id}/movimientos`, payload).then((r) => r.data.meta);
}
export function eliminarMovimientoMeta(id, movId) {
  return api.delete(`/api/metas-hogar/${id}/movimientos/${movId}`).then((r) => r.data.meta);
}
