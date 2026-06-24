import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { obtenerMetricasSchema } from '../validators/metrics.schema.js';
import * as metricsController from '../controllers/metrics.controller.js';

const router = Router();

// GET /api/metrics — métricas para un rango de fechas
router.get(
  '/',
  validate(obtenerMetricasSchema, 'query'),
  metricsController.obtenerMetricas
);

export default router;
