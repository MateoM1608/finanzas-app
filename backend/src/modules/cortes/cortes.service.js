import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { calcularPeriodoActual, calcularProximaFechaNominalPendiente } from '../../utils/periodoActual.js';

const INCLUDE_CORTE = {
  items: true,
  balances: { include: { usuario: { select: { id: true, nombre: true } } } },
  creadoPor: { select: { id: true, nombre: true } },
};

function requireHogarId(usuarioActual) {
  if (!usuarioActual.hogarId) {
    throw new HttpError(409, 'No perteneces a ningún hogar todavía');
  }
  return usuarioActual.hogarId;
}

function requirePermisoEdicion(usuarioActual) {
  if (!usuarioActual.esAdmin && !usuarioActual.puedeEditarGastos) {
    throw new HttpError(403, 'No tienes permiso para gestionar los cortes del hogar');
  }
}

async function requireCorteAbierto(hogarId, corteId) {
  const corte = await prisma.corte.findUnique({ where: { id: corteId } });
  if (!corte || corte.hogarId !== hogarId) {
    throw new HttpError(404, 'Corte no encontrado');
  }
  if (corte.estado !== 'abierto') {
    throw new HttpError(409, 'Este corte ya está cerrado');
  }
  return corte;
}

async function obtenerOrigen(tipoOrigen, origenId) {
  if (tipoOrigen === 'recurrente') {
    return prisma.gastoRecurrenteInstancia.findUnique({
      where: { id: origenId },
      include: { repartos: true },
    });
  }
  return prisma.gastoVariablePareja.findUnique({
    where: { id: origenId },
    include: { repartos: true },
  });
}

function montoDelOrigen(tipoOrigen, origen) {
  return tipoOrigen === 'recurrente' ? origen.monto : origen.valorTotal;
}

async function obtenerOrigenDetallado(tipoOrigen, origenId) {
  const includeComun = {
    pagador: { select: { id: true, nombre: true } },
    repartos: { include: { usuario: { select: { id: true, nombre: true } } } },
  };

  if (tipoOrigen === 'recurrente') {
    const instancia = await prisma.gastoRecurrenteInstancia.findUnique({
      where: { id: origenId },
      include: { ...includeComun, concepto: { select: { nombre: true } } },
    });
    if (!instancia) return null;
    return { nombre: instancia.concepto.nombre, pagador: instancia.pagador, repartos: instancia.repartos };
  }

  const gasto = await prisma.gastoVariablePareja.findUnique({
    where: { id: origenId },
    include: includeComun,
  });
  if (!gasto) return null;
  return { nombre: gasto.item, pagador: gasto.pagador, repartos: gasto.repartos };
}

async function enriquecerCorte(corte) {
  if (!corte) return corte;
  const items = await Promise.all(
    corte.items.map(async (item) => ({
      ...item,
      ...(await obtenerOrigenDetallado(item.tipoOrigen, item.origenId)),
    })),
  );
  return { ...corte, items };
}

async function actualizarEstadoOrigen(tx, tipoOrigen, origenId, estado) {
  if (tipoOrigen === 'recurrente') {
    await tx.gastoRecurrenteInstancia.update({ where: { id: origenId }, data: { estado } });
  } else {
    await tx.gastoVariablePareja.update({ where: { id: origenId }, data: { estado } });
  }
}

export async function listarCortes(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  const cortes = await prisma.corte.findMany({
    where: { hogarId },
    orderBy: { fechaNominal: 'desc' },
    include: INCLUDE_CORTE,
  });
  return Promise.all(cortes.map(enriquecerCorte));
}

export async function obtenerCorteAbierto(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  const corte = await prisma.corte.findFirst({
    where: { hogarId, estado: 'abierto' },
    include: INCLUDE_CORTE,
  });
  return enriquecerCorte(corte);
}

export async function obtenerCorte(usuarioActual, corteId) {
  const hogarId = requireHogarId(usuarioActual);
  const corte = await prisma.corte.findUnique({ where: { id: corteId }, include: INCLUDE_CORTE });
  if (!corte || corte.hogarId !== hogarId) {
    throw new HttpError(404, 'Corte no encontrado');
  }
  return enriquecerCorte(corte);
}

async function buscarPendientes(hogarId, fechaObjetivo) {
  const instancias = await prisma.gastoRecurrenteInstancia.findMany({
    where: {
      concepto: { hogarId },
      estado: 'pendiente',
      monto: { not: null },
      fechaNominal: { lte: fechaObjetivo },
    },
  });
  const variables = await prisma.gastoVariablePareja.findMany({
    where: { hogarId, estado: 'pendiente', fechaLimite: { lte: fechaObjetivo } },
  });
  return { instancias, variables };
}

