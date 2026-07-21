import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/registro',
    name: 'register',
    component: () => import('../views/RegisterView.vue'),
    meta: { guest: true },
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('../views/OnboardingView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/',
    name: 'panel-personal',
    component: () => import('../views/PersonalPanelView.vue'),
    meta: { requiresAuth: true, requiresHogar: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { requiresAuth: true, requiresHogar: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.ready) {
    await auth.fetchMe();
  }

  if (to.meta.guest && auth.isAuthenticated) {
    return auth.hasHogar ? { name: 'panel-personal' } : { name: 'onboarding' };
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' };
  }

  if (to.meta.requiresHogar && auth.isAuthenticated && !auth.hasHogar) {
    return { name: 'onboarding' };
  }

  if (to.name === 'onboarding' && auth.hasHogar) {
    return { name: 'panel-personal' };
  }

  return true;
});
