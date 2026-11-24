import { prisma } from '../config/prisma.js';

const INCLUDE_COMUN = {
  pagador: { select: { id: true, nombre: true } },
  repartos: { include: { usuario: { select: { id: true, nombre: true } } } },
};

export function origenClave(item) {
  return `${item.tipoOrigen}:${item.origenId}`;
}

/**
 * Resuelve el origen real (nombre, fecha, pagador, reparto) de una lista de
 * CuadreItem en dos queries por lote (una para cuotas de cuentas fijas, otra
 * para gastos variables) en vez de una query por ítem.
 */
export async function obtenerOrigenesDetalladosPorLote(items, client = prisma) {
  const idsRecurrentes = items.filter((i) => i.tipoOrigen === 'recurrente').map((i) => i.origenId);
  const idsVariables = items.filter((i) => i.tipoOrigen === 'variable').map((i) => i.origenId);

  const [cuotas, variables] = await Promise.all([
    idsRecurrentes.length
      ? client.gastoRecurrenteInstancia.findMany({
          where: { id: { in: idsRecurrentes } },
          include: { ...INCLUDE_COMUN, concepto: { select: { nombre: true } } },
        })
      : [],
    idsVariables.length
      ? client.gastoVariablePareja.findMany({
          where: { id: { in: idsVariables } },
          include: INCLUDE_COMUN,
        })
      : [],
  ]);

  const mapa = new Map();
  for (const cuota of cuotas) {
    mapa.set(`recurrente:${cuota.id}`, {
      nombre: cuota.concepto.nombre,
      fecha: cuota.fecha,
      monto: cuota.monto,
      estado: cuota.estado,
      pagador: cuota.pagador,
      repartos: cuota.repartos,
    });
  }
  for (const gasto of variables) {
    mapa.set(`variable:${gasto.id}`, {
      nombre: gasto.item,
      fecha: gasto.fecha,
      monto: gasto.valorTotal,
      estado: gasto.estado,
      pagador: gasto.pagador,
      repartos: gasto.repartos,
    });
  }
  return mapa;
}
