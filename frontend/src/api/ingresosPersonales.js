import { api } from './client.js';

export function listarIngresos() {
  return api.get('/api/ingresos-personales').then((r) => r.data.ingresos);
}

export function crearIngreso(payload) {
  return api.post('/api/ingresos-personales', payload).then((r) => r.data.ingreso);
}

export function actualizarIngreso(id, payload) {
  return api.patch(`/api/ingresos-personales/${id}`, payload).then((r) => r.data.ingreso);
}

export function eliminarIngreso(id) {
  return api.delete(`/api/ingresos-personales/${id}`);
}
