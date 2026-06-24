import { Router } from 'express';
import interactionsRouter from './interactions.routes.js';
import metricsRouter from './metrics.routes.js';

const router = Router();

// Todos los endpoints del negocio viven bajo /api
router.use('/interactions', interactionsRouter);
router.use('/metrics', metricsRouter);

export default router;
