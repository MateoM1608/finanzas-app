import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import {
  calcularPeriodoActual,
  calcularPeriodosPendientes,
  calcularProximaFechaNominalPendiente,
} from '../../utils/periodoActual.js';
import { asegurarInstanciasRecurrentes } from '../gastosRecurrentes/gastosRecurrentes.service.js';
import { obtenerSplitVigente, calcularReparto } from '../../utils/reparto.js';

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
      include: { ...includeComun, concepto: { select: { nombre: true, tipoMonto: true } } },
    });
    if (!instancia) return null;
    return {
      nombre: instancia.concepto.nombre,
      tipoMonto: instancia.concepto.tipoMonto,
      pagador: instancia.pagador,
      repartos: instancia.repartos,
    };
  }

  const gasto = await prisma.gastoVariablePareja.findUnique({
    where: { id: origenId },
    include: includeComun,
  });
  if (!gasto) return null;
  return { nombre: gasto.item, tipoMonto: null, pagador: gasto.pagador, repartos: gasto.repartos };
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
  // OJO: ya no se filtra por `monto: { not: null }` — un concepto recurrente
  // de monto variable (ej. Mercado, Gasolina) se genera con monto null, y si
  // se excluyera aquí nunca podría entrar a un corte para que alguien le
  // defina el precio ahí mismo (quedaría atrapado para siempre). Ahora entra
  // sin precio y `confirmarCorte` exige completarlo antes de cerrar.
  const instancias = await prisma.gastoRecurrenteInstancia.findMany({
    where: {
      concepto: { hogarId },
      estado: 'pendiente',
      fechaNominal: { lte: fechaObjetivo },
    },
  });
  const variables = await prisma.gastoVariablePareja.findMany({
    where: { hogarId, estado: 'pendiente', fechaLimite: { lte: fechaObjetivo } },
  });
  return { instancias, variables };
}

/**
 * Junta los pendientes (recurrentes + variables) con fecha ≤ `fechaNominal`
 * que todavía no tienen un CorteItem en este corte, y los agrega. Se usa
 * tanto al crear un corte nuevo como al reabrir uno ya `abierto` — así un
 * corte que quedó abierto antes de que existiera un concepto recurrente (o
 * de que se generara su instancia) lo recoge en la siguiente visita, en vez
 * de quedarse pegado para siempre con lo que tenía al crearse.
 */
async function agregarPendientesAlCorte(hogarId, corteId, fechaNominal) {
  const existentes = await prisma.corteItem.findMany({
    where: { corteId },
    select: { tipoOrigen: true, origenId: true },
  });
  const yaIncluido = new Set(existentes.map((e) => `${e.tipoOrigen}:${e.origenId}`));

  const { instancias, variables } = await buscarPendientes(hogarId, fechaNominal);
  const nuevasInstancias = instancias.filter((i) => !yaIncluido.has(`recurrente:${i.id}`));
  const nuevasVariables = variables.filter((v) => !yaIncluido.has(`variable:${v.id}`));
  if (!nuevasInstancias.length && !nuevasVariables.length) return;

  await prisma.$transaction(async (tx) => {
    const items = [
      ...nuevasInstancias.map((i) => ({
        corteId,
        tipoOrigen: 'recurrente',
        origenId: i.id,
        monto: i.monto,
      })),
      ...nuevasVariables.map((v) => ({
        corteId,
        tipoOrigen: 'variable',
        origenId: v.id,
        monto: v.valorTotal,
      })),
    ];

    await tx.corteItem.createMany({ data: items });

    for (const i of nuevasInstancias) {
      await tx.gastoRecurrenteInstancia.update({
        where: { id: i.id },
        data: { estado: 'incluido_en_corte' },
      });
    }
    for (const v of nuevasVariables) {
      await tx.gastoVariablePareja.update({
        where: { id: v.id },
        data: { estado: 'incluido_en_corte' },
      });
    }
  });
}

