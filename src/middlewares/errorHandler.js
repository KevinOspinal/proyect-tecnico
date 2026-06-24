/**
 * Manejador central de errores — debe ser el ÚLTIMO middleware registrado en app.js.
 * Express lo reconoce como manejador de errores porque recibe 4 argumentos.
 *
 * Estrategia de 3 niveles:
 *   1. Entrada   → validate middleware rechaza datos inválidos antes del controller
 *   2. Negocio   → services/domain lanzan AppError con isOperational=true
 *   3. Aquí      → distingue operacional vs inesperado; nunca filtra stacks al cliente
 */
export function errorHandler(err, req, res, next) {
  // ── Error operacional (ValidationError, NotFoundError, ConflictError, etc.) ──
  // Son errores esperados: tienen statusCode y mensaje seguros para enviar al cliente.
  if (err.isOperational) {
    const body = {
      error: err.name,
      message: err.message,
    };
    // details solo existe en ValidationError (campos inválidos de Zod)
    if (err.details !== undefined) {
      body.details = err.details;
    }
    return res.status(err.statusCode).json(body);
  }

  // ── Error no operacional (bug, excepción inesperada, fallo de Prisma, etc.) ──
  // Loguear internamente para investigación; el cliente recibe solo un mensaje genérico.
  // Nunca se expone err.message ni err.stack al exterior.
  console.error('[errorHandler] Error no operacional:', err);

  res.status(500).json({
    error: 'InternalServerError',
    message: 'Ocurrió un error interno. Por favor intenta de nuevo más tarde.',
  });
}
