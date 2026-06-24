import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';

// Crea una nueva interacción y devuelve el registro completo
export async function crear(data) {
  return prisma.interaction.create({ data });
}

// Busca una interacción por id; devuelve null si no existe
export async function findById(id) {
  return prisma.interaction.findUnique({ where: { id } });
}

// Actualiza el estado (y opcionalmente closedAt) de una interacción
export async function actualizarEstado(id, { status, closedAt }) {
  return prisma.interaction.update({
    where: { id },
    data: { status, closedAt },
  });
}

/**
 * Lista interacciones aplicando filtros y paginación.
 * @param {{ where: object, skip: number, take: number }} opciones
 */
export async function listar({ where, skip, take }) {
  return prisma.interaction.findMany({
    where,
    skip,
    take,
    orderBy: { openedAt: 'desc' },
    include: { agent: { select: { id: true, name: true, email: true } } },
  });
}

// Cuenta el total de interacciones que cumplen el where (para calcular totalPages)
export async function contar(where) {
  return prisma.interaction.count({ where });
}

/**
 * Métricas por agente en un rango de fechas.
 *
 * Se usa SQL crudo porque necesitamos COUNT FILTER y AVG de intervalos —
 * operaciones que Prisma no expone directamente en su API de alto nivel.
 *
 * tasaResolucion: porcentaje 0-100 redondeado a 2 decimales.
 * tiempoPromedioSegundos: segundos promedio desde openedAt hasta closedAt,
 *   solo para interacciones resueltas.
 */
export async function metricasPorAgente(from, to) {
  return prisma.$queryRaw`
    SELECT
      a.id                                                          AS "agentId",
      a.name                                                        AS "agentName",
      COUNT(*)                                                      AS total,
      COUNT(*) FILTER (WHERE i.status = 'resuelta')                AS resueltas,
      ROUND(
        COUNT(*) FILTER (WHERE i.status = 'resuelta')::numeric
        / NULLIF(COUNT(*), 0) * 100,
        2
      )                                                            AS "tasaResolucion",
      AVG(EXTRACT(EPOCH FROM (i.closed_at - i.opened_at)))
        FILTER (WHERE i.status = 'resuelta')                       AS "tiempoPromedioSegundos"
    FROM interactions i
    JOIN agents a ON a.id = i.agent_id
    WHERE i.opened_at >= ${from} AND i.opened_at <= ${to}
    GROUP BY a.id, a.name
    ORDER BY a.name
  `;
}

/**
 * Volumen de interacciones agrupado por día en hora de Colombia (UTC-5).
 *
 * La conversión AT TIME ZONE 'America/Bogota' ocurre ANTES de truncar al día,
 * para que una interacción abierta a las 8 p.m. en Cali pertenezca a ese día
 * y no al siguiente (que sería en UTC).
 */
export async function volumenPorDia(from, to) {
  return prisma.$queryRaw`
    SELECT
      date_trunc('day', opened_at AT TIME ZONE 'America/Bogota')::date AS dia,
      COUNT(*)                                              AS total,
      COUNT(*) FILTER (WHERE status = 'resuelta')          AS resueltas
    FROM interactions
    WHERE opened_at >= ${from} AND opened_at <= ${to}
    GROUP BY dia
    ORDER BY dia
  `;
}