export async function iniciarCorte(usuarioActual) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);

  const hogar = await prisma.hogar.findUnique({ where: { id: hogarId } });
  const puntosCorte = await prisma.puntoCorteHogar.findMany({ where: { hogarId } });
  const cortesExistentes = await prisma.corte.findMany({
    where: { hogarId },
    select: { fechaNominal: true },
  });
  const fechasUsadas = new Set(cortesExistentes.map((c) => c.fechaNominal.getTime()));
  const fechasCerradas = cortesExistentes.map((c) => c.fechaNominal);

  // Antes de buscar pendientes hay que ASEGURAR que existan las instancias de
  // cada concepto recurrente para todo punto todavía no cerrado (atraso) y
  // para el período actual — si no, un concepto (ej. Arriendo) que nadie
  // visitó a tiempo en Panel del hogar nunca tendría instancia y jamás
  // aparecería como pendiente, aunque su fecha ya haya pasado.
  const periodoActual = calcularPeriodoActual(hogar, puntosCorte);
  const periodosPendientes = calcularPeriodosPendientes(hogar, puntosCorte, fechasCerradas);
  const periodosAAsegurar = [...periodosPendientes, periodoActual];
  for (const p of periodosAAsegurar) {
    await asegurarInstanciasRecurrentes(hogarId, p.puntoCorte, p.periodoInicio, p.fechaNominal);
  }

  const abierto = await prisma.corte.findFirst({ where: { hogarId, estado: 'abierto' } });
  if (abierto) {
    await agregarPendientesAlCorte(hogarId, abierto.id, abierto.fechaNominal);
    return { corte: await obtenerCorte(usuarioActual, abierto.id), motivo: null };
  }

  // Primero probamos con cualquier atraso acumulado (períodos ya terminados y sin cerrar).
  // Si ahí no hay nada pendiente de verdad, caemos al período ACTUAL — aunque su fecha
  // nominal todavía no haya llegado. Sin esto, un concepto recurrente que ya se
  // registró este período (ej. arriendo, mercado) nunca sería incluible en un corte
  // hasta que el período completo terminara, mientras que los gastos variables sí
  // podían tener cualquier fecha pasada y colarse igual.
  let fechaNominal = null;

  const candidatoAtraso = calcularProximaFechaNominalPendiente(hogar, puntosCorte, fechasCerradas);
  if (candidatoAtraso && !fechasUsadas.has(candidatoAtraso.fechaNominal.getTime())) {
    const encontrados = await buscarPendientes(hogarId, candidatoAtraso.fechaNominal);
    if (encontrados.instancias.length || encontrados.variables.length) {
      fechaNominal = candidatoAtraso.fechaNominal;
    }
  }

  if (!fechaNominal && !fechasUsadas.has(periodoActual.fechaNominal.getTime())) {
    const encontrados = await buscarPendientes(hogarId, periodoActual.fechaNominal);
    if (encontrados.instancias.length || encontrados.variables.length) {
      fechaNominal = periodoActual.fechaNominal;
    }
  }

  if (!fechaNominal) {
    return { corte: null, motivo: 'No hay ningún gasto pendiente para incluir en un corte todavía' };
  }

  const nuevoCorte = await prisma.corte.create({
    data: {
      hogarId,
      fechaNominal,
      creadoPorUsuarioId: usuarioActual.id,
    },
  });
  await agregarPendientesAlCorte(hogarId, nuevoCorte.id, fechaNominal);

  return { corte: await obtenerCorte(usuarioActual, nuevoCorte.id), motivo: null };
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

/**
 * Define el monto y/o el pagador de un ítem dentro de un corte abierto.
 * Existe porque los conceptos recurrentes de monto variable (ej. servicios
 * públicos) llegan al corte sin monto — el motor los genera con `monto: null`
 * — y ahora se definen aquí mismo en Cortes, no en Panel del hogar. Solo
 * aplica a ítems `recurrente`: los `variable` (gastos puntuales) ya traen su
 * valorTotal definido desde que se crearon.
 */
export async function actualizarItemCorte(usuarioActual, corteId, itemId, data) {
  const hogarId = requireHogarId(usuarioActual);
  requirePermisoEdicion(usuarioActual);
  await requireCorteAbierto(hogarId, corteId);

  const item = await prisma.corteItem.findUnique({ where: { id: itemId } });
  if (!item || item.corteId !== corteId) {
    throw new HttpError(404, 'Ítem no encontrado en este corte');
  }
  if (data.monto !== undefined && item.tipoOrigen !== 'recurrente') {
    throw new HttpError(409, 'El monto de un gasto variable puntual no se edita desde el corte');
  }
  if (data.pagoUsuarioId) {
    const pertenece = await prisma.usuario.count({ where: { id: data.pagoUsuarioId, hogarId } });
    if (!pertenece) {
      throw new HttpError(400, 'El pagador debe ser un miembro de tu hogar');
    }
  }

  await prisma.$transaction(async (tx) => {
    if (item.tipoOrigen === 'recurrente') {
      await tx.gastoRecurrenteInstancia.update({
        where: { id: item.origenId },
        data: {
          monto: data.monto ?? undefined,
          pagoUsuarioId: data.pagoUsuarioId === undefined ? undefined : data.pagoUsuarioId,
        },
      });

      if (data.monto !== undefined) {
        await tx.gastoRecurrenteInstanciaReparto.deleteMany({ where: { instanciaId: item.origenId } });
        const split = await obtenerSplitVigente(hogarId, 'general', tx);
        if (data.monto != null && split.length) {
          const repartos = calcularReparto(data.monto, split);
          await tx.gastoRecurrenteInstanciaReparto.createMany({
            data: repartos.map((r) => ({ instanciaId: item.origenId, ...r })),
          });
        }
      }
    } else if (data.pagoUsuarioId !== undefined) {
      await tx.gastoVariablePareja.update({
        where: { id: item.origenId },
        data: { pagoUsuarioId: data.pagoUsuarioId },
      });
    }

    if (data.monto !== undefined) {
      await tx.corteItem.update({ where: { id: itemId }, data: { monto: data.monto } });
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
    if (item.monto == null) {
      throw new HttpError(
        409,
        'Hay un ítem incluido sin definir su monto — complétalo o desmárcalo antes de confirmar',
      );
    }
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
