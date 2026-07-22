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

/**
 * Genera (si no existen ya) las instancias de gastos recurrentes de un
 * hogar para un punto/período específico, una por cada concepto activo
 * aplicable a ese punto de corte. Idempotente: si la instancia ya existe
 * para ese conceptoId+periodoInicio+puntoCorteId, no hace nada.
 *
 * Se usa tanto al consultar el período actual (Settings) como al iniciar un
 * corte — antes dependía únicamente de que alguien visitara Panel del hogar
 * para ese período, y un concepto (ej. Arriendo) que nadie visitó a tiempo
 * nunca generaba su instancia, así que el motor de cortes jamás lo encontraba
 * pendiente. Ahora `iniciarCorte` la llama directamente para cada punto
 * pendiente, para no depender de esa visita.
 */
export async function asegurarInstanciasRecurrentes(hogarId, puntoCorte, periodoInicio, fechaNominal) {
  const conceptos = await prisma.conceptoRecurrentePareja.findMany({
    where: { hogarId, activo: true },
    include: { puntosCorte: true },
  });

  const conceptosAplicables = conceptos.filter(
    (c) =>
      c.puntosCorte.length === 0 || c.puntosCorte.some((cp) => cp.puntoCorteId === puntoCorte.id),
  );
  if (!conceptosAplicables.length) return;

  const split = await obtenerSplitVigente(hogarId);

  for (const concepto of conceptosAplicables) {
    const existente = await prisma.gastoRecurrenteInstancia.findUnique({
      where: {
        conceptoId_periodoInicio_puntoCorteId: {
          conceptoId: concepto.id,
          periodoInicio,
          puntoCorteId: puntoCorte.id,
        },
      },
    });
    if (existente) continue;

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
  }
}

export async function obtenerPeriodoActual(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);

  const hogar = await prisma.hogar.findUnique({ where: { id: hogarId } });
  const puntosCorte = await prisma.puntoCorteHogar.findMany({ where: { hogarId } });
  const { puntoCorte, periodoInicio, fechaNominal } = calcularPeriodoActual(hogar, puntosCorte);

  await asegurarInstanciasRecurrentes(hogarId, puntoCorte, periodoInicio, fechaNominal);

  const conceptos = await prisma.conceptoRecurrentePareja.findMany({
    where: { hogarId, activo: true },
    include: { puntosCorte: true },
  });

  const conceptosAplicables = conceptos.filter(
    (c) =>
      c.puntosCorte.length === 0 || c.puntosCorte.some((cp) => cp.puntoCorteId === puntoCorte.id),
  );

  const instancias = [];
  for (const concepto of conceptosAplicables) {
    const instancia = await prisma.gastoRecurrenteInstancia.findUnique({
      where: {
        conceptoId_periodoInicio_puntoCorteId: {
          conceptoId: concepto.id,
          periodoInicio,
          puntoCorteId: puntoCorte.id,
        },
      },
      include: INCLUDE_INSTANCIA,
    });

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
