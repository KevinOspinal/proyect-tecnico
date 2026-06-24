import * as agentsRepo from '../repositories/agents.repository.js';
import * as interactionsRepo from '../repositories/interactions.repository.js';
import { NotFoundError, ConflictError } from '../domain/errors.js';
import {
  STATUS,
  puedeTransicionar,
  debeEstamparClosedAt,
} from '../domain/interactionStatus.js';

/**
 * Crea una nueva interacción para un agente.
 * - Verifica que el agente exista antes de insertar.
 * - openedAt se estampa aquí si el cliente no lo envía.
 * - El status inicial siempre es 'abierta'; el cliente no puede sobreescribirlo.
 */
export async function crearInteraccion({ agentId, type, openedAt }) {
  const agente = await agentsRepo.findById(agentId);
  if (!agente) {
    throw new NotFoundError(`Agente con id "${agentId}" no encontrado.`);
  }

  return interactionsRepo.crear({
    agentId,
    type,
    status: STATUS.abierta,
    openedAt: openedAt ? new Date(openedAt) : new Date(),
  });
}

/**
 * Cambia el estado de una interacción validando la máquina de estados.
 * - closedAt se estampa aquí cuando el destino es 'resuelta'.
 *   El cliente nunca envía closedAt directamente (sería falsificable).
 */
export async function cambiarEstado(id, nuevoEstado) {
  const interaccion = await interactionsRepo.findById(id);
  if (!interaccion) {
    throw new NotFoundError(`Interacción con id "${id}" no encontrada.`);
  }

  if (!puedeTransicionar(interaccion.status, nuevoEstado)) {
    throw new ConflictError(
      `Transición "${interaccion.status}" → "${nuevoEstado}" no permitida.`
    );
  }

  // Solo se estampa closedAt si la transición lleva a 'resuelta'
  const closedAt = debeEstamparClosedAt(nuevoEstado) ? new Date() : undefined;

  return interactionsRepo.actualizarEstado(id, { status: nuevoEstado, closedAt });
}

/**
 * Lista interacciones con filtros opcionales y paginación.
 *
 * Filtros aceptados:
 *   agentId   → filtra por agente
 *   status    → filtra por estado
 *   desde/hasta → rango sobre openedAt (strings ISO o Date)
 *   page / pageSize → paginación (defaults: 1 / 20)
 *
 * El conteo y la lista se ejecutan en paralelo para reducir latencia.
 */
export async function listarInteracciones({
  agentId,
  status,
  desde,
  hasta,
  page = 1,
  pageSize = 20,
} = {}) {
  // Construye el filtro where dinámicamente con solo los campos que vienen
  const where = {};
  if (agentId) where.agentId = agentId;
  if (status) where.status = status;
  if (desde || hasta) {
    where.openedAt = {};
    if (desde) where.openedAt.gte = new Date(desde);
    if (hasta) where.openedAt.lte = new Date(hasta);
  }

  const skip = (page - 1) * pageSize;

  // Consulta de datos y conteo en paralelo: una sola ida a la BD
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
