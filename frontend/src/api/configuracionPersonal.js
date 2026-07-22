import { api } from './client.js';

export function obtenerConfiguracionPersonal() {
  return api.get('/api/configuracion-personal').then((r) => r.data);
}

export function actualizarFrecuenciaPersonal(frecuenciaCortePersonal) {
  return api.patch('/api/configuracion-personal', { frecuenciaCortePersonal }).then((r) => r.data);
}

export function actualizarPuntosCortePersonal(puntos) {
  return api.put('/api/configuracion-personal/puntos-corte', { puntos }).then((r) => r.data.puntosCorte);
}
