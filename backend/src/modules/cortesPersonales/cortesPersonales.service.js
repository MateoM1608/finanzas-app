import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { calcularPeriodoActual, calcularProximaFechaNominalPendiente } from '../../utils/periodoActual.js';

const INCLUDE_CORTE = {
  items: { include: { instancia: { include: { concepto: true } } } },
};

function requirePuntosCorte(puntosCorte) {
  if (!puntosCorte.length) {
    throw new HttpError(409, 'Todavía no tienes puntos de corte personales configurados');
  }
}

async function requireCortePersonalAbierto(usuarioId, corteId) {
  const corte = await prisma.cortePersonal.findUnique({ where: { id: corteId } });
  if (!corte || corte.usuarioId !== usuarioId) {
    throw new HttpError(404, 'Corte no encontrado');
  }
  if (corte.estado !== 'abierto') {
    throw new HttpError(409, 'Este corte ya está cerrado');
  }
  return corte;
}

/**
 * Igual patrón que asegurarInstanciasRecurrentes (pareja), pero sin split ni
 * pagador — una instancia personal solo necesita existir, no repartirse.
 */
async function asegurarInstanciasRecurrentesPersonal(usuarioId, puntoCorte, periodoInicio, fechaNominal) {
  const conceptos = await prisma.conceptoRecurrentePersonal.findMany({
    where: { usuarioId, activo: true },
    include: { puntosCorte: true },
  });

  const conceptosAplicables = conceptos.filter(
    (c) => c.puntosCorte.length === 0 || c.puntosCorte.some((cp) => cp.puntoCorteId === puntoCorte.id),
  );
  if (!conceptosAplicables.length) return;

  for (const concepto of conceptosAplicables) {
    const existente = await prisma.gastoRecurrentePersonalInstancia.findUnique({
      where: {
        conceptoId_periodoInicio_puntoCorteId: {
          conceptoId: concepto.id,
          periodoInicio,
          puntoCorteId: puntoCorte.id,
        },
      },
    });
    if (existente) continue;

    await prisma.gastoRecurrentePersonalInstancia.create({
      data: {
        conceptoId: concepto.id,
        periodoInicio,
        puntoCorteId: puntoCorte.id,
        fechaNominal,
        monto: concepto.tipoMonto === 'fijo' ? concepto.montoDefault : null,
      },
    });
  }
}

function buscarPendientesPersonal(usuarioId, fechaObjetivo) {
  return prisma.gastoRecurrentePersonalInstancia.findMany({
    where: {
      concepto: { usuarioId },
      estado: 'pendiente',
      fechaNominal: { lte: fechaObjetivo },
    },
  });
}

async function agregarPendientesAlCortePersonal(usuarioId, corteId, fechaNominal) {
  const existentes = await prisma.corteItemPersonal.findMany({
    where: { cortePersonalId: corteId },
    select: { instanciaId: true },
  });
  const yaIncluido = new Set(existentes.map((e) => e.instanciaId));

  const pendientes = await buscarPendientesPersonal(usuarioId, fechaNominal);
  const nuevas = pendientes.filter((i) => !yaIncluido.has(i.id));
  if (!nuevas.length) return;

  await prisma.$transaction(async (tx) => {
    await tx.corteItemPersonal.createMany({
      data: nuevas.map((i) => ({ cortePersonalId: corteId, instanciaId: i.id, monto: i.monto })),
    });
    for (const i of nuevas) {
      await tx.gastoRecurrentePersonalInstancia.update({
        where: { id: i.id },
        data: { estado: 'incluido_en_corte' },
      });
    }
  });
}

function enriquecerCortePersonal(corte) {
  if (!corte) return corte;
  return {
    ...corte,
    items: corte.items.map((item) => ({
      id: item.id,
      cortePersonalId: item.cortePersonalId,
      instanciaId: item.instanciaId,
      incluido: item.incluido,
      monto: item.monto,
      nombre: item.instancia.concepto.nombre,
      categoria: item.instancia.concepto.categoria,
      tipoMonto: item.instancia.concepto.tipoMonto,
    })),
  };
}

