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
    path: '/recuperar',
    name: 'recuperar',
    component: () => import('../views/RecuperarView.vue'),
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
    name: 'inicio',
    component: () => import('../views/InicioView.vue'),
    meta: { requiresAuth: true, requiresHogar: true },
  },
  {
    // Toda la caja personal (#gasto-<id> / #ingreso-<id> resalta uno; ?desde=&hasta= filtra).
    path: '/movimientos',
    name: 'movimientos',
    component: () => import('../views/MovimientosView.vue'),
    meta: { requiresAuth: true, requiresHogar: true },
  },
  {
    // Neto, límites, ahorros y próximos meses (?vista=limites, ahorros, proximos).
    path: '/analisis',
    name: 'analisis',
    component: () => import('../views/AnalisisView.vue'),
    meta: { requiresAuth: true, requiresHogar: true },
  },
  {
    // Antes "Personal" era una sola pantalla: los enlaces viejos (avisos,
    // notificaciones) a un movimiento van a Movimientos; el resto, a Inicio.
    path: '/personal',
    name: 'panel-personal',
    redirect: (to) => {
      if (to.hash) return { name: 'movimientos', hash: to.hash, query: {} };
      if (to.query.registrar) return { name: 'inicio', query: { registrar: to.query.registrar } };
      return { name: 'inicio', query: {} };
    },
  },
  {
    path: '/personal/configuracion',
    name: 'configuracion-personal',
    component: () => import('../views/ConfiguracionPersonalView.vue'),
    meta: { requiresAuth: true, requiresHogar: true },
  },
  {
    path: '/personal/tarjetas',
    name: 'tarjetas',
    component: () => import('../views/TarjetasView.vue'),
    meta: { requiresAuth: true, requiresHogar: true },
  },
  {
    // Configuración del hogar: vive dentro de Hogar (?tab=miembros, conceptos…).
    path: '/hogar/configuracion',
    name: 'configuracion-hogar',
    component: () => import('../views/ConfiguracionHogarView.vue'),
    meta: { requiresAuth: true, requiresHogar: true },
  },
  {
    // Cuenta: perfil, seguridad y exportar (?tab=seguridad, exportar).
    path: '/cuenta',
    name: 'cuenta',
    component: () => import('../views/CuentaView.vue'),
    meta: { requiresAuth: true, requiresHogar: true },
  },
  {
    // Antes todo estaba en /settings: los enlaces viejos (notificaciones,
    // marcadores) llevan a donde quedó cada pestaña.
    path: '/settings',
    name: 'settings',
    redirect: (to) => {
      const tab = to.query.tab;
      if (tab === 'cuenta') return { name: 'cuenta', query: { tab: 'seguridad' } };
      if (tab === 'exportar') return { name: 'cuenta', query: { tab: 'exportar' } };
      return { name: 'configuracion-hogar', query: tab ? { tab } : {} };
    },
  },
  {
    path: '/hogar',
    name: 'panel-hogar',
    component: () => import('../views/PanelHogarView.vue'),
    meta: { requiresAuth: true, requiresHogar: true },
  },
  {
    // Cada parte del hogar en su página (/hogar/cuentas#cuenta-<id>, /hogar/gastos?registrar=variable…).
    path: '/hogar/:seccion(cuentas|gastos|topes|metas|informe|actividad)',
    name: 'hogar-seccion',
    component: () => import('../views/HogarSeccionView.vue'),
    meta: { requiresAuth: true, requiresHogar: true },
  },
  {
    // Patrimonio: préstamos e inversiones (?vista=inversiones).
    path: '/patrimonio',
    name: 'patrimonio',
    component: () => import('../views/PrestamosView.vue'),
    meta: { requiresAuth: true, requiresHogar: true },
  },
  { path: '/prestamos', redirect: '/patrimonio' },
  {
    path: '/notificaciones',
    name: 'notificaciones',
    component: () => import('../views/NotificacionesView.vue'),
    meta: { requiresAuth: true, requiresHogar: true },
  },
  {
    path: '/cuadres',
    name: 'cuadres',
    component: () => import('../views/CuadresView.vue'),
    meta: { requiresAuth: true, requiresHogar: true },
  },
  // Enlaces viejos de antes de los cuadres abiertos.
  { path: '/cortes', redirect: '/cuadres' },
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
    return auth.hasHogar ? { name: 'inicio' } : { name: 'onboarding' };
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' };
  }

  if (to.meta.requiresHogar && auth.isAuthenticated && !auth.hasHogar) {
    return { name: 'onboarding' };
  }

  if (to.name === 'onboarding' && auth.hasHogar) {
    return { name: 'inicio' };
  }

  // Enlaces de antes de separar Hogar en páginas (avisos y notificaciones).
  if (to.name === 'panel-hogar') {
    if (to.hash.startsWith('#cuenta-')) return { name: 'hogar-seccion', params: { seccion: 'cuentas' }, hash: to.hash };
    if (to.hash.startsWith('#gasto-hogar-') || to.hash.startsWith('#compra-hogar-')) {
      return { name: 'hogar-seccion', params: { seccion: 'gastos' }, hash: to.hash };
    }
    if (to.query.registrar === 'variable') return { name: 'hogar-seccion', params: { seccion: 'gastos' }, query: { registrar: 'variable' } };
  }

  return true;
});
