import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { obtenerEvaluacionActual, obtenerEvaluacionAnterior, obtenerEvaluacionPasada } from '../../utils/evaluacionLimite.js';
import { calcularPeriodoPorIndice } from '../../utils/cicloPersonal.js';
import { asegurarInstanciasFijasPersonales } from '../../utils/instanciasFijasPersonales.js';

function validarConsistenciaObjetivo(tipoObjetivo, categoriaId) {
  if (tipoObjetivo === 'categoria' && !categoriaId) {
    throw new HttpError(400, 'Selecciona una categoría para un límite de tipo "categoría"');
  }
  if (tipoObjetivo !== 'categoria' && categoriaId) {
    throw new HttpError(400, 'La categoría solo aplica a límites de tipo "categoría"');
  }
}

async function requireLimiteDelUsuario(usuarioId, id) {
  const limite = await prisma.limiteAlertaPersonal.findUnique({ where: { id } });
  if (!limite || limite.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Límite no encontrado');
  }
  return limite;
}

export function listarLimites(usuarioActual) {
  return prisma.limiteAlertaPersonal.findMany({
    where: { usuarioId: usuarioActual.id },
    include: { categoria: true },
    orderBy: { creadoEn: 'asc' },
  });
}

export function crearLimite(usuarioActual, data) {
  const categoriaId = data.categoriaId ?? null;
  validarConsistenciaObjetivo(data.tipoObjetivo, categoriaId);

  return prisma.limiteAlertaPersonal.create({
    data: { ...data, categoriaId, usuarioId: usuarioActual.id },
  });
}

export async function actualizarLimite(usuarioActual, id, data) {
  const limite = await requireLimiteDelUsuario(usuarioActual.id, id);

  const tipoObjetivo = data.tipoObjetivo ?? limite.tipoObjetivo;
  const categoriaId = data.categoriaId !== undefined ? data.categoriaId : limite.categoriaId;
  validarConsistenciaObjetivo(tipoObjetivo, categoriaId);

  return prisma.limiteAlertaPersonal.update({
    where: { id },
    data: { ...data, tipoObjetivo, categoriaId },
  });
}

export async function eliminarLimite(usuarioActual, id) {
  await requireLimiteDelUsuario(usuarioActual.id, id);

  const evaluaciones = await prisma.limiteEvaluadoPeriodo.count({ where: { limiteId: id } });
  if (evaluaciones) {
    throw new HttpError(
      409,
      'Este límite ya tiene evaluaciones de períodos pasados guardadas — desactívalo en vez de eliminarlo, para no perder ese historial',
    );
  }

  await prisma.limiteAlertaPersonal.delete({ where: { id } });
}

/**
 * Resumen para las tarjetas de Límites en Panel personal. Con `indiceCiclo`
 * 0 (el actual): cada límite activo con el período actual (en vivo) y el
 * anterior (snapshot). Con un ciclo pasado (-1, -2…, Etapa 6): los límites
 * que ya existían cuando terminó ese ciclo y siguen activos o tienen su
 * evaluación guardada, con el snapshot de ese período (se guarda la primera
 * vez que se consulta, ver evaluacionLimite.js). `actual` es siempre la
 * evaluación del ciclo consultado.
 */
export async function obtenerResumenLimites(usuarioActual, indiceCiclo = 0) {
  const usuarioId = usuarioActual.id;
  const frecuencia = usuarioActual.frecuenciaCicloPersonal;
  // Antes de medir cualquier período: si no, en la primera carga del panel
  // el snapshot del período anterior se guardaba sin los fijos generados.
  await asegurarInstanciasFijasPersonales(usuarioId);
  const rango = calcularPeriodoPorIndice(frecuencia, indiceCiclo);
  const ciclo = { indice: indiceCiclo, inicio: rango.inicio, fin: rango.fin };

  if (indiceCiclo === 0) {
    const limites = await prisma.limiteAlertaPersonal.findMany({
      where: { usuarioId, activo: true },
      include: { categoria: true },
      orderBy: { creadoEn: 'asc' },
    });
    const resultado = await Promise.all(
      limites.map(async (limite) => {
        const [actual, anterior] = await Promise.all([
          obtenerEvaluacionActual(limite, usuarioId, frecuencia),
          obtenerEvaluacionAnterior(limite, usuarioId, frecuencia),
        ]);
        return { ...datosLimite(limite), actual, anterior };
      }),
    );
    return { ciclo, limites: resultado };
  }

  // Un límite creado después de que terminó el ciclo no aplicaba entonces.
  const finDelDia = new Date(rango.fin.getTime() + 24 * 60 * 60 * 1000);
  const limites = await prisma.limiteAlertaPersonal.findMany({
    where: {
      usuarioId,
      creadoEn: { lt: finDelDia },
      OR: [{ activo: true }, { evaluaciones: { some: { periodoInicio: rango.inicio } } }],
    },
    include: { categoria: true },
    orderBy: { creadoEn: 'asc' },
  });
  const resultado = await Promise.all(
    limites.map(async (limite) => ({ ...datosLimite(limite), actual: await obtenerEvaluacionPasada(limite, rango) })),
  );
  return { ciclo, limites: resultado };
}

function datosLimite(limite) {
  return {
    id: limite.id,
    nombre: limite.nombre,
    tipoObjetivo: limite.tipoObjetivo,
    categoria: limite.categoria?.nombre ?? null,
    reglaTipo: limite.reglaTipo,
    reglaValor: limite.reglaValor,
  };
}