export async function listarCortesPersonales(usuarioActual) {
  const cortes = await prisma.cortePersonal.findMany({
    where: { usuarioId: usuarioActual.id },
    orderBy: { fechaNominal: 'desc' },
    include: INCLUDE_CORTE,
  });
  return cortes.map(enriquecerCortePersonal);
}

export async function obtenerCortePersonalAbierto(usuarioActual) {
  const corte = await prisma.cortePersonal.findFirst({
    where: { usuarioId: usuarioActual.id, estado: 'abierto' },
    include: INCLUDE_CORTE,
  });
  return enriquecerCortePersonal(corte);
}

export async function obtenerCortePersonal(usuarioActual, corteId) {
  const corte = await prisma.cortePersonal.findUnique({ where: { id: corteId }, include: INCLUDE_CORTE });
  if (!corte || corte.usuarioId !== usuarioActual.id) {
    throw new HttpError(404, 'Corte no encontrado');
  }
  return enriquecerCortePersonal(corte);
}

export async function iniciarCortePersonal(usuarioActual) {
  const usuarioId = usuarioActual.id;
  const puntosCorte = await prisma.puntoCortePersonal.findMany({ where: { usuarioId } });
  requirePuntosCorte(puntosCorte);

  const configFrecuencia = { frecuenciaCorte: usuarioActual.frecuenciaCortePersonal };
  const cortesExistentes = await prisma.cortePersonal.findMany({
    where: { usuarioId },
    select: { fechaNominal: true },
  });
  const fechasUsadas = new Set(cortesExistentes.map((c) => c.fechaNominal.getTime()));
  const fechasCerradas = cortesExistentes.map((c) => c.fechaNominal);

  // Mismo criterio que el corte de hogar: solo se asegura el atraso MÁS
  // RECIENTE (uno solo) + el período actual, nunca toda una ventana de ciclos
  // pasados — ver la nota extensa en cortes.service.js#iniciarCorte.
  const periodoActual = calcularPeriodoActual(configFrecuencia, puntosCorte);
  const candidatoAtrasoParaAsegurar = calcularProximaFechaNominalPendiente(
    configFrecuencia,
    puntosCorte,
    fechasCerradas,
  );
  const periodosAAsegurar = candidatoAtrasoParaAsegurar
    ? [candidatoAtrasoParaAsegurar, periodoActual]
    : [periodoActual];
  for (const p of periodosAAsegurar) {
    await asegurarInstanciasRecurrentesPersonal(usuarioId, p.puntoCorte, p.periodoInicio, p.fechaNominal);
  }

  const abierto = await prisma.cortePersonal.findFirst({ where: { usuarioId, estado: 'abierto' } });
  if (abierto) {
    await agregarPendientesAlCortePersonal(usuarioId, abierto.id, abierto.fechaNominal);
    return { corte: await obtenerCortePersonal(usuarioActual, abierto.id), motivo: null };
  }

  let fechaNominal = null;

  const candidatoAtraso = calcularProximaFechaNominalPendiente(configFrecuencia, puntosCorte, fechasCerradas);
  if (candidatoAtraso && !fechasUsadas.has(candidatoAtraso.fechaNominal.getTime())) {
    const encontrados = await buscarPendientesPersonal(usuarioId, candidatoAtraso.fechaNominal);
    if (encontrados.length) fechaNominal = candidatoAtraso.fechaNominal;
  }

  if (!fechaNominal && !fechasUsadas.has(periodoActual.fechaNominal.getTime())) {
    const encontrados = await buscarPendientesPersonal(usuarioId, periodoActual.fechaNominal);
    if (encontrados.length) fechaNominal = periodoActual.fechaNominal;
  }

  if (!fechaNominal) {
    return { corte: null, motivo: 'No hay ningún gasto recurrente personal pendiente para incluir en un corte todavía' };
  }

  const nuevoCorte = await prisma.cortePersonal.create({ data: { usuarioId, fechaNominal } });
  await agregarPendientesAlCortePersonal(usuarioId, nuevoCorte.id, fechaNominal);

  return { corte: await obtenerCortePersonal(usuarioActual, nuevoCorte.id), motivo: null };
}

