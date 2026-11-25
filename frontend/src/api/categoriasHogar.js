import { api } from './client.js';

// Categorías del hogar (compartidas) y topes mensuales (entrega E4).
export const listarCategoriasHogar = () => api.get('/api/categorias-hogar').then((r) => r.data.categorias);
export const crearCategoriaHogar = (payload) => api.post('/api/categorias-hogar', payload).then((r) => r.data.categoria);
export const crearCategoriasBasicas = () => api.post('/api/categorias-hogar/basicas').then((r) => r.data.categorias);
export const actualizarCategoriaHogar = (id, payload) =>
  api.patch(`/api/categorias-hogar/${id}`, payload).then((r) => r.data.categoria);
export const eliminarCategoriaHogar = (id) => api.delete(`/api/categorias-hogar/${id}`);
export const gastoPorCategoriaHogar = (mes) =>
  api.get('/api/categorias-hogar/gasto', { params: mes ? { mes } : {} }).then((r) => r.data);

export const listarTopesHogar = () => api.get('/api/topes-hogar').then((r) => r.data.topes);
export const resumenTopesHogar = () => api.get('/api/topes-hogar/resumen').then((r) => r.data);
export const crearTopeHogar = (payload) => api.post('/api/topes-hogar', payload).then((r) => r.data.tope);
export const actualizarTopeHogar = (id, payload) => api.patch(`/api/topes-hogar/${id}`, payload).then((r) => r.data.tope);
export const eliminarTopeHogar = (id) => api.delete(`/api/topes-hogar/${id}`);
