# Engage 360 API

Backend de mini contact center para WeKall. Gestiona interacciones de agentes (llamadas y tickets) con métricas de operación agrupadas por hora local de Colombia (UTC-5).

## Stack

- **Node.js >= 18** + Express — JavaScript puro, ES Modules
- **PostgreSQL** — base de datos relacional
- **Prisma 5** — ORM y migraciones
- **Zod** — validación de entrada en runtime

## Requisitos previos

- Node.js 18 o superior
- PostgreSQL corriendo localmente o en Docker

**Con Docker (opción rápida):**
```bash
docker run -d --name engage360-db \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -p 5432:5432 \
  postgres:15
```

## Instalación y arranque

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de entorno
cp .env.example .env
# Editar .env con tus credenciales reales

# 3. Aplicar migraciones (crea las tablas)
npm run prisma:migrate

# 4. Cargar datos de prueba (350 interacciones, 6 agentes)
npm run prisma:seed

# 5. Arrancar en modo desarrollo (hot reload)
npm run dev
```

## Variables de entorno

| Variable       | Ejemplo                                              | Descripción                        |
|----------------|------------------------------------------------------|------------------------------------|
| `DATABASE_URL` | `postgresql://postgres@localhost:5432/engage360`     | Cadena de conexión a PostgreSQL    |
| `PORT`         | `3000`                                               | Puerto en que escucha el servidor  |

El archivo `.env.example` incluye las variables requeridas con valores de referencia. La app hace **fail-fast**: si alguna variable falta, aborta al arrancar con un mensaje claro.

## Scripts disponibles

| Script                  | Descripción                                      |
|-------------------------|--------------------------------------------------|
| `npm run dev`           | Arrancar con nodemon (hot reload)                |
| `npm start`             | Arrancar en modo producción                      |
| `npm test`              | Ejecutar tests de la capa de dominio             |
| `npm run prisma:migrate`| Aplicar migraciones pendientes                   |
| `npm run prisma:seed`   | Poblar la base de datos con datos de prueba      |
| `npm run prisma:studio` | Abrir Prisma Studio (explorador visual de datos) |

## Endpoints

Base URL: `http://localhost:3000`

### Salud

| Método | Ruta      | Descripción                  |
|--------|-----------|------------------------------|
| `GET`  | `/health` | Verifica que el servidor esté activo |

### Interacciones — `POST /api/interactions`

Crea una nueva interacción. El status inicial siempre es `abierta`.

**Body:**
```json
{
  "agentId": "uuid-del-agente",
  "type": "llamada",
  "openedAt": "2026-06-23T22:30:00-05:00"
}
```

| Campo      | Tipo   | Requerido | Descripción                                  |
|------------|--------|-----------|----------------------------------------------|
| `agentId`  | UUID   | Sí        | ID del agente responsable                    |
| `type`     | string | Sí        | `"llamada"` o `"ticket"`                     |
| `openedAt` | ISO 8601 | No      | Fecha de apertura; si se omite el servidor estampa `now()` |

**Respuesta:** `201 Created` con el objeto de la interacción.

---

### Interacciones — `PATCH /api/interactions/:id/estado`

Cambia el estado siguiendo la máquina de estados:
- `abierta` → `en_progreso`, `resuelta`
- `en_progreso` → `resuelta`
- `resuelta` → *(estado terminal, ninguna transición permitida)*

Al pasar a `resuelta`, el servidor estampa `closedAt` automáticamente.

**Body:**
```json
{ "status": "en_progreso" }
```

**Respuesta:** `200 OK` con el objeto actualizado, o `409 Conflict` si la transición no es válida.

---

### Interacciones — `GET /api/interactions`

Lista interacciones con filtros opcionales y paginación.

| Query param | Tipo   | Descripción                                    |
|-------------|--------|------------------------------------------------|
| `agentId`   | UUID   | Filtrar por agente                             |
| `status`    | string | `abierta`, `en_progreso` o `resuelta`          |
| `from`      | ISO 8601 | Inicio del rango de `openedAt` (inclusivo)   |
| `to`        | ISO 8601 | Fin del rango de `openedAt` (inclusivo)      |
| `page`      | número | Página (default: `1`)                          |
| `pageSize`  | número | Resultados por página (default: `20`, máx: `100`) |

**Respuesta:** `200 OK`
```json
{
  "data": [...],
  "page": 1,
  "pageSize": 20,
  "total": 351
}
```

---

### Métricas — `GET /api/metrics`

Métricas de operación para un rango de fechas. El agrupamiento por día usa hora de Colombia (UTC-5), de modo que una interacción abierta a las 22:00 en Cali aparece en el día correcto del agente, no en el día UTC siguiente.

| Query param | Tipo     | Requerido | Descripción                  |
|-------------|----------|-----------|------------------------------|
| `from`      | ISO 8601 | Sí        | Inicio del rango (inclusivo) |
| `to`        | ISO 8601 | Sí        | Fin del rango (inclusivo)    |

**Respuesta:** `200 OK`
```json
{
  "porAgente": [
    {
      "agentId": "uuid",
      "agentName": "Andrés Castillo",
      "total": 59,
      "resueltas": 34,
      "tasaResolucion": 57.63,
      "tiempoPromedioSegundos": 1842
    }
  ],
  "volumenPorDia": [
    { "dia": "2026-05-25", "total": 8, "resueltas": 4 }
  ]
}
```

---

## Formato de errores

Todos los errores devuelven la misma estructura JSON:

```json
{
  "error": "ValidationError",
  "message": "Datos de entrada inválidos.",
  "details": [
    { "campo": "agentId", "mensaje": "agentId debe ser un UUID válido." }
  ]
}
```

| Campo     | Presente en                             |
|-----------|-----------------------------------------|
| `error`   | Siempre                                 |
| `message` | Siempre                                 |
| `details` | Solo en `ValidationError` (400)         |

| Status | Error              | Cuándo ocurre                               |
|--------|--------------------|---------------------------------------------|
| `400`  | `ValidationError`  | Body, query o params con datos inválidos    |
| `404`  | `NotFoundError`    | Agente o interacción no existe; ruta no registrada |
| `409`  | `ConflictError`    | Transición de estado no permitida           |
| `500`  | `InternalServerError` | Error inesperado del servidor            |

## Verificación end-to-end

El archivo `requests.http` en la raíz del proyecto contiene 23 ejemplos listos para ejecutar con la extensión **REST Client** de VS Code. Cubre todos los endpoints, filtros de paginación, transiciones de estado válidas e inválidas, y el rango de métricas con interacciones nocturnas.

## Arquitectura

```
src/
├── config/          # env.js (fail-fast), prisma.js (singleton)
├── domain/          # errors.js, interactionStatus.js (máquina de estados pura)
├── validators/      # schemas Zod (interactions, metrics)
├── middlewares/     # validate.js (factory), errorHandler.js
├── repositories/    # agents, interactions (solo Prisma, sin lógica de negocio)
├── services/        # interactions, metrics (orquestación, sin req/res)
├── controllers/     # interactions, metrics (solo lee req, llama service, responde)
├── routes/          # interactions.routes.js, metrics.routes.js, index.js
├── utils/           # asyncHandler.js
├── app.js           # Express configurado, sin listen()
└── server.js        # único punto de arranque (listen)
```
