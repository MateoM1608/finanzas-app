import { api } from './client.js';

export function obtenerResumenPersonal() {
  return api.get('/api/resumen-personal').then((r) => r.data);
}
