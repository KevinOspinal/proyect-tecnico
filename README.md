# Engage 360 API

Backend de mini contact center para WeKall. Registra interacciones de agentes (llamadas y tickets) y expone métricas de operación agrupadas en hora de Colombia (UTC-5).

## Stack

| Tecnología | Versión | Por qué |
|---|---|---|
| Node.js + Express | ≥ 18 | Plataforma y framework del enunciado |
| PostgreSQL | 15 | Soporte nativo de `timestamptz` y `AT TIME ZONE` para zona horaria correcta |
| Prisma | 5 | ORM tipado + migraciones versionadas |
| Zod | 3 | Validación en runtime (inputs de usuario, respuestas de BD) |

---

## Requisitos previos

- Node.js 18 o superior
- PostgreSQL corriendo localmente o en Docker

**Opción rápida con Docker:**

```bash
docker run -d --name engage360-db \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -p 5432:5432 \
  postgres:15
```

---

## Instalación y arranque

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de entorno
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL

# 3. Aplicar todas las migraciones (crea las tablas)
npm run prisma:migrate

# 4. Cargar datos de prueba
npm run prisma:seed

# 5. Arrancar el servidor
npm run dev
```

El servidor queda disponible en `http://localhost:3000`.

---

## Variables de entorno

| Variable | Ejemplo | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres@localhost:5432/engage360` | Cadena de conexión a PostgreSQL |
| `PORT` | `3000` | Puerto en que escucha el servidor |

La app hace **fail-fast**: si alguna variable falta, el proceso termina en el arranque con un mensaje claro en lugar de fallar silenciosamente en producción.

---

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Arrancar con nodemon (hot reload) |
| `npm start` | Arrancar en modo producción |
| `npm test` | Tests de la capa de dominio (`node:test` nativo, sin Jest) |
| `npm run prisma:migrate` | Aplicar migraciones pendientes |
| `npm run prisma:seed` | Poblar la BD con 350 interacciones de prueba |
| `npm run prisma:studio` | Abrir Prisma Studio (explorador visual de datos) |

---

## Seed de datos

El seed carga:

- **6 agentes** con nombres y emails únicos
- **350 interacciones** distribuidas entre llamadas y tickets, en distintos estados
- **~140 interacciones nocturnas** (entre las 19:00 y las 23:59 hora Cali) para verificar que el agrupamiento por día respeta UTC-5 y no UTC

### Requisito previo

Las migraciones deben aplicarse **antes** de correr el seed, ya que el seed lee los estados (`abierto`, `proceso`, `finalizado`) directamente desde la tabla `states` que crean las migraciones:

```bash
npm run prisma:migrate   # primero
npm run prisma:seed      # después
```

### Uso local

```bash
npm run prisma:seed
```

### Uso con base de datos remota

Actualiza `DATABASE_URL` en `.env` con la cadena de conexión de tu base de datos remota antes de ejecutar el seed:

```env
DATABASE_URL="postgresql://usuario:contraseña@host-remoto:5432/nombre_bd"
```

Luego corre el seed normalmente:

```bash
npm run prisma:seed
```

> El seed es **idempotente**: elimina los datos existentes antes de insertar, por lo que puede correrse varias veces sin duplicados.

---

## Endpoints

Base URL: `http://localhost:3000`

### `GET /health`

Verifica que el servidor esté activo.

```json
{ "status": "ok" }
```

---

### `GET /api/states`

Devuelve los estados disponibles desde la base de datos. El frontend los consume desde aquí en lugar de hardcodearlos.

```json
[
  { "id": 1, "name": "abierto" },
  { "id": 2, "name": "proceso" },
  { "id": 3, "name": "finalizado" }
]
```

---

### `POST /api/interactions`

Crea una nueva interacción. El estado inicial siempre es `abierto` — el cliente no puede sobreescribirlo.

