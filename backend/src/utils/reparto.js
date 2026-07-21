import { prisma } from '../config/prisma.js';

export async function obtenerSplitVigente(hogarId, client = prisma) {
  const ultimo = await client.splitPorcentajeMiembro.findFirst({
    where: { hogarId, periodoInicio: { lte: new Date() } },
    orderBy: { periodoInicio: 'desc' },
  });
  if (!ultimo) return [];
  return client.splitPorcentajeMiembro.findMany({
    where: { hogarId, periodoInicio: ultimo.periodoInicio },
  });
}

/**
 * Reparte un monto entero (COP, sin decimales) proporcional al split, garantizando que
 * la suma de los repartos sea exactamente igual al monto (el último se ajusta para
 * absorber el redondeo).
 */
export function calcularReparto(monto, split) {
  if (!split.length) return [];

  let acumulado = 0;
  return split.map((s, idx) => {
    const esUltimo = idx === split.length - 1;
    const montoMiembro = esUltimo ? monto - acumulado : Math.round((monto * s.porcentaje) / 100);
    acumulado += montoMiembro;
    return { usuarioId: s.usuarioId, monto: montoMiembro };
  });
}
