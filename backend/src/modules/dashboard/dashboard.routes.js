import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getDashboardPersonal, getDashboardHogar } from './dashboard.controller.js';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get('/personal', getDashboardPersonal);
dashboardRouter.get('/hogar', getDashboardHogar);