export async function togglearItemPersonal(usuarioActual, corteId, itemId, incluido) {
  const usuarioId = usuarioActual.id;
  await requireCortePersonalAbierto(usuarioId, corteId);

  const item = await prisma.corteItemPersonal.findUnique({
    where: { id: itemId },
    include: { instancia: true },
  });
  if (!item || item.cortePersonalId !== corteId) {
    throw new HttpError(404, 'Ítem no encontrado en este corte');
  }

  await prisma.$transaction(async (tx) => {
    if (incluido) {
      if (item.instancia.monto == null) {
        throw new HttpError(409, 'Este gasto todavía no tiene un monto definido');
      }
      await tx.corteItemPersonal.update({
        where: { id: itemId },
        data: { incluido: true, monto: item.instancia.monto },
      });
      await tx.gastoRecurrentePersonalInstancia.update({
        where: { id: item.instanciaId },
        data: { estado: 'incluido_en_corte' },
      });
    } else {
      await tx.corteItemPersonal.update({ where: { id: itemId }, data: { incluido: false } });
      await tx.gastoRecurrentePersonalInstancia.update({
        where: { id: item.instanciaId },
        data: { estado: 'pendiente' },
      });
    }
  });

  return obtenerCortePersonal(usuarioActual, corteId);
}

export async function actualizarItemCortePersonal(usuarioActual, corteId, itemId, monto) {
  const usuarioId = usuarioActual.id;
  await requireCortePersonalAbierto(usuarioId, corteId);

  const item = await prisma.corteItemPersonal.findUnique({ where: { id: itemId } });
  if (!item || item.cortePersonalId !== corteId) {
    throw new HttpError(404, 'Ítem no encontrado en este corte');
  }

  await prisma.$transaction([
    prisma.gastoRecurrentePersonalInstancia.update({ where: { id: item.instanciaId }, data: { monto } }),
    prisma.corteItemPersonal.update({ where: { id: itemId }, data: { monto } }),
  ]);

  return obtenerCortePersonal(usuarioActual, corteId);
}

/**
 * A diferencia del corte de hogar, acá no hay balance que calcular — al
 * confirmar, cada ítem incluido simplemente se materializa como un
 * GastoPersonal real (tipo: recurrente), que ya es lo que consumen el
 * listado de Panel personal y el dashboard.
 */
export async function confirmarCortePersonal(usuarioActual, corteId) {
  const usuarioId = usuarioActual.id;
  const corte = await requireCortePersonalAbierto(usuarioId, corteId);

  const items = await prisma.corteItemPersonal.findMany({
    where: { cortePersonalId: corteId, incluido: true },
    include: { instancia: { include: { concepto: true } } },
  });

  for (const item of items) {
    if (item.monto == null) {
      throw new HttpError(
        409,
        'Hay un ítem incluido sin definir su monto — complétalo o desmárcalo antes de confirmar',
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      await tx.gastoRecurrentePersonalInstancia.update({
        where: { id: item.instanciaId },
        data: { estado: 'liquidado' },
      });
      await tx.gastoPersonal.create({
        data: {
          usuarioId,
          categoria: item.instancia.concepto.categoria,
          monto: item.monto,
          fecha: corte.fechaNominal,
          descripcion: item.instancia.concepto.nombre,
          tipo: 'recurrente',
          origen: 'app',
        },
      });
    }

    await tx.cortePersonal.update({
      where: { id: corteId },
      data: { estado: 'cerrado', fechaEjecucion: new Date() },
    });
  });

  return obtenerCortePersonal(usuarioActual, corteId);
}
