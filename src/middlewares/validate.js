import { ValidationError } from '../domain/errors.js';

/**
 * Factory de middleware de validación.
 *
 * Recibe un schema Zod y la parte de req a validar ('body' | 'query' | 'params').
 * Si la validación falla, pasa un ValidationError 400 al errorHandler central
 * con los detalles de cada campo inválido.
 * Si pasa, reemplaza req[fuente] por los datos ya parseados y transformados por Zod
 * (ej. strings ISO → Date, strings numéricos → number).
 *
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} fuente
 */
export function validate(schema, fuente = 'body') {
  return (req, res, next) => {
    const resultado = schema.safeParse(req[fuente]);

    if (!resultado.success) {
      // Aplanar los errores de Zod a un formato legible por el cliente
      const details = resultado.error.errors.map((e) => ({
        campo: e.path.join('.') || 'raíz',
        mensaje: e.message,
      }));
      // next(error) en vez de throw: Express 4 no captura throws en middlewares síncronos
      return next(new ValidationError('Datos de entrada inválidos.', details));
    }

    // Reemplazamos con los datos ya parseados para que el controller reciba tipos correctos
    req[fuente] = resultado.data;
    next();
  };
}