**Body:**
```json
{
  "agentId": "uuid-del-agente",
  "type": "llamada",
  "openedAt": "2026-06-23T22:30:00-05:00"
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `agentId` | UUID | Sí | ID del agente responsable |
| `type` | string | Sí | `"llamada"` o `"ticket"` |
| `openedAt` | ISO 8601 | No | Si se omite, el servidor estampa `now()` |

**Respuesta:** `201 Created` con el objeto de la interacción, incluyendo `state`, `openedAt`, `inProgressAt` y `closedAt`.

---

### `PATCH /api/interactions/:id/estado`

Cambia el estado de una interacción. La máquina de estados define las transiciones válidas:

```
abierto ──→ proceso ──→ finalizado
abierto ─────────────→ finalizado  (salto directo permitido)
```

El servidor estampa los timestamps automáticamente — el cliente **nunca** los envía:

| Transición hacia | Timestamp estampado |
|---|---|
| `proceso` | `inProgressAt = now()` |
| `finalizado` | `closedAt = now()` |

**Body:**
```json
{ "status": "proceso" }
```

**Respuestas:**
- `200 OK` — transición aplicada, devuelve el objeto actualizado
- `409 Conflict` — transición no permitida (ej: `finalizado` → `proceso`)
- `404 Not Found` — interacción inexistente

---

### `GET /api/interactions`

Lista interacciones con filtros opcionales y paginación.

| Query param | Tipo | Descripción |
|---|---|---|
| `agentId` | UUID | Filtrar por agente |
| `status` | string | `abierto`, `proceso` o `finalizado` |
| `from` | ISO 8601 | Inicio del rango sobre `openedAt` (inclusivo) |
| `to` | ISO 8601 | Fin del rango sobre `openedAt` (inclusivo) |
| `page` | número | Página (default: `1`) |
| `pageSize` | número | Resultados por página (default: `20`, máx: `100`) |

**Respuesta:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "llamada",
      "state": { "id": 2, "name": "proceso" },
      "openedAt": "2026-06-24T14:00:00.000Z",
      "inProgressAt": "2026-06-24T14:05:00.000Z",
      "closedAt": null,
      "agent": { "id": "uuid", "name": "Andrés Castillo", "email": "andres@example.com" }
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 356,
  "totalPages": 18
}
```

---

### `GET /api/metrics`

Métricas de operación para un rango de fechas. El agrupamiento por día usa hora de Colombia (UTC-5): una interacción abierta a las 22:00 en Cali aparece en el día correcto del agente, no en el día UTC siguiente.

| Query param | Tipo | Requerido | Descripción |
|---|---|---|---|
| `from` | ISO 8601 | Sí | Inicio del rango (inclusivo) |
| `to` | ISO 8601 | Sí | Fin del rango (inclusivo) |

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
    { "dia": "2026-06-23", "total": 18, "resueltas": 11 },
    { "dia": "2026-06-24", "total": 22, "resueltas": 14 }
  ]
}
```

> `tiempoPromedioSegundos` es `null` si el agente no tiene interacciones finalizadas en el rango.

---

## Formato de errores

Todos los errores devuelven la misma estructura JSON — nunca se expone el stack trace al cliente:

```json
{
  "error": "NombreDelError",
  "message": "Descripción legible del problema.",
  "details": [
    { "field": "agentId", "message": "agentId debe ser un UUID válido." }
  ]
}
```

| Campo | Presente en |
|---|---|
| `error` | Siempre |
| `message` | Siempre |
| `details` | Solo en `ValidationError` (400) |

| Status | Error | Cuándo ocurre |
|---|---|---|
| `400` | `ValidationError` | Body, query o params inválidos |
| `404` | `NotFoundError` | Agente/interacción inexistente; ruta no registrada |
| `409` | `ConflictError` | Transición de estado no permitida |
| `500` | `InternalServerError` | Error inesperado del servidor |

---

## Arquitectura

```
src/
├── config/        env.js (fail-fast), prisma.js (singleton del pool)
├── domain/        errors.js, interactionStatus.js (máquina de estados pura)
├── validators/    schemas Zod para interactions, metrics y states
├── middlewares/   validate.js (factory por fuente), errorHandler.js
├── repositories/  agents, interactions, states — único contacto con Prisma/SQL
├── services/      interactions, metrics, states — orquestación sin req/res
├── controllers/   interactions, metrics, states — solo HTTP in/out
├── routes/        interactions, metrics, states, index
├── utils/         asyncHandler.js
├── app.js         Express configurado, sin listen()
└── server.js      único punto de arranque
```

Flujo de capas: `Route → Middleware (Zod) → Controller → Service → Repository → PostgreSQL`

Cada capa tiene una restricción explícita: el Controller no toca Prisma, el Service no toca `req/res`, el Repository no contiene reglas de negocio, el Domain no tiene dependencias externas.

---

## Tests

```bash
npm test
```

Cubre la capa de dominio con el runner nativo de Node.js (`node:test`, sin Jest ni Vitest):

- Todas las transiciones válidas de la máquina de estados
- Todas las transiciones inválidas (incluyendo estado terminal)
- `debeEstamparClosedAt` y `debeEstamparInProgressAt`

---

## Probar los endpoints manualmente

El archivo `requests.http` en la raíz contiene ejemplos listos para ejecutar con la extensión **REST Client** de VS Code. Cubre todos los endpoints, filtros de paginación, transiciones válidas e inválidas, y el rango de métricas con interacciones nocturnas.