export async function iniciarCorte(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);

  const abierto = await prisma.corte.findFirst({ where: { hogarId, estado: 'abierto' } });
  if (abierto) {
    return { corte: await obtenerCorte(usuarioActual, abierto.id), motivo: null };
  }

  const hogar = await prisma.hogar.findUnique({ where: { id: hogarId } });
  const puntosCorte = await prisma.puntoCorteHogar.findMany({ where: { hogarId } });
  const cortesExistentes = await prisma.corte.findMany({
    where: { hogarId },
    select: { fechaNominal: true },
  });
  const fechasUsadas = new Set(cortesExistentes.map((c) => c.fechaNominal.getTime()));

  // Primero probamos con cualquier atraso acumulado (períodos ya terminados y sin cerrar).
  // Si ahí no hay nada pendiente de verdad, caemos al período ACTUAL — el mismo que
  // Panel del hogar usa para generar las instancias recurrentes — aunque su fecha
  // nominal todavía no haya llegado. Sin esto, un concepto recurrente que ya se
  // registró este período (ej. arriendo, mercado) nunca sería incluible en un corte
  // hasta que el período completo terminara, mientras que los gastos variables sí
  // podían tener cualquier fecha pasada y colarse igual.
  let fechaNominal = null;
  let pendientes = { instancias: [], variables: [] };

  const candidatoAtraso = calcularProximaFechaNominalPendiente(
    hogar,
    puntosCorte,
    cortesExistentes.map((c) => c.fechaNominal),
  );
  if (candidatoAtraso && !fechasUsadas.has(candidatoAtraso.fecha.getTime())) {
    const encontrados = await buscarPendientes(hogarId, candidatoAtraso.fecha);
    if (encontrados.instancias.length || encontrados.variables.length) {
      fechaNominal = candidatoAtraso.fecha;
      pendientes = encontrados;
    }
  }

  if (!fechaNominal) {
    const periodoActual = calcularPeriodoActual(hogar, puntosCorte);
    if (!fechasUsadas.has(periodoActual.fechaNominal.getTime())) {
      const encontrados = await buscarPendientes(hogarId, periodoActual.fechaNominal);
      if (encontrados.instancias.length || encontrados.variables.length) {
        fechaNominal = periodoActual.fechaNominal;
        pendientes = encontrados;
      }
    }
  }

  if (!fechaNominal) {
    return { corte: null, motivo: 'No hay ningún gasto pendiente para incluir en un corte todavía' };
  }

  const { instancias: instanciasPendientes, variables: variablesPendientes } = pendientes;

  const corte = await prisma.$transaction(async (tx) => {
    const nuevoCorte = await tx.corte.create({
      data: {
        hogarId,
        fechaNominal,
        creadoPorUsuarioId: usuarioActual.id,
      },
    });

    const items = [
      ...instanciasPendientes.map((i) => ({
        corteId: nuevoCorte.id,
        tipoOrigen: 'recurrente',
        origenId: i.id,
        monto: i.monto,
      })),
      ...variablesPendientes.map((v) => ({
        corteId: nuevoCorte.id,
        tipoOrigen: 'variable',
        origenId: v.id,
        monto: v.valorTotal,
      })),
    ];

    await tx.corteItem.createMany({ data: items });

    for (const i of instanciasPendientes) {
      await tx.gastoRecurrenteInstancia.update({
        where: { id: i.id },
        data: { estado: 'incluido_en_corte' },
      });
    }
    for (const v of variablesPendientes) {
      await tx.gastoVariablePareja.update({
        where: { id: v.id },
        data: { estado: 'incluido_en_corte' },
      });
    }

    return nuevoCorte;
  });

  return { corte: await obtenerCorte(usuarioActual, corte.id), motivo: null };
}

export async function togglearItem(usuarioActual, corteId, itemId, incluido) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  await requireCorteAbierto(hogarId, corteId);

  const item = await prisma.corteItem.findUnique({ where: { id: itemId } });
  if (!item || item.corteId !== corteId) {
    throw new HttpError(404, 'Ítem no encontrado en este corte');
  }

  await prisma.$transaction(async (tx) => {
    if (incluido) {
      const origen = await obtenerOrigen(item.tipoOrigen, item.origenId);
      const monto = montoDelOrigen(item.tipoOrigen, origen);
      if (monto == null) {
        throw new HttpError(409, 'Este gasto todavía no tiene un monto definido');
      }
      await tx.corteItem.update({ where: { id: itemId }, data: { incluido: true, monto } });
      await actualizarEstadoOrigen(tx, item.tipoOrigen, item.origenId, 'incluido_en_corte');
    } else {
      await tx.corteItem.update({ where: { id: itemId }, data: { incluido: false } });
      await actualizarEstadoOrigen(tx, item.tipoOrigen, item.origenId, 'pendiente');
    }
  });

  return obtenerCorte(usuarioActual, corteId);
}

export async function confirmarCorte(usuarioActual, corteId) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  const corte = await requireCorteAbierto(hogarId, corteId);

  const items = await prisma.corteItem.findMany({ where: { corteId, incluido: true } });

  const balancePorMiembro = new Map();
  const sumar = (usuarioId, delta) => {
    balancePorMiembro.set(usuarioId, (balancePorMiembro.get(usuarioId) ?? 0) + delta);
  };

  for (const item of items) {
    const origen = await obtenerOrigen(item.tipoOrigen, item.origenId);
    const pagoUsuarioId = origen.pagoUsuarioId;
    if (!pagoUsuarioId) {
      throw new HttpError(
        409,
        'Hay un ítem incluido sin definir quién pagó — complétalo o desmárcalo antes de confirmar',
      );
    }
    sumar(pagoUsuarioId, item.monto);
    for (const reparto of origen.repartos) {
      sumar(reparto.usuarioId, -reparto.monto);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      await actualizarEstadoOrigen(tx, item.tipoOrigen, item.origenId, 'liquidado');
    }

    await tx.corteBalanceMiembro.createMany({
      data: [...balancePorMiembro.entries()].map(([usuarioId, balance]) => ({
        corteId,
        usuarioId,
        balance,
      })),
    });

    await tx.corte.update({
      where: { id: corteId },
      data: { estado: 'cerrado', fechaEjecucion: new Date() },
    });
  });

  return obtenerCorte(usuarioActual, corteId);
}
