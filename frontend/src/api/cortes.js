import { api } from './client.js';

export function listarCortes() {
  return api.get('/api/cortes').then((r) => r.data.cortes);
}

export function obtenerCorteAbierto() {
  return api.get('/api/cortes/actual').then((r) => r.data.corte);
}

export function obtenerCorte(id) {
  return api.get(`/api/cortes/${id}`).then((r) => r.data.corte);
}

export function iniciarCorte() {
  return api.post('/api/cortes').then((r) => r.data);
}

export function togglearItem(corteId, itemId, incluido) {
  return api
    .patch(`/api/cortes/${corteId}/items/${itemId}`, { incluido })
    .then((r) => r.data.corte);
}

export function actualizarItemCorte(corteId, itemId, payload) {
  return api
    .patch(`/api/cortes/${corteId}/items/${itemId}`, payload)
    .then((r) => r.data.corte);
}

export function confirmarCorte(corteId) {
  return api.post(`/api/cortes/${corteId}/confirmar`).then((r) => r.data.corte);
}
