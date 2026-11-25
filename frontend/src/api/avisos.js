import { api } from './client.js';

export function obtenerAvisos() {
  return api.get('/api/avisos').then((r) => r.data);
}
export function listarNotificaciones() {
  return api.get('/api/notificaciones').then((r) => r.data);
}
export function contarNotificaciones() {
  return api.get('/api/notificaciones/resumen').then((r) => r.data.noLeidas);
}
export function marcarNotificacion(id, leida = true) {
  return api.patch(`/api/notificaciones/${id}`, { leida }).then((r) => r.data.notificacion);
}
export function marcarTodasLeidas() {
  return api.post('/api/notificaciones/leer-todas');
}
