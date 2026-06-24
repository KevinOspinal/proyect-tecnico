import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import {
  idParamsSchema,
  crearInteraccionSchema,
  cambiarEstadoSchema,
  listarSchema,
} from '../validators/interactions.schema.js';
import * as interactionsController from '../controllers/interactions.controller.js';

const router = Router();

// POST /api/interactions — crea una interacción
router.post(
  '/',
  validate(crearInteraccionSchema),
  interactionsController.crear
);

// PATCH /api/interactions/:id/estado — cambia el estado
router.patch(
  '/:id/estado',
  validate(idParamsSchema, 'params'),  // valida que :id sea UUID antes de llegar al service
  validate(cambiarEstadoSchema),
  interactionsController.cambiarEstado
);

// GET /api/interactions — lista con filtros y paginación
router.get(
  '/',
  validate(listarSchema, 'query'),
  interactionsController.listar
);

export default router;
