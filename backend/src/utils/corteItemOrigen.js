import { prisma } from '../config/prisma.js';

const INCLUDE_COMUN = {
  pagador: { select: { id: true, nombre: true } },
  repartos: { include: { usuario: { select: { id: true, nombre: true } } } },
};

export function origenClave(item) {
  return `${item.tipoOrigen}:${item.origenId}`;
}

/**
 * Resuelve el origen real (nombre, pagador, reparto) de una lista de
 * CorteItem en dos queries por lote (una para recurrentes, otra para
 * variables) en vez de una query por ítem — ver backlog de N+1 en CLAUDE.md.
 */
export async function obtenerOrigenesDetalladosPorLote(items) {
  const idsRecurrentes = items.filter((i) => i.tipoOrigen === 'recurrente').map((i) => i.origenId);
  const idsVariables = items.filter((i) => i.tipoOrigen === 'variable').map((i) => i.origenId);

  const [instancias, variables] = await Promise.all([
    idsRecurrentes.length
      ? prisma.gastoRecurrenteInstancia.findMany({
          where: { id: { in: idsRecurrentes } },
          include: { ...INCLUDE_COMUN, concepto: { select: { nombre: true, tipoMonto: true } } },
        })
      : [],
    idsVariables.length
      ? prisma.gastoVariablePareja.findMany({
          where: { id: { in: idsVariables } },
          include: INCLUDE_COMUN,
        })
      : [],
  ]);

  const mapa = new Map();
  for (const instancia of instancias) {
    mapa.set(`recurrente:${instancia.id}`, {
      nombre: instancia.concepto.nombre,
      tipoMonto: instancia.concepto.tipoMonto,
      pagador: instancia.pagador,
      repartos: instancia.repartos,
    });
  }
  for (const gasto of variables) {
    mapa.set(`variable:${gasto.id}`, {
      nombre: gasto.item,
      tipoMonto: null,
      pagador: gasto.pagador,
      repartos: gasto.repartos,
    });
  }
  return mapa;
}
