import { asyncHandler } from '../utils/asyncHandler.js';
import * as statesService from '../services/states.service.js';

export const listar = asyncHandler(async (_req, res) => {
  const estados = await statesService.listarEstados();
  res.status(200).json(estados);
});
