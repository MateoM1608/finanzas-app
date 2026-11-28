import { reactive } from 'vue';

/**
 * "Registrar movimiento" vive una sola vez en AppLayout y se abre desde
 * cualquier pantalla (botón +, Inicio, Movimientos). `version` sube cada vez
 * que se guarda algo: las pantallas lo miran para volver a cargar.
 */
export const registro = reactive({
  abierto: false,
  tipo: 'gasto', // 'gasto' | 'ingreso'
  // null registrando, o { tipo: 'gasto' | 'compra', registro } editando.
  edicion: null,
  version: 0,
});

export function abrirRegistro(tipo = 'gasto') {
  registro.edicion = null;
  registro.tipo = tipo === 'ingreso' ? 'ingreso' : 'gasto';
  registro.abierto = true;
}

export function editarGastoPersonal(gasto) {
  registro.edicion = { tipo: 'gasto', registro: gasto };
  registro.tipo = 'gasto';
  registro.abierto = true;
}

export function editarCompraPersonal(compra) {
  registro.edicion = { tipo: 'compra', registro: compra };
  registro.tipo = 'gasto';
  registro.abierto = true;
}

export function cerrarRegistro() {
  registro.abierto = false;
  registro.edicion = null;
}

export function avisarCambioPersonal() {
  registro.version += 1;
}
