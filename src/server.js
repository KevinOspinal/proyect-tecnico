// La validación de variables de entorno debe correr ANTES de importar cualquier otra cosa
import './config/env.js';
import { PORT } from './config/env.js';
import app from './app.js';

// Único lugar donde se hace el bind al puerto — así los tests pueden importar app sin abrir sockets
app.listen(PORT, () => {
  console.log(`[server] Engage 360 API corriendo en el puerto ${PORT}`);
});
