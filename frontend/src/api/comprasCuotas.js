import { api } from './client.js';

// --- Personales ---
export function listarComprasPersonales() {
  return api.get('/api/compras-cuotas-personales').then((r) => r.data.compras);
}

export function crearCompraPersonal(payload) {
  return api.post('/api/compras-cuotas-personales', payload).then((r) => r.data.compra);
}

export function eliminarCompraPersonal(id) {
  return api.delete(`/api/compras-cuotas-personales/${id}`);
}

/** Fecha sugerida (ISO) de la primera cuota según el día de corte/pago del método. */
export function sugerirPrimeraCuota(fechaCompra, metodoPagoId) {
  const params = { fechaCompra };
  if (metodoPagoId) params.metodoPagoId = metodoPagoId;
  return api
    .get('/api/compras-cuotas-personales/sugerir-primera-cuota', { params })
    .then((r) => r.data.fecha.slice(0, 10));
}

// --- Hogar ---
export function listarComprasHogar() {
  return api.get('/api/compras-cuotas-hogar').then((r) => r.data.compras);
}

export function crearCompraHogar(payload) {
  return api.post('/api/compras-cuotas-hogar', payload).then((r) => r.data.compra);
}

export function eliminarCompraHogar(id) {
  return api.delete(`/api/compras-cuotas-hogar/${id}`);
}
