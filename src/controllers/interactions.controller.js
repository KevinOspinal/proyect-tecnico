import { asyncHandler } from '../utils/asyncHandler.js';
import * as interactionsService from '../services/interactions.service.js';

/**
 * POST /api/interactions — crea una nueva interacción.
 * req.body ya viene validado y tipado por el middleware validate.
 * El controller solo traduce: HTTP → service → HTTP.
 */
export const crear = asyncHandler(async (req, res) => {
  const interaccion = await interactionsService.crearInteraccion(req.body);
  res.status(201).json(interaccion);
});

/**
 * PATCH /api/interactions/:id/estado — cambia el estado de una interacción.
 * El service aplica la máquina de estados; el controller no conoce las reglas.
 */
export const cambiarEstado = asyncHandler(async (req, res) => {
  const interaccion = await interactionsService.cambiarEstado(
    req.params.id,
    req.body.status
  );
  res.status(200).json(interaccion);
});

/**
 * GET /api/interactions — lista interacciones con filtros y paginación.
 * req.query ya fue parseado por Zod (strings → Dates, strings → números).
 */
export const listar = asyncHandler(async (req, res) => {
  const resultado = await interactionsService.listarInteracciones(req.query);
  res.status(200).json(resultado);
});
