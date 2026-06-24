/**
 * Envuelve un handler async para que cualquier rechazo de Promise
 * se propague al errorHandler central vía next(err).
 *
 * Sin esto, Express 4 no captura errores de async/await y el servidor
 * queda colgado sin responder.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
