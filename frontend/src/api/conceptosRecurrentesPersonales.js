import { api } from './client.js';

export function listarConceptosPersonales() {
  return api.get('/api/conceptos-recurrentes-personales').then((r) => r.data.conceptos);
}

export function crearConceptoPersonal(payload) {
  return api.post('/api/conceptos-recurrentes-personales', payload).then((r) => r.data.concepto);
}

export function actualizarConceptoPersonal(id, payload) {
  return api.patch(`/api/conceptos-recurrentes-personales/${id}`, payload).then((r) => r.data.concepto);
}

export function eliminarConceptoPersonal(id) {
  return api.delete(`/api/conceptos-recurrentes-personales/${id}`);
}

export function asignarPuntosCorteConcepto(id, puntoCorteIds) {
  return api
    .put(`/api/conceptos-recurrentes-personales/${id}/puntos-corte`, { puntoCorteIds })
    .then((r) => r.data.concepto);
}
