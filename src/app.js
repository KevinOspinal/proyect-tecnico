import express from 'express';
import cors from 'cors';
import apiRouter from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

// Permite peticiones desde cualquier origen (ajustar en producción si es necesario)
app.use(cors());

// Habilita la lectura del cuerpo de las peticiones en formato JSON
app.use(express.json());

// Ruta de salud — fuera de /api para que no requiera autenticación en el futuro
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Todas las rutas del negocio bajo /api
app.use('/api', apiRouter);

// El errorHandler SIEMPRE va al final; Express lo identifica por tener 4 parámetros
app.use(errorHandler);

export default app;
