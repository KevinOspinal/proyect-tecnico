import * as interactionsRepo from '../repositories/interactions.repository.js';

/**
 * Compone las métricas de operación para un rango de fechas.
 *
 * Los BigInt que devuelve prisma.$queryRaw (PostgreSQL COUNT, etc.)
 * se convierten a Number aquí para que sean serializables a JSON.
 *
 * @param {Date} from  Inicio del rango (inclusive)
 * @param {Date} to    Fin del rango (inclusive)
 */
export async function obtenerMetricas(from, to) {
  // Ambas consultas son independientes → se ejecutan en paralelo
  const [filasPorAgente, filasVolumen] = await Promise.all([
    interactionsRepo.metricasPorAgente(from, to),
    interactionsRepo.volumenPorDia(from, to),
  ]);

  return {
    porAgente: filasPorAgente.map((row) => ({
      agentId: row.agentId,
      agentName: row.agentName,
      total: Number(row.total),
      resueltas: Number(row.resueltas),
      // tasaResolucion: porcentaje 0-100 con 2 decimales (ej. 87.50)
      tasaResolucion: Number(row.tasaResolucion ?? 0),
      // tiempoPromedio: segundos enteros, null si el agente no tiene interacciones resueltas
      tiempoPromedioSegundos: row.tiempoPromedioSegundos != null
        ? Math.round(Number(row.tiempoPromedioSegundos))
        : null,
    })),
    volumenPorDia: filasVolumen.map((row) => ({
      // dia ya llega como string 'YYYY-MM-DD' desde Postgres (::date)
      dia: row.dia,
      total: Number(row.total),
      resueltas: Number(row.resueltas),
    })),
  };
}
