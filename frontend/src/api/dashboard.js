import { api } from './client.js';

export function obtenerDashboardPersonal() {
  return api.get('/api/dashboard/personal').then((r) => r.data);
}

export function obtenerDashboardHogar() {
  return api.get('/api/dashboard/hogar').then((r) => r.data);
}
