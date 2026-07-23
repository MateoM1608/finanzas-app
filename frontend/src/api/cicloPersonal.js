import { api } from './client.js';

export function obtenerCicloPersonal() {
  return api.get('/api/ciclo-personal').then((r) => r.data);
}

export function actualizarCicloPersonal(frecuenciaCicloPersonal) {
  return api.patch('/api/ciclo-personal', { frecuenciaCicloPersonal }).then((r) => r.data);
}
