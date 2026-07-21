import { api } from './client.js';

export function crearHogar(payload) {
  return api.post('/api/hogares', payload).then((r) => r.data);
}

export function unirseHogar(codigo) {
  return api.post('/api/hogares/join', { codigo }).then((r) => r.data);
}

export function generarInvitacion() {
  return api.post('/api/hogares/invitaciones').then((r) => r.data);
}

export function obtenerHogarActual() {
  return api.get('/api/hogares/actual').then((r) => r.data);
}

export function actualizarHogar(payload) {
  return api.patch('/api/hogares', payload).then((r) => r.data);
}

export function actualizarPuntosCorte(puntos) {
  return api.put('/api/hogares/puntos-corte', { puntos }).then((r) => r.data.puntosCorte);
}

export function listarMiembros() {
  return api.get('/api/hogares/miembros').then((r) => r.data.miembros);
}

export function actualizarPermisosMiembro(id, permisos) {
  return api.patch(`/api/hogares/miembros/${id}/permisos`, permisos).then((r) => r.data.miembro);
}

export function transferirAdmin(nuevoAdminId) {
  return api.post('/api/hogares/transferir-admin', { nuevoAdminId }).then((r) => r.data.miembros);
}
