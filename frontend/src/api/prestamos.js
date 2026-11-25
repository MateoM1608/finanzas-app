import { api } from './client.js';

export function listarPrestamos() {
  return api.get('/api/prestamos').then((r) => r.data);
}

export function crearPrestamo(payload) {
  return api.post('/api/prestamos', payload).then((r) => r.data.prestamo);
}

export function actualizarPrestamo(id, payload) {
  return api.patch(`/api/prestamos/${id}`, payload).then((r) => r.data.prestamo);
}

export function eliminarPrestamo(id) {
  return api.delete(`/api/prestamos/${id}`);
}

export function pagarCuotaPrestamo(id, numero, payload) {
  return api.post(`/api/prestamos/${id}/cuotas/${numero}/pagar`, payload).then((r) => r.data.prestamo);
}

export function deshacerPagoCuotaPrestamo(id, numero) {
  return api.post(`/api/prestamos/${id}/cuotas/${numero}/deshacer-pago`).then((r) => r.data.prestamo);
}

export function abonarPrestamo(id, payload) {
  return api.post(`/api/prestamos/${id}/abonos`, payload).then((r) => r.data.prestamo);
}

export function eliminarAbonoPrestamo(id, abonoId) {
  return api.delete(`/api/prestamos/${id}/abonos/${abonoId}`).then((r) => r.data.prestamo);
}
