import { ref } from 'vue';

// Tema claro/oscuro. La preferencia se guarda en localStorage; sin preferencia
// guardada se sigue la del sistema. index.html aplica la clase `dark` antes de
// que cargue Vue, así no hay destello claro al abrir en oscuro.
const CLAVE = 'finanzas-tema';

function temaInicial() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === 'light' || guardado === 'dark') return guardado;
  } catch {
    /* localStorage bloqueado: seguimos al sistema */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const tema = ref(temaInicial());

function aplicar(valor) {
  const root = document.documentElement;
  // Evita que cada borde/fondo anime su transición al cambiar de tema.
  root.classList.add('theme-switching');
  root.classList.toggle('dark', valor === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', valor === 'dark' ? '#0B0D11' : '#F4F5F1');
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
}

aplicar(tema.value);

export function useTheme() {
  function setTema(valor) {
    tema.value = valor;
    try {
      localStorage.setItem(CLAVE, valor);
    } catch {
      /* sin persistencia, pero el cambio aplica igual */
    }
    aplicar(valor);
  }

  function alternar() {
    setTema(tema.value === 'dark' ? 'light' : 'dark');
  }

  return { tema, setTema, alternar };
}
