import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

export function extractErrorMessage(error) {
  const data = error?.response?.data;
  if (!data) return 'Ocurrió un error inesperado';
  if (Array.isArray(data.details) && data.details.length) {
    return data.details.map((d) => d.mensaje).join(' · ');
  }
  return data.error || 'Ocurrió un error inesperado';
}
