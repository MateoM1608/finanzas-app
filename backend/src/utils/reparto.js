import { prisma } from '../config/prisma.js';

export async function obtenerSplitVigente(hogarId, contexto = 'general', client = prisma) {
  const ultimo = await client.splitPorcentajeMiembro.findFirst({
    where: { hogarId, contexto, periodoInicio: { lte: new Date() } },
    orderBy: { periodoInicio: 'desc' },
  });
  if (!ultimo) return [];
  return client.splitPorcentajeMiembro.findMany({
    where: { hogarId, contexto, periodoInicio: ultimo.periodoInicio },
  });
}

/**
 * Split vigente para gastos variables puntuales: usa el split propio de ese
 * contexto si existe; si nadie lo ha configurado, cae al split general del hogar.
 */
export async function obtenerSplitVigenteGastosVariables(hogarId, client = prisma) {
  const propio = await obtenerSplitVigente(hogarId, 'gastos_variables', client);
  if (propio.length) return propio;
  return obtenerSplitVigente(hogarId, 'general', client);
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
