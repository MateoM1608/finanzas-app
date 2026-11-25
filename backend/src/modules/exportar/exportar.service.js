import ExcelJS from 'exceljs';
import { prisma } from '../../config/prisma.js';
import { gastosDeConsumo } from '../../utils/consumo.js';
import { listarPrestamos } from '../prestamos/prestamos.service.js';

/**
 * Exportar datos (XLSX o CSV). Cada tabla se arma con lo que el usuario
 * puede ver en la app: sus datos personales (filtrados por usuarioId) y los
 * de su hogar, sin la cuenta con que pagó otro miembro. Nada se guarda: el
 * archivo se genera en cada pedido.
 */

export const TABLAS = {
  movimientos: 'Movimientos',
  consumo: 'Consumo por mes',
  hogar: 'Hogar',
  cuadres: 'Cuadres',
  prestamos: 'Préstamos',
  ahorros: 'Inversiones y ahorros',
};

const ORIGEN = {
  app: 'Personal',
  bot: 'Personal (bot)',
  cuadre_hogar: 'Cuadre del hogar',
  pago_hogar: 'Pago del hogar',
  liquidacion_hogar: 'Liquidación de cuadre',
  pago_tarjeta: 'Pago de tarjeta',
  abono_prestamo: 'Abono a préstamo',
  desembolso_prestamo: 'Desembolso de préstamo',
  aporte_inversion: 'Aporte a inversión',
  retiro_inversion: 'Retiro de inversión',
  aporte_meta_hogar: 'Aporte a meta del hogar',
  retiro_meta_hogar: 'Retiro de meta del hogar',
  aporte_ahorro: 'Aporte a ahorro',
  retiro_ahorro: 'Retiro de ahorro',
};

const ESTADO = {
  pagado: 'Pagado',
  pendiente: 'Pendiente',
  recibido: 'Recibido',
  por_pagar: 'Por pagar',
  en_cuadre: 'En cuadre',
  cuadrado: 'Cuadrado',
};

const fechaTexto = (f) => (f ? new Date(f).toISOString().slice(0, 10) : '');
const mesTexto = (f) => fechaTexto(f).slice(0, 7);

function filtroFecha(rango) {
  return rango.desde || rango.hasta ? { ...(rango.desde && { gte: rango.desde }), ...(rango.hasta && { lte: rango.hasta }) } : undefined;
}

// --- Tablas: { columnas: [{ key, header, tipo? }], filas: [{...}] } ---

async function tablaMovimientos(usuario, rango) {
  const fecha = filtroFecha(rango);
  const [gastos, ingresos] = await Promise.all([
    prisma.gastoPersonal.findMany({
      where: { usuarioId: usuario.id, ...(fecha && { fecha }) },
      include: { metodoPago: true, categoria: true },
      orderBy: { fecha: 'asc' },
    }),
    prisma.ingresoPersonal.findMany({
      where: { usuarioId: usuario.id, ...(fecha && { fecha }) },
      include: { metodoPago: true, categoria: true },
      orderBy: { fecha: 'asc' },
    }),
  ]);
  const filas = [
    ...gastos.map((g) => ({ ...g, tipo: 'Gasto', signo: -1 })),
    ...ingresos.map((i) => ({ ...i, tipo: 'Ingreso', signo: 1 })),
  ]
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    .map((m) => ({
      fecha: fechaTexto(m.fecha),
      tipo: m.tipo,
      descripcion: m.descripcion ?? '',
      categoria: m.categoria?.nombre ?? '',
      cuenta: m.metodoPago?.nombre ?? '',
      estado: ESTADO[m.estado] ?? m.estado,
      origen: m.prestamoId ? 'Cuota de préstamo' : m.compraId ? 'Cuota de compra' : (ORIGEN[m.origen] ?? m.origen),
      obligatorio: m.esObligatorio ? 'Sí' : '',
      monto: m.monto,
      valor: m.signo * m.monto,
    }));
  return {
    columnas: [
      { key: 'fecha', header: 'Fecha' },
      { key: 'tipo', header: 'Tipo' },
      { key: 'descripcion', header: 'Descripción' },
      { key: 'categoria', header: 'Categoría' },
      { key: 'cuenta', header: 'Cuenta' },
      { key: 'estado', header: 'Estado' },
      { key: 'origen', header: 'Origen' },
      { key: 'obligatorio', header: 'Obligatorio' },
      { key: 'monto', header: 'Monto', tipo: 'pesos' },
      { key: 'valor', header: 'Valor (+ entra / − sale)', tipo: 'pesos' },
    ],
    filas,
  };
}

