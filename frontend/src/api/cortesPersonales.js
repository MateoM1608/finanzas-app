import { api } from './client.js';

export function listarCortesPersonales() {
  return api.get('/api/cortes-personales').then((r) => r.data.cortes);
}

export function obtenerCortePersonalAbierto() {
  return api.get('/api/cortes-personales/actual').then((r) => r.data.corte);
}

export function iniciarCortePersonal() {
  return api.post('/api/cortes-personales').then((r) => r.data);
}

export function togglearItemPersonal(corteId, itemId, incluido) {
  return api
    .patch(`/api/cortes-personales/${corteId}/items/${itemId}`, { incluido })
    .then((r) => r.data.corte);
}

export function actualizarItemCortePersonal(corteId, itemId, monto) {
  return api
    .patch(`/api/cortes-personales/${corteId}/items/${itemId}`, { monto })
    .then((r) => r.data.corte);
}

export function confirmarCortePersonal(corteId) {
  return api.post(`/api/cortes-personales/${corteId}/confirmar`).then((r) => r.data.corte);
}
