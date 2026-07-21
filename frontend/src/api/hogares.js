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
