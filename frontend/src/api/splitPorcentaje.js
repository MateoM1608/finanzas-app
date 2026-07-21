import { api } from './client.js';

export function obtenerSplit(contexto = 'general') {
  return api.get('/api/split-porcentaje', { params: { contexto } }).then((r) => r.data.split);
}

export function actualizarSplit(splits, contexto = 'general') {
  return api
    .put('/api/split-porcentaje', { splits }, { params: { contexto } })
    .then((r) => r.data.split);
}
