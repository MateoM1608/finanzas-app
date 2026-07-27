import { api } from './client.js';

export function listarAhorros() {
  return api.get('/api/ahorros-personales').then((r) => r.data.ahorros);
}

export function obtenerResumenAhorros() {
  return api.get('/api/ahorros-personales/resumen').then((r) => r.data);
}

export function crearAhorro(payload) {
  return api.post('/api/ahorros-personales', payload).then((r) => r.data.ahorro);
}

export function actualizarAhorro(id, payload) {
  return api.patch(`/api/ahorros-personales/${id}`, payload).then((r) => r.data.ahorro);
}

export function eliminarAhorro(id) {
  return api.delete(`/api/ahorros-personales/${id}`);
}

export function registrarAporte(id, payload) {
  return api.post(`/api/ahorros-personales/${id}/transacciones`, payload).then((r) => r.data.transaccion);
}
