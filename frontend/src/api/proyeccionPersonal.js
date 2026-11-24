import { api } from './client.js';

export function obtenerProyeccion(meses = 6) {
  return api.get('/api/proyeccion-personal', { params: { meses } }).then((r) => r.data);
}
