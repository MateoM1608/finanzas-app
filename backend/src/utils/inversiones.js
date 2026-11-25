/**
 * Cálculos de inversiones y metas del hogar (entrega D2). COP enteros.
 */

const DIA = 24 * 60 * 60 * 1000;

function suma(items) {
  return items.reduce((a, m) => a + m.monto, 0);
}

/** Interés compuesto a una tasa efectiva anual entre dos fechas. */
function crecer(monto, tasaEA, desde, hasta) {
  const dias = Math.max(0, (new Date(hasta) - new Date(desde)) / DIA);
  return monto * (1 + tasaEA / 100) ** (dias / 365);
}

/** Valor de una lista de aportes/retiros con su tasa, a una fecha. */
function valorEstimado(movimientos, tasaEA, hasta) {
  return Math.round(
    movimientos
      .filter((m) => new Date(m.fecha) <= hasta)
      .reduce((a, m) => a + (m.tipo === 'aporte' ? 1 : -1) * crecer(m.monto, tasaEA, m.fecha, hasta), 0),
  );
}

/**
 * Valor y resultado de una inversión:
 * - valorActual: la última valoración más los aportes y menos los retiros
 *   posteriores a ella; sin valoraciones, si tiene tasa (CDT), lo estimado a
 *   hoy (tope: el vencimiento); si no, lo puesto (aportes − retiros).
 * - ganancia = valorActual + retiros − aportes; rentabilidad sobre aportes.
 * - valorAlVencer: con tasa y vencimiento, lo estimado a esa fecha.
 */
export function calcularInversion(inversion, movimientos, valoraciones, hoy) {
  const aportes = suma(movimientos.filter((m) => m.tipo === 'aporte'));
  const retiros = suma(movimientos.filter((m) => m.tipo === 'retiro'));
  const ultima = [...valoraciones].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0] ?? null;
  const tope = inversion.fechaVencimiento && new Date(inversion.fechaVencimiento) < hoy ? new Date(inversion.fechaVencimiento) : hoy;

  let valorActual;
  let origenValor;
  if (ultima) {
    const despues = movimientos.filter((m) => new Date(m.fecha) > new Date(ultima.fecha));
    valorActual = ultima.valor + suma(despues.filter((m) => m.tipo === 'aporte')) - suma(despues.filter((m) => m.tipo === 'retiro'));
    origenValor = 'valoracion';
  } else if (inversion.tasaEA) {
    valorActual = valorEstimado(movimientos, inversion.tasaEA, tope);
    origenValor = 'estimado';
  } else {
    valorActual = aportes - retiros;
    origenValor = 'aportes';
  }
  valorActual = Math.max(0, valorActual);
  const ganancia = valorActual + retiros - aportes;
  return {
    aportes,
    retiros,
    valorActual,
    origenValor,
    ultimaValoracion: ultima,
    ganancia,
    rentabilidadPct: aportes ? (ganancia / aportes) * 100 : null,
    valorAlVencer:
      inversion.tasaEA && inversion.fechaVencimiento
        ? valorEstimado(movimientos, inversion.tasaEA, new Date(inversion.fechaVencimiento))
        : null,
  };
}

/**
 * Participación de cada miembro según lo que ha puesto (aportes − retiros).
 * Devuelve Map usuarioId → fracción (0..1). Si lo neto no es positivo, por aportes.
 */
export function participaciones(movimientos) {
  const neto = new Map();
  const aportes = new Map();
  for (const m of movimientos) {
    const signo = m.tipo === 'aporte' ? 1 : -1;
    neto.set(m.usuarioId, (neto.get(m.usuarioId) ?? 0) + signo * m.monto);
    if (m.tipo === 'aporte') aportes.set(m.usuarioId, (aportes.get(m.usuarioId) ?? 0) + m.monto);
  }
  const positivos = [...neto.entries()].filter(([, v]) => v > 0);
  const base = positivos.length ? new Map(positivos) : aportes;
  const total = [...base.values()].reduce((a, v) => a + v, 0);
  return new Map([...base.entries()].map(([id, v]) => [id, total ? v / total : 0]));
}

/** Meta del hogar: ahorrado, por miembro, progreso y cuánto falta al mes para la fecha meta. */
export function calcularMeta(meta, movimientos, hoy) {
  const porMiembro = new Map();
  for (const m of movimientos) {
    porMiembro.set(m.usuarioId, (porMiembro.get(m.usuarioId) ?? 0) + (m.tipo === 'aporte' ? m.monto : -m.monto));
  }
  const ahorrado = [...porMiembro.values()].reduce((a, v) => a + v, 0);
  const falta = Math.max(0, meta.montoMeta - ahorrado);
  let mesesRestantes = null;
  let faltaAlMes = null;
  if (meta.fechaMeta && falta > 0) {
    const f = new Date(meta.fechaMeta);
    mesesRestantes = Math.max(1, (f.getUTCFullYear() - hoy.getUTCFullYear()) * 12 + (f.getUTCMonth() - hoy.getUTCMonth()));
    faltaAlMes = Math.ceil(falta / mesesRestantes);
  }
  return {
    ahorrado,
    falta,
    progresoPct: meta.montoMeta ? Math.min(100, (ahorrado / meta.montoMeta) * 100) : 0,
    cumplida: ahorrado >= meta.montoMeta,
    mesesRestantes,
    faltaAlMes,
    porMiembro: [...porMiembro.entries()].map(([usuarioId, monto]) => ({ usuarioId, monto })),
  };
}
