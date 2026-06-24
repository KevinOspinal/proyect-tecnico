import { asyncHandler } from '../utils/asyncHandler.js';
import * as metricsService from '../services/metrics.service.js';

/**
 * GET /api/metrics — devuelve métricas de operación para un rango de fechas.
 * req.query.from y req.query.to ya son objetos Date (transformados por Zod).
 */
export const obtenerMetricas = asyncHandler(async (req, res) => {
  const resultado = await metricsService.obtenerMetricas(req.query.from, req.query.to);
  res.status(200).json(resultado);
});
