import { Router } from 'express';
import interactionsRouter from './interactions.routes.js';
import metricsRouter from './metrics.routes.js';
import statesRouter from './states.routes.js';

const router = Router();

router.use('/interactions', interactionsRouter);
router.use('/metrics', metricsRouter);
router.use('/states', statesRouter);

export default router;
