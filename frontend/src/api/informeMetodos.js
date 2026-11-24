import { api } from './client.js';

export function obtenerInformeMetodo(metodoId, mes) {
  return api.get(`/api/informe-metodos/${metodoId}`, { params: mes ? { mes } : {} }).then((r) => r.data);
}
