import { api } from './client.js';

export function listarLimites() {
  return api.get('/api/limites-personales').then((r) => r.data.limites);
}

export function obtenerResumenLimites() {
  return api.get('/api/limites-personales/resumen').then((r) => r.data);
}

export function crearLimite(payload) {
  return api.post('/api/limites-personales', payload).then((r) => r.data.limite);
}

export function actualizarLimite(id, payload) {
  return api.patch(`/api/limites-personales/${id}`, payload).then((r) => r.data.limite);
}

export function eliminarLimite(id) {
  return api.delete(`/api/limites-personales/${id}`);
}
