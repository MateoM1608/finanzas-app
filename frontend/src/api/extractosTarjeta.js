import { api } from './client.js';

const base = (metodoId) => `/api/extractos-tarjeta/${metodoId}`;

export function listarCiclosExtracto(metodoId) {
  return api.get(base(metodoId)).then((r) => r.data);
}

export function obtenerCicloExtracto(metodoId, fechaCorte) {
  return api.get(`${base(metodoId)}/ciclos/${fechaCorte}`).then((r) => r.data);
}

export function guardarExtracto(metodoId, fechaCorte, payload) {
  return api.put(`${base(metodoId)}/ciclos/${fechaCorte}`, payload).then((r) => r.data);
}

export function revisarExtracto(metodoId, fechaCorte, revisado) {
  return api.post(`${base(metodoId)}/ciclos/${fechaCorte}/revisar`, { revisado }).then((r) => r.data);
}

export function agregarAjusteExtracto(metodoId, fechaCorte, payload) {
  return api.post(`${base(metodoId)}/ciclos/${fechaCorte}/ajustes`, payload).then((r) => r.data);
}

export function resolverReclamoExtracto(ajusteId, estadoReclamo) {
  return api.patch(`/api/extractos-tarjeta/ajustes/${ajusteId}`, { estadoReclamo }).then((r) => r.data);
}

export function eliminarAjusteExtracto(ajusteId) {
  return api.delete(`/api/extractos-tarjeta/ajustes/${ajusteId}`).then((r) => r.data);
}
