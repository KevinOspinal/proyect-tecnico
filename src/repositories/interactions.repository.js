import prisma from '../config/prisma.js';

const includeRelations = {
  agent: { select: { id: true, name: true, email: true } },
  state: true,
};

export async function crear(data) {
  return prisma.interaction.create({ data, include: includeRelations });
}

export async function findById(id) {
  return prisma.interaction.findUnique({ where: { id }, include: { state: true } });
}

export async function actualizarEstado(id, { state, closedAt, inProgressAt }) {
  return prisma.interaction.update({
    where: { id },
    data:  { state: { connect: { name: state } }, closedAt, inProgressAt },
    include: includeRelations,
  });
}

export async function listar({ where, skip, take }) {
  return prisma.interaction.findMany({
    where,
    skip,
    take,
    orderBy: { openedAt: 'desc' },
    include: includeRelations,
  });
}

export async function contar(where) {
  return prisma.interaction.count({ where });
}

export async function metricasPorAgente(from, to) {
  return prisma.$queryRaw`
    SELECT
      a.id                                                             AS "agentId",
      a.name                                                           AS "agentName",
      COUNT(*)                                                         AS total,
      COUNT(*) FILTER (WHERE s.name = 'finalizado')                   AS resueltas,
      ROUND(
        COUNT(*) FILTER (WHERE s.name = 'finalizado')::numeric
        / NULLIF(COUNT(*), 0) * 100,
        2
      )                                                               AS "tasaResolucion",
      AVG(EXTRACT(EPOCH FROM (i.closed_at - i.opened_at)))
        FILTER (WHERE s.name = 'finalizado')                          AS "tiempoPromedioSegundos"
    FROM interactions i
    JOIN agents a ON a.id = i.agent_id
    JOIN states s ON s.id = i.state_id
    WHERE i.opened_at >= ${from} AND i.opened_at <= ${to}
    GROUP BY a.id, a.name
    ORDER BY a.name
  `;
}

export async function volumenPorDia(from, to) {
  return prisma.$queryRaw`
    SELECT
      date_trunc('day', i.opened_at AT TIME ZONE 'America/Bogota')::date AS dia,
      COUNT(*)                                                AS total,
      COUNT(*) FILTER (WHERE s.name = 'finalizado')          AS resueltas
    FROM interactions i
    JOIN states s ON s.id = i.state_id
    WHERE i.opened_at >= ${from} AND i.opened_at <= ${to}
    GROUP BY dia
    ORDER BY dia
  `;
}
