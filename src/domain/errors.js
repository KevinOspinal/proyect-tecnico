/**
 * Clase base para todos los errores operacionales de la aplicación.
 * "Operacional" significa que el error es esperado y controlado (ej. validación
 * fallida, recurso no encontrado), a diferencia de un error de programación inesperado.
 *
 * El errorHandler central usa isOperational para decidir si loguear el stack trace.
 */
export class AppError extends Error {
  constructor(message, statusCode, details) {
    super(message);
    this.name = this.constructor.name; // "ValidationError", "NotFoundError", etc.
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details; // opcional: detalles extra (ej. campos inválidos de Zod)
  }
}

// 400 — la petición tiene datos inválidos o malformados
export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, details);
  }
}

// 404 — el recurso solicitado no existe en la base de datos
export class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404);
  }
}

// 409 — la operación entra en conflicto con el estado actual del recurso
// (ej. transición de estado inválida, email duplicado)
export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
  }
}
