import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// Si la sesión se vence (401 en cualquier llamada que no sea la de saber
// quién soy o iniciar sesión), se limpia y se vuelve al inicio de sesión una
// sola vez, en vez de mostrar errores sueltos en cada bloque.
let redirigiendo = false;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const url = error?.config?.url ?? '';
    const esAuth = url.includes('/api/auth/');
    if (error?.response?.status === 401 && !esAuth && !redirigiendo) {
      redirigiendo = true;
      const [{ useAuthStore }, { router }] = await Promise.all([import('../stores/auth.js'), import('../router/index.js')]);
      useAuthStore().setUsuario(null);
      await router.push({ name: 'login', query: { motivo: 'sesion' } });
      redirigiendo = false;
    }
    return Promise.reject(error);
  },
);

export function extractErrorMessage(error) {
  if (error && !error.response && error.request) return 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.';
  if (error?.response?.status === 401) return 'Tu sesión terminó: vuelve a iniciar sesión.';
  const data = error?.response?.data;
  if (!data) return 'Ocurrió un error inesperado';
  if (Array.isArray(data.details) && data.details.length) {
    return data.details.map((d) => d.mensaje).join(' · ');
  }
  return data.error || 'Ocurrió un error inesperado';
}
