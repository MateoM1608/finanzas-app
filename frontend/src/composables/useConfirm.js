import { reactive } from 'vue';

// Diálogo de confirmación de la app (reemplaza al confirm() nativo).
// Uso: if (!(await confirmar('¿Eliminar "X"?'))) return;
export const estadoConfirmacion = reactive({
  abierto: false,
  mensaje: '',
  textoAceptar: 'Eliminar',
  peligroso: true,
  resolver: null,
});

export function confirmar(mensaje, { textoAceptar = 'Eliminar', peligroso = true } = {}) {
  // Si había uno abierto, se da por cancelado antes de abrir el nuevo.
  estadoConfirmacion.resolver?.(false);
  return new Promise((resolve) => {
    Object.assign(estadoConfirmacion, { abierto: true, mensaje, textoAceptar, peligroso, resolver: resolve });
  });
}

export function responderConfirmacion(valor) {
  const resolver = estadoConfirmacion.resolver;
  estadoConfirmacion.abierto = false;
  estadoConfirmacion.resolver = null;
  resolver?.(valor);
}
