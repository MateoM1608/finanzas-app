import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { calcularPeriodoActual } from '../../utils/periodoActual.js';
import { obtenerSplitVigente, calcularReparto } from '../../utils/reparto.js';

const INCLUDE_INSTANCIA = {
  repartos: { include: { usuario: { select: { id: true, nombre: true } } } },
  pagador: { select: { id: true, nombre: true } },
};

function requireHogarId(usuarioActual) {
  if (!usuarioActual.hogarId) {
    throw new HttpError(409, 'No perteneces a ningún hogar todavía');
  }
  return usuarioActual.hogarId;
}

function requirePermisoEdicion(usuarioActual) {
  if (!usuarioActual.esAdmin && !usuarioActual.puedeEditarGastos) {
    throw new HttpError(403, 'No tienes permiso para editar los gastos del hogar');
  }
}

export async function obtenerPeriodoActual(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);

  const hogar = await prisma.hogar.findUnique({ where: { id: hogarId } });
  const puntosCorte = await prisma.puntoCorteHogar.findMany({ where: { hogarId } });
  const { puntoCorte, periodoInicio, fechaNominal } = calcularPeriodoActual(hogar, puntosCorte);

  const conceptos = await prisma.conceptoRecurrentePareja.findMany({
    where: { hogarId, activo: true },
    include: { puntosCorte: true },
  });

  const conceptosAplicables = conceptos.filter(
    (c) =>
      c.puntosCorte.length === 0 || c.puntosCorte.some((cp) => cp.puntoCorteId === puntoCorte.id),
  );

  const split = await obtenerSplitVigente(hogarId);

  const instancias = [];
  for (const concepto of conceptosAplicables) {
    let instancia = await prisma.gastoRecurrenteInstancia.findUnique({
      where: {
        conceptoId_periodoInicio_puntoCorteId: {
          conceptoId: concepto.id,
          periodoInicio,
          puntoCorteId: puntoCorte.id,
        },
      },
      include: INCLUDE_INSTANCIA,
    });

    if (!instancia) {
      const montoInicial = concepto.tipoMonto === 'fijo' ? concepto.montoDefault : null;
      const nueva = await prisma.gastoRecurrenteInstancia.create({
        data: {
          conceptoId: concepto.id,
          periodoInicio,
          puntoCorteId: puntoCorte.id,
          fechaNominal,
          monto: montoInicial,
          pagoUsuarioId: concepto.pagadorDefaultUsuarioId,
        },
      });

      if (montoInicial != null && split.length) {
        const repartos = calcularReparto(montoInicial, split);
        await prisma.gastoRecurrenteInstanciaReparto.createMany({
          data: repartos.map((r) => ({ instanciaId: nueva.id, ...r })),
        });
      }

      instancia = await prisma.gastoRecurrenteInstancia.findUnique({
        where: { id: nueva.id },
        include: INCLUDE_INSTANCIA,
      });
    }

    instancias.push({ concepto, instancia });
  }

  return { puntoCorte, periodoInicio, fechaNominal, instancias };
}

export async function actualizarInstancia(usuarioActual, instanciaId, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);

  const instancia = await prisma.gastoRecurrenteInstancia.findUnique({
    where: { id: instanciaId },
    include: { concepto: true },
  });
  if (!instancia || instancia.concepto.hogarId !== hogarId) {
    throw new HttpError(404, 'Instancia no encontrada');
  }
  if (instancia.estado === 'liquidado') {
    throw new HttpError(409, 'Este gasto ya fue liquidado en un corte y no se puede editar');
  }
  if (instancia.estado === 'incluido_en_corte') {
    throw new HttpError(
      409,
      'Este gasto está incluido en un corte abierto — desmárcalo del corte para poder editarlo',
    );
  }

  if (data.pagoUsuarioId) {
    const pertenece = await prisma.usuario.count({ where: { id: data.pagoUsuarioId, hogarId } });
    if (!pertenece) {
      throw new HttpError(400, 'El pagador debe ser un miembro de tu hogar');
    }
  }

  const montoFinal = data.monto ?? instancia.monto;

  return prisma.$transaction(async (tx) => {
    await tx.gastoRecurrenteInstancia.update({
      where: { id: instanciaId },
      data: {
        monto: data.monto ?? undefined,
        pagoUsuarioId: data.pagoUsuarioId === undefined ? undefined : data.pagoUsuarioId,
      },
    });

    if (data.monto !== undefined) {
      await tx.gastoRecurrenteInstanciaReparto.deleteMany({ where: { instanciaId } });
      const split = await obtenerSplitVigente(hogarId, 'general', tx);
      if (montoFinal != null && split.length) {
        const repartos = calcularReparto(montoFinal, split);
        await tx.gastoRecurrenteInstanciaReparto.createMany({
          data: repartos.map((r) => ({ instanciaId, ...r })),
        });
      }
    }

    return tx.gastoRecurrenteInstancia.findUnique({
      where: { id: instanciaId },
      include: INCLUDE_INSTANCIA,
    });
  });
}