async function tablaConsumo(usuario, rango) {
  const consumo = await gastosDeConsumo(usuario.id, rango.desde || rango.hasta ? { gte: rango.desde, lte: rango.hasta } : undefined);
  const totales = new Map();
  for (const g of consumo) {
    const clave = `${mesTexto(g.fecha)}|${g.categoria || 'Sin categoría'}`;
    totales.set(clave, (totales.get(clave) ?? 0) + g.monto);
  }
  const filas = [...totales.entries()]
    .map(([clave, total]) => {
      const [mes, categoria] = clave.split('|');
      return { mes, categoria, total };
    })
    .sort((a, b) => a.mes.localeCompare(b.mes) || b.total - a.total);
  return {
    columnas: [
      { key: 'mes', header: 'Mes' },
      { key: 'categoria', header: 'Categoría' },
      { key: 'total', header: 'Gastado', tipo: 'pesos' },
    ],
    filas,
  };
}

async function miembrosDe(usuario) {
  if (!usuario.hogarId) return [];
  return prisma.usuario.findMany({ where: { hogarId: usuario.hogarId }, select: { id: true, nombre: true }, orderBy: { creadoEn: 'asc' } });
}

function tipoGastoHogar(g) {
  if (g.prestamoId) return 'Cuota de préstamo';
  if (g.abonoPrestamoId) return 'Abono a préstamo';
  if (g.compraId) return 'Cuota de compra';
  return 'Gasto variable';
}

