import { api } from './client.js';

export function obtenerPeriodoActual() {
  return api.get('/api/gastos-recurrentes/periodo-actual').then((r) => r.data);
}

export function actualizarInstancia(id, payload) {
  return api.patch(`/api/gastos-recurrentes/instancias/${id}`, payload).then((r) => r.data.instancia);
}
