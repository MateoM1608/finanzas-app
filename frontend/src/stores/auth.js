import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../api/client.js';

export const useAuthStore = defineStore('auth', () => {
  const usuario = ref(null);
  const ready = ref(false);

  const isAuthenticated = computed(() => usuario.value !== null);
  const hasHogar = computed(() => Boolean(usuario.value?.hogarId));

  async function fetchMe() {
    try {
      const { data } = await api.get('/api/auth/me');
      usuario.value = data.usuario;
    } catch {
      usuario.value = null;
    } finally {
      ready.value = true;
    }
  }

  async function register(payload) {
    const { data } = await api.post('/api/auth/register', payload);
    usuario.value = data.usuario;
  }

  async function login(payload) {
    const { data } = await api.post('/api/auth/login', payload);
    usuario.value = data.usuario;
  }

  async function logout() {
    await api.post('/api/auth/logout');
    usuario.value = null;
  }

  function setUsuario(nuevoUsuario) {
    usuario.value = nuevoUsuario;
  }

  return { usuario, ready, isAuthenticated, hasHogar, fetchMe, register, login, logout, setUsuario };
});