async function tablaHogar(usuario, rango) {
  const miembros = await miembrosDe(usuario);
  const columnas = [
    { key: 'fecha', header: 'Fecha' },
    { key: 'tipo', header: 'Tipo' },
    { key: 'concepto', header: 'Concepto' },
    { key: 'valor', header: 'Valor', tipo: 'pesos' },
    { key: 'pago', header: 'Pagó' },
    { key: 'estado', header: 'Estado' },
    ...miembros.map((m) => ({ key: `parte_${m.id}`, header: `Parte de ${m.nombre}`, tipo: 'pesos' })),
  ];
  if (!usuario.hogarId) return { columnas, filas: [] };
  const fecha = filtroFecha(rango);
  const nombre = new Map(miembros.map((m) => [m.id, m.nombre]));
  const [cuotas, variables] = await Promise.all([
    prisma.gastoRecurrenteInstancia.findMany({
      where: { concepto: { hogarId: usuario.hogarId }, estado: { not: 'por_pagar' }, ...(fecha && { fecha }) },
      include: { concepto: { select: { nombre: true } }, repartos: true },
    }),
    prisma.gastoVariablePareja.findMany({
      where: { hogarId: usuario.hogarId, estado: { not: 'por_pagar' }, ...(fecha && { fecha }) },
      include: { repartos: true },
    }),
  ]);
  const fila = (base, repartos) => ({
    ...base,
    ...Object.fromEntries(miembros.map((m) => [`parte_${m.id}`, repartos.find((r) => r.usuarioId === m.id)?.monto ?? 0])),
  });
  const filas = [
    ...cuotas.map((c) =>
      fila(
        {
          fecha: fechaTexto(c.fecha),
          tipo: 'Cuenta fija',
          concepto: c.concepto.nombre,
          valor: c.monto ?? 0,
          pago: nombre.get(c.pagoUsuarioId) ?? '',
          estado: ESTADO[c.estado] ?? c.estado,
        },
        c.repartos,
      ),
    ),
    ...variables.map((g) =>
      fila(
        {
          fecha: fechaTexto(g.fecha),
          tipo: tipoGastoHogar(g),
          concepto: g.numeroCuota ? `${g.item} (cuota ${g.numeroCuota})` : g.item,
          valor: g.valorTotal,
          pago: nombre.get(g.pagoUsuarioId) ?? '',
          estado: ESTADO[g.estado] ?? g.estado,
        },
        g.repartos,
      ),
    ),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { columnas, filas };
}

async function tablaCuadres(usuario, rango) {
  const miembros = await miembrosDe(usuario);
  const columnas = [
    { key: 'fecha', header: 'Fecha' },
    { key: 'items', header: 'Ítems' },
    { key: 'total', header: 'Total cuadrado', tipo: 'pesos' },
    ...miembros.map((m) => ({ key: `balance_${m.id}`, header: `Balance de ${m.nombre} (+ le deben)`, tipo: 'pesos' })),
  ];
  if (!usuario.hogarId) return { columnas, filas: [] };
  // cerradoEn guarda la hora: el día "hasta" se incluye completo.
  const cerradoEn =
    rango.desde || rango.hasta
      ? {
          ...(rango.desde && { gte: rango.desde }),
          ...(rango.hasta && { lt: new Date(rango.hasta.getTime() + 24 * 60 * 60 * 1000) }),
        }
      : undefined;
  const cuadres = await prisma.cuadre.findMany({
    where: { hogarId: usuario.hogarId, estado: 'cerrado', ...(cerradoEn && { cerradoEn }) },
    include: { balances: true, items: { where: { incluido: true } } },
    orderBy: { cerradoEn: 'asc' },
  });
  const filas = cuadres.map((c) => ({
    fecha: fechaTexto(c.fecha ?? c.cerradoEn),
    items: c.items.length,
    total: c.items.reduce((a, i) => a + (i.monto ?? 0), 0),
    ...Object.fromEntries(miembros.map((m) => [`balance_${m.id}`, c.balances.find((b) => b.usuarioId === m.id)?.balance ?? 0])),
  }));
  return { columnas, filas };
}

async function tablaPrestamos(usuario) {
  const { personales, hogar } = await listarPrestamos(usuario);
  const filas = [...personales, ...hogar].flatMap((p) =>
    p.cuotas.map((c) => ({
      prestamo: p.nombre,
      ambito: p.ambito === 'hogar' ? 'Hogar' : 'Personal',
      cuota: c.numero,
      vencimiento: fechaTexto(c.fechaVencimiento),
      capital: c.capital ?? 0,
      interes: c.interes ?? 0,
      seguro: c.seguro ?? 0,
      mora: c.mora ?? 0,
      total: c.monto,
      tuParte: c.miParte,
      estado: c.pagada ? 'Pagada' : 'Por pagar',
      fechaPago: fechaTexto(c.fechaPago),
    })),
  );
  return {
    columnas: [
      { key: 'prestamo', header: 'Préstamo' },
      { key: 'ambito', header: 'De' },
      { key: 'cuota', header: 'Cuota' },
      { key: 'vencimiento', header: 'Vence' },
      { key: 'capital', header: 'Capital', tipo: 'pesos' },
      { key: 'interes', header: 'Interés', tipo: 'pesos' },
      { key: 'seguro', header: 'Seguro', tipo: 'pesos' },
      { key: 'mora', header: 'Mora', tipo: 'pesos' },
      { key: 'total', header: 'Cuota total', tipo: 'pesos' },
      { key: 'tuParte', header: 'Tu parte', tipo: 'pesos' },
      { key: 'estado', header: 'Estado' },
      { key: 'fechaPago', header: 'Pagada el' },
    ],
    filas,
  };
}

async function tablaAhorros(usuario, rango) {
  const fecha = filtroFecha(rango);
  const miembros = await miembrosDe(usuario);
  const nombre = (id) => (id === usuario.id ? 'Tú' : (miembros.find((m) => m.id === id)?.nombre ?? ''));
  const visibles = { OR: [{ usuarioId: usuario.id, hogarId: null }, ...(usuario.hogarId ? [{ hogarId: usuario.hogarId }] : [])] };
  const [inversiones, valoraciones, metas, ahorros] = await Promise.all([
    prisma.inversionMovimiento.findMany({ where: { inversion: visibles, ...(fecha && { fecha }) }, include: { inversion: true } }),
    prisma.inversionValoracion.findMany({ where: { inversion: visibles, ...(fecha && { fecha }) }, include: { inversion: true } }),
    usuario.hogarId
      ? prisma.metaHogarMovimiento.findMany({ where: { meta: { hogarId: usuario.hogarId }, ...(fecha && { fecha }) }, include: { meta: true } })
      : [],
    prisma.ahorroTransaccion.findMany({ where: { ahorro: { usuarioId: usuario.id }, ...(fecha && { fecha }) }, include: { ahorro: true } }),
  ]);
  const MOV = { aporte: 'Aporte', retiro: 'Retiro' };
  const filas = [
    ...inversiones.map((m) => ({
      fecha: fechaTexto(m.fecha),
      tipo: m.inversion.hogarId ? 'Inversión del hogar' : 'Inversión',
      nombre: m.inversion.nombre,
      movimiento: MOV[m.tipo],
      quien: nombre(m.usuarioId),
      monto: m.monto,
    })),
    ...valoraciones.map((v) => ({
      fecha: fechaTexto(v.fecha),
      tipo: v.inversion.hogarId ? 'Inversión del hogar' : 'Inversión',
      nombre: v.inversion.nombre,
      movimiento: 'Valor actualizado',
      quien: '',
      monto: v.valor,
    })),
    ...metas.map((m) => ({
      fecha: fechaTexto(m.fecha),
      tipo: 'Meta del hogar',
      nombre: m.meta.nombre,
      movimiento: MOV[m.tipo],
      quien: nombre(m.usuarioId),
      monto: m.monto,
    })),
    ...ahorros.map((t) => ({
      fecha: fechaTexto(t.fecha),
      tipo: 'Ahorro personal',
      nombre: t.ahorro.nombre,
      movimiento: t.origen === 'automatico' ? 'Débito automático' : MOV[t.tipo],
      quien: 'Tú',
      monto: t.monto,
    })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return {
    columnas: [
      { key: 'fecha', header: 'Fecha' },
      { key: 'tipo', header: 'Tipo' },
      { key: 'nombre', header: 'Nombre' },
      { key: 'movimiento', header: 'Movimiento' },
      { key: 'quien', header: 'Quién' },
      { key: 'monto', header: 'Monto', tipo: 'pesos' },
    ],
    filas,
  };
}

const ARMAR = {
  movimientos: tablaMovimientos,
  consumo: tablaConsumo,
  hogar: tablaHogar,
  cuadres: tablaCuadres,
  prestamos: tablaPrestamos,
  ahorros: tablaAhorros,
};

export function armarTabla(usuario, clave, rango) {
  return ARMAR[clave](usuario, rango);
}

// --- Formatos ---

/** CSV para Excel en español: separador ";", BOM UTF-8 (tildes) y fin de línea CRLF. */
export function aCsv(tabla) {
  const celda = (v) => {
    const texto = v == null ? '' : String(v);
    return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const lineas = [
    tabla.columnas.map((c) => celda(c.header)).join(';'),
    ...tabla.filas.map((f) => tabla.columnas.map((c) => celda(f[c.key])).join(';')),
  ];
  return `﻿${lineas.join('\r\n')}\r\n`;
}

/** Libro XLSX con una hoja por tabla, encabezado fijo y montos con formato de pesos. */
export async function aXlsx(tablas) {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Finanzas';
  libro.created = new Date();
  for (const [clave, tabla] of tablas) {
    const hoja = libro.addWorksheet(TABLAS[clave], { views: [{ state: 'frozen', ySplit: 1 }] });
    hoja.columns = tabla.columnas.map((c) => ({
      header: c.header,
      key: c.key,
      width: Math.max(12, c.header.length + 2),
      style: c.tipo === 'pesos' ? { numFmt: '"$"#,##0;[Red]-"$"#,##0' } : {},
    }));
    hoja.getRow(1).font = { bold: true };
    hoja.addRows(tabla.filas);
    if (!tabla.filas.length) hoja.addRow({ [tabla.columnas[0].key]: 'Sin datos en este rango' });
  }
  return libro.xlsx.writeBuffer();
}
