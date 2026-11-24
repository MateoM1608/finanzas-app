import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // En desarrollo, /api va al backend local: mismo origen que en Vercel
    // (donde lo resuelve el rewrite de vercel.json), así la cookie de sesión
    // se comporta igual. Con VITE_API_URL vacío el cliente usa rutas relativas.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
