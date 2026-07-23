import { api } from './client.js';

export function listarMetodosPago() {
  return api.get('/api/metodos-pago-personales').then((r) => r.data.metodos);
}

export function crearMetodoPago(payload) {
  return api.post('/api/metodos-pago-personales', payload).then((r) => r.data.metodo);
}

export function actualizarMetodoPago(id, payload) {
  return api.patch(`/api/metodos-pago-personales/${id}`, payload).then((r) => r.data.metodo);
}

export function eliminarMetodoPago(id) {
  return api.delete(`/api/metodos-pago-personales/${id}`);
}
