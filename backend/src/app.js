import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './modules/auth/auth.routes.js';
import { hogaresRouter } from './modules/hogares/hogares.routes.js';
import { gastosPersonalesRouter } from './modules/gastosPersonales/gastosPersonales.routes.js';
import { conceptosRecurrentesRouter } from './modules/conceptosRecurrentes/conceptosRecurrentes.routes.js';
import { splitPorcentajeRouter } from './modules/splitPorcentaje/splitPorcentaje.routes.js';
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

app.use(notFoundHandler);
app.use(errorHandler);
