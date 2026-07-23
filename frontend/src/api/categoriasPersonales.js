import { api } from './client.js';

export function listarCategorias() {
  return api.get('/api/categorias-personales').then((r) => r.data.categorias);
}

export function crearCategoria(payload) {
  return api.post('/api/categorias-personales', payload).then((r) => r.data.categoria);
}

export function actualizarCategoria(id, payload) {
  return api.patch(`/api/categorias-personales/${id}`, payload).then((r) => r.data.categoria);
}

export function eliminarCategoria(id) {
  return api.delete(`/api/categorias-personales/${id}`);
}
