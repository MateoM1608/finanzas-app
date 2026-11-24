import { api } from './client.js';

export function listarCuadres() {
  return api.get('/api/cuadres').then((r) => r.data.cuadres);
}

export function obtenerCuadreAbierto() {
  return api.get('/api/cuadres/actual').then((r) => r.data.cuadre);
}

export function iniciarCuadre() {
  return api.post('/api/cuadres').then((r) => r.data);
}

export function marcarItemCuadre(cuadreId, itemId, incluido) {
  return api.patch(`/api/cuadres/${cuadreId}/items/${itemId}`, { incluido }).then((r) => r.data.cuadre);
}

export function descartarCuadre(cuadreId) {
  return api.delete(`/api/cuadres/${cuadreId}`);
}

export function confirmarCuadre(cuadreId, metodoPagoId) {
  return api.post(`/api/cuadres/${cuadreId}/confirmar`, { metodoPagoId }).then((r) => r.data.cuadre);
}

export function obtenerSaldoHogar() {
  return api.get('/api/cuadres/saldo').then((r) => r.data);
}

export function obtenerResumenHogar() {
  return api.get('/api/cuadres/resumen').then((r) => r.data);
}
