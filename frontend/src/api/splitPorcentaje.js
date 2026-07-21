import { api } from './client.js';

export function obtenerSplit() {
  return api.get('/api/split-porcentaje').then((r) => r.data.split);
}

export function actualizarSplit(splits) {
  return api.put('/api/split-porcentaje', { splits }).then((r) => r.data.split);
}
