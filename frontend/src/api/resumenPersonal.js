import { api } from './client.js';

// ciclo: 0 = el actual, -1 = el anterior…
export function obtenerResumenPersonal(ciclo = 0) {
  return api.get('/api/resumen-personal', { params: ciclo ? { ciclo } : {} }).then((r) => r.data);
}
