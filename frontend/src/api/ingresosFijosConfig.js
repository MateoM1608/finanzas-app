import { api } from './client.js';

export function listarIngresosFijos() {
  return api.get('/api/ingresos-fijos-config').then((r) => r.data.ingresosFijos);
}

export function crearIngresoFijo(payload) {
  return api.post('/api/ingresos-fijos-config', payload).then((r) => r.data.ingresoFijo);
}

export function actualizarIngresoFijo(id, payload) {
  return api.patch(`/api/ingresos-fijos-config/${id}`, payload).then((r) => r.data.ingresoFijo);
}

export function eliminarIngresoFijo(id) {
  return api.delete(`/api/ingresos-fijos-config/${id}`);
}
