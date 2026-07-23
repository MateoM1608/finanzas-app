import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './modules/auth/auth.routes.js';
import { hogaresRouter } from './modules/hogares/hogares.routes.js';
import { gastosPersonalesRouter } from './modules/gastosPersonales/gastosPersonales.routes.js';
import { conceptosRecurrentesRouter } from './modules/conceptosRecurrentes/conceptosRecurrentes.routes.js';
import { splitPorcentajeRouter } from './modules/splitPorcentaje/splitPorcentaje.routes.js';
import { gastosRecurrentesRouter } from './modules/gastosRecurrentes/gastosRecurrentes.routes.js';
import { gastosVariablesRouter } from './modules/gastosVariables/gastosVariables.routes.js';
import { cortesRouter } from './modules/cortes/cortes.routes.js';
import { metodosPagoPersonalesRouter } from './modules/metodosPagoPersonales/metodosPagoPersonales.routes.js';
import { categoriasPersonalesRouter } from './modules/categoriasPersonales/categoriasPersonales.routes.js';
import { gastosFijosConfigRouter } from './modules/gastosFijosConfig/gastosFijosConfig.routes.js';
import { ingresosFijosConfigRouter } from './modules/ingresosFijosConfig/ingresosFijosConfig.routes.js';
import { ingresosPersonalesRouter } from './modules/ingresosPersonales/ingresosPersonales.routes.js';
import { cicloPersonalRouter } from './modules/cicloPersonal/cicloPersonal.routes.js';
import { resumenPersonalRouter } from './modules/resumenPersonal/resumenPersonal.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/hogares', hogaresRouter);
app.use('/api/gastos-personales', gastosPersonalesRouter);
app.use('/api/conceptos-recurrentes', conceptosRecurrentesRouter);
app.use('/api/split-porcentaje', splitPorcentajeRouter);
app.use('/api/gastos-recurrentes', gastosRecurrentesRouter);
app.use('/api/gastos-variables', gastosVariablesRouter);
app.use('/api/cortes', cortesRouter);
app.use('/api/metodos-pago-personales', metodosPagoPersonalesRouter);
app.use('/api/categorias-personales', categoriasPersonalesRouter);
app.use('/api/gastos-fijos-config', gastosFijosConfigRouter);
app.use('/api/ingresos-fijos-config', ingresosFijosConfigRouter);
app.use('/api/ingresos-personales', ingresosPersonalesRouter);
app.use('/api/ciclo-personal', cicloPersonalRouter);
app.use('/api/resumen-personal', resumenPersonalRouter);

app.use(notFoundHandler);
app.use(errorHandler);
