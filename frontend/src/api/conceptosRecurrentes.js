import { api } from './client.js';

export function listarConceptos() {
  return api.get('/api/conceptos-recurrentes').then((r) => r.data.conceptos);
}

export function crearConcepto(payload) {
  return api.post('/api/conceptos-recurrentes', payload).then((r) => r.data.concepto);
}

export function actualizarConcepto(id, payload) {
  return api.patch(`/api/conceptos-recurrentes/${id}`, payload).then((r) => r.data.concepto);
}

export function asignarPuntosCorte(id, puntoCorteIds) {
  return api
    .put(`/api/conceptos-recurrentes/${id}/puntos-corte`, { puntoCorteIds })
    .then((r) => r.data.concepto);
}

export function eliminarConcepto(id) {
  return api.delete(`/api/conceptos-recurrentes/${id}`);
}
