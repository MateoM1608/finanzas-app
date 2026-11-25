import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './modules/auth/auth.routes.js';
import { hogaresRouter } from './modules/hogares/hogares.routes.js';
import { gastosPersonalesRouter } from './modules/gastosPersonales/gastosPersonales.routes.js';
import { conceptosRecurrentesRouter } from './modules/conceptosRecurrentes/conceptosRecurrentes.routes.js';
import { splitPorcentajeRouter } from './modules/splitPorcentaje/splitPorcentaje.routes.js';
import { cuentasHogarRouter } from './modules/cuentasHogar/cuentasHogar.routes.js';
import { gastosVariablesRouter } from './modules/gastosVariables/gastosVariables.routes.js';
import { cuadresRouter } from './modules/cuadres/cuadres.routes.js';
import { metodosPagoPersonalesRouter } from './modules/metodosPagoPersonales/metodosPagoPersonales.routes.js';
import { categoriasPersonalesRouter } from './modules/categoriasPersonales/categoriasPersonales.routes.js';
import { gastosFijosConfigRouter } from './modules/gastosFijosConfig/gastosFijosConfig.routes.js';
import { ingresosFijosConfigRouter } from './modules/ingresosFijosConfig/ingresosFijosConfig.routes.js';
import { ingresosPersonalesRouter } from './modules/ingresosPersonales/ingresosPersonales.routes.js';
import { cicloPersonalRouter } from './modules/cicloPersonal/cicloPersonal.routes.js';
import { resumenPersonalRouter } from './modules/resumenPersonal/resumenPersonal.routes.js';
import { ahorrosPersonalesRouter } from './modules/ahorrosPersonales/ahorrosPersonales.routes.js';
import { comprasCuotasPersonalesRouter } from './modules/comprasCuotasPersonales/comprasCuotasPersonales.routes.js';
import { comprasCuotasHogarRouter } from './modules/comprasCuotasHogar/comprasCuotasHogar.routes.js';
import { proyeccionPersonalRouter } from './modules/proyeccionPersonal/proyeccionPersonal.routes.js';
import { informeMetodosRouter } from './modules/informeMetodos/informeMetodos.routes.js';
import { extractosTarjetaRouter } from './modules/extractosTarjeta/extractosTarjeta.routes.js';
import { prestamosRouter } from './modules/prestamos/prestamos.routes.js';
import { inversionesRouter } from './modules/inversiones/inversiones.routes.js';
import { metasHogarRouter } from './modules/metasHogar/metasHogar.routes.js';
import { exportarRouter } from './modules/exportar/exportar.routes.js';
import { limitesPersonalesRouter } from './modules/limitesPersonales/limitesPersonales.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const app = express();

// En producción el frontend llama a /api por el rewrite de Vercel (mismo
// origen), así que CORS solo hace falta en desarrollo. FRONTEND_URL limita a
// qué orígenes se aceptan credenciales cuando sí se llama directo.
// Sin FRONTEND_URL: abierto en desarrollo, cerrado en producción.
const origenesPermitidos = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((o) => o.trim())
  : process.env.NODE_ENV !== 'production';
app.disable('x-powered-by');
app.use((req, res, next) => {
  // Es una API JSON: nada se muestra en un iframe ni se interpreta como otro tipo.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use(cors({ origin: origenesPermitidos, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/hogares', hogaresRouter);
app.use('/api/gastos-personales', gastosPersonalesRouter);
app.use('/api/conceptos-recurrentes', conceptosRecurrentesRouter);
app.use('/api/split-porcentaje', splitPorcentajeRouter);
app.use('/api/cuentas-hogar', cuentasHogarRouter);
app.use('/api/gastos-variables', gastosVariablesRouter);
app.use('/api/cuadres', cuadresRouter);
app.use('/api/metodos-pago-personales', metodosPagoPersonalesRouter);
app.use('/api/categorias-personales', categoriasPersonalesRouter);
app.use('/api/gastos-fijos-config', gastosFijosConfigRouter);
app.use('/api/ingresos-fijos-config', ingresosFijosConfigRouter);
app.use('/api/ingresos-personales', ingresosPersonalesRouter);
app.use('/api/ciclo-personal', cicloPersonalRouter);
app.use('/api/resumen-personal', resumenPersonalRouter);
app.use('/api/ahorros-personales', ahorrosPersonalesRouter);
app.use('/api/limites-personales', limitesPersonalesRouter);
app.use('/api/compras-cuotas-personales', comprasCuotasPersonalesRouter);
app.use('/api/compras-cuotas-hogar', comprasCuotasHogarRouter);
app.use('/api/proyeccion-personal', proyeccionPersonalRouter);
app.use('/api/informe-metodos', informeMetodosRouter);
app.use('/api/extractos-tarjeta', extractosTarjetaRouter);
app.use('/api/prestamos', prestamosRouter);
app.use('/api/inversiones', inversionesRouter);
app.use('/api/metas-hogar', metasHogarRouter);
app.use('/api/exportar', exportarRouter);

app.use(notFoundHandler);
app.use(errorHandler);
