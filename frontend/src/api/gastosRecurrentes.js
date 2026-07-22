import { api } from './client.js';

export function obtenerPeriodoActual() {
  return api.get('/api/gastos-recurrentes/periodo-actual').then((r) => r.data);
}
