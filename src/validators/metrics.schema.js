import { z } from 'zod';

// Parsea un string ISO 8601 con offset y lo convierte a Date
const isoFecha = z
  .string({ required_error: 'La fecha es requerida.' })
  .datetime({ offset: true, message: 'Debe ser una fecha ISO 8601 válida (ej. 2025-01-15T10:00:00Z).' })
  .transform((s) => new Date(s));

// ─── Schema: obtener métricas (query params) ──────────────────────────────────
// from y to son obligatorios; sin rango no hay métrica útil
export const obtenerMetricasSchema = z
  .object({
    from: isoFecha,
    to: isoFecha,
  })
  .refine(
    (data) => data.from <= data.to,
    { message: '"from" debe ser anterior o igual a "to".', path: ['from'] }
  );
