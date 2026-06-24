import { z } from 'zod';

// Reutilizable: parsea un string ISO 8601 (con offset) y lo convierte a Date
const isoFecha = z
  .string({ required_error: 'La fecha es requerida.' })
  .datetime({ offset: true, message: 'Debe ser una fecha ISO 8601 válida (ej. 2025-01-15T10:00:00Z).' })
  .transform((s) => new Date(s));

// ─── Schema: parámetros de ruta (:id) ────────────────────────────────────────
export const idParamsSchema = z.object({
  id: z.string().uuid('id debe ser un UUID válido.'),
});

// ─── Schema: crear interacción ────────────────────────────────────────────────
export const crearInteraccionSchema = z.object({
  agentId: z
    .string({ required_error: 'agentId es requerido.' })
    .uuid('agentId debe ser un UUID válido.'),

  type: z.enum(['llamada', 'ticket'], {
    errorMap: () => ({ message: 'type debe ser "llamada" o "ticket".' }),
  }),

  // openedAt es opcional; si no viene, el service estampa new Date()
  openedAt: isoFecha.optional(),
});

// ─── Schema: cambiar estado ───────────────────────────────────────────────────
export const cambiarEstadoSchema = z.object({
  status: z.enum(['abierta', 'en_progreso', 'resuelta'], {
    errorMap: () => ({
      message: 'status debe ser "abierta", "en_progreso" o "resuelta".',
    }),
  }),
});

// ─── Schema: listar interacciones (query params) ──────────────────────────────
export const listarSchema = z
  .object({
    agentId: z.string().uuid('agentId debe ser un UUID válido.').optional(),
    status: z.enum(['abierta', 'en_progreso', 'resuelta']).optional(),
    from: isoFecha.optional(),
    to: isoFecha.optional(),
    // Los query params llegan como strings; z.coerce los convierte a número
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(
    (data) => !data.from || !data.to || data.from <= data.to,
    { message: '"from" debe ser anterior o igual a "to".', path: ['from'] }
  );
