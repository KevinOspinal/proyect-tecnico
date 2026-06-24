import { Router } from 'express';
import * as statesController from '../controllers/states.controller.js';

const router = Router();

// GET /api/states — devuelve todos los estados disponibles
router.get('/', statesController.listar);

export default router;
