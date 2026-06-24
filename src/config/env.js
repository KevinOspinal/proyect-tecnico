// Carga las variables del archivo .env en process.env
import 'dotenv/config';

// Lista de variables sin las cuales la app no puede arrancar
const required = ['DATABASE_URL', 'PORT'];

// Filtra las que no están definidas
const missing = required.filter((key) => !process.env[key]);

// Si falta alguna, imprime exactamente cuál es y detiene el proceso (fail-fast)
if (missing.length > 0) {
  console.error(`[env] Variables de entorno faltantes: ${missing.join(', ')}`);
  console.error('[env] Revisa .env.example para ver los valores esperados.');
  process.exit(1);
}

// Se exportan con tipos correctos; el resto de la app nunca lee process.env directamente
export const DATABASE_URL = process.env.DATABASE_URL;
export const PORT = Number(process.env.PORT);
