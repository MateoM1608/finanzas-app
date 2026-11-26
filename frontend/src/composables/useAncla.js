import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';

/**
 * Enlaces a un ítem dentro de una pantalla (`/hogar#cuenta-<id>`): los avisos de
 * "Para pagar" y las notificaciones llevan hasta la fila y la resaltan un
 * momento. Si ya estás en esa pantalla, el router no navega, así que también se
 * avisa con un evento.
 */
const EVENTO = 'finanzas:ancla';

export function irAAncla(router, enlace) {
  const [, hash] = String(enlace).split('#');
  return router.push(enlace).finally(() => {
    if (hash) window.dispatchEvent(new CustomEvent(EVENTO, { detail: `#${hash}` }));
  });
}

export function resaltar(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'center' });
  el.classList.add('fila-resaltada');
  setTimeout(() => el.classList.remove('fila-resaltada'), 2500);
  return true;
}

/**
 * `resolver(hash)` prepara la vista (pestaña, "ver todo"…) y devuelve el id del
 * elemento a resaltar, o null si el hash no es de este componente. `listo()`
 * dice si los datos ya cargaron.
 */
export function useAncla(resolver, listo) {
  const route = useRoute();
  let pendiente = null;

  async function intentar(hash) {
    if (!hash) return;
    if (!listo()) {
      pendiente = hash;
      return;
    }
    pendiente = null;
    const id = await resolver(hash);
    if (!id) return;
    await nextTick();
    resaltar(id);
  }

  const alEvento = (e) => intentar(e.detail);
  onMounted(() => {
    window.addEventListener(EVENTO, alEvento);
    intentar(route.hash);
  });
  onBeforeUnmount(() => window.removeEventListener(EVENTO, alEvento));
  watch(() => route.hash, (h) => intentar(h));
  watch(listo, (ok) => {
    if (ok && pendiente) intentar(pendiente);
  });
}
