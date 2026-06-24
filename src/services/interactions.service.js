import * as agentsRepo from '../repositories/agents.repository.js';
import * as interactionsRepo from '../repositories/interactions.repository.js';
import { NotFoundError, ConflictError } from '../domain/errors.js';
import {
  STATUS,
  puedeTransicionar,
  debeEstamparClosedAt,
  debeEstamparInProgressAt,
} from '../domain/interactionStatus.js';

export async function crearInteraccion({ agentId, type, openedAt }) {
  const agente = await agentsRepo.findById(agentId);
  if (!agente) {
    throw new NotFoundError(`Agente con id "${agentId}" no encontrado.`);
  }

  return interactionsRepo.crear({
    agentId,
    type,
    state:    { connect: { name: STATUS.abierto } },
    openedAt: openedAt ? new Date(openedAt) : new Date(),
  });
}

export async function cambiarEstado(id, nuevoEstado) {
  const interaccion = await interactionsRepo.findById(id);
  if (!interaccion) {
    throw new NotFoundError(`Interacción con id "${id}" no encontrada.`);
  }

  if (!puedeTransicionar(interaccion.state.name, nuevoEstado)) {
    throw new ConflictError(
      `Transición "${interaccion.state.name}" → "${nuevoEstado}" no permitida.`
    );
  }

  const closedAt     = debeEstamparClosedAt(nuevoEstado)     ? new Date() : undefined;
  const inProgressAt = debeEstamparInProgressAt(nuevoEstado) ? new Date() : undefined;

  return interactionsRepo.actualizarEstado(id, { state: nuevoEstado, closedAt, inProgressAt });
}

export async function listarInteracciones({
  agentId,
  status,
  desde,
  hasta,
  page = 1,
  pageSize = 20,
} = {}) {
  const where = {};
  if (agentId) where.agentId = agentId;
  if (status)  where.state   = { name: status };
  if (desde || hasta) {
    where.openedAt = {};
    if (desde) where.openedAt.gte = new Date(desde);
    if (hasta) where.openedAt.lte = new Date(hasta);
  }

  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    interactionsRepo.listar({ where, skip, take: pageSize }),
    interactionsRepo.contar(where),
  ]);

  return {
    data,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}
