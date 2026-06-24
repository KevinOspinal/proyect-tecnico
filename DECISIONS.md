# DECISIONS.md — Engage 360 API

Registro de decisiones arquitectónicas por fase.

---

## FASE 1 — Scaffolding del proyecto

### 1. `type: "module"` en package.json
**Elegido:** ES Modules nativos (`import/export`).  
**Descartado:** CommonJS (`require`).  
**Por qué:** El stack fue decidido desde el inicio. ESM es el estándar moderno de Node.js; además, Prisma 5 tiene mejor soporte para ESM y permite tree-shaking si en el futuro se agregan bundles.

---

### 2. Separación de `app.js` y `server.js`
**Elegido:** `app.js` construye la app sin llamar a `listen()`; `server.js` hace el bind al puerto.  
**Descartado:** Un único archivo que construye y escucha.  
**Por qué:** Supertest y otros frameworks de prueba importan `app` directamente y abren su propio socket efímero. Si `app.js` llamara a `listen()`, cada import en tests abriría un servidor real en el puerto fijo definido en `.env`, causando conflictos de puerto (EADDRINUSE) y tests no deterministas.

---

### 3. Fail-fast en `env.js`
**Elegido:** Validar variables requeridas al inicio y llamar a `process.exit(1)` si falta alguna.  
**Descartado:** Leer `process.env` en cada módulo que lo necesite y fallar tarde.  
**Por qué:** Un error de configuración que explota en un endpoint específico (en producción, quizás a las 3 a.m.) es mucho más costoso que uno que explota en el arranque. Fail-fast hace que el problema sea visible de inmediato y con un mensaje claro.

---

### 4. Singleton de PrismaClient
**Elegido:** Una sola instancia exportada desde `src/config/prisma.js`.  
**Descartado:** Instanciar `PrismaClient` en cada repositorio.  
**Por qué:** Prisma usa un pool de conexiones por instancia. Múltiples instancias = múltiples pools = agotamiento de conexiones en PostgreSQL bajo carga. El singleton garantiza que todos los repositorios comparten el mismo pool.

---

### 5. `errorHandler` como middleware Express de 4 argumentos
**Elegido:** Función con firma `(err, req, res, next)` registrada al final de `app.js`.  
**Descartado:** Bloques try/catch individuales en cada controller que construyen su propia respuesta de error.  
**Por qué:** Un único punto de salida para errores garantiza respuestas uniformes (`{ error, message, details }`), evita duplicación y hace que agregar logging centralizado o monitoreo (Sentry, etc.) sea un cambio de un solo lugar.

---

### 6. Ruta `/health` en `app.js`
**Elegido:** `GET /health` responde `{ status: "ok" }` sin autenticación.  
**Por qué:** Convención estándar para health checks de load balancers, orquestadores (Kubernetes, Railway, Render) y monitoreo. No requiere lógica de negocio en esta fase.

---

## FASE 2 — Modelo de datos con Prisma

### 7. Enums a nivel de base de datos
**Elegido:** `enum InteractionType` y `enum InteractionStatus` como tipos PostgreSQL nativos.  
**Descartado:** Enums solo en la capa de aplicación (validar con Zod y guardar como `VARCHAR`).  
**Por qué:** Postgres rechaza en la capa de almacenamiento cualquier valor fuera del enum, no solo en la aplicación. Si alguien inserta un registro directamente en la BD (migración, script, psql), el constraint sigue vigente. Con VARCHAR la restricción vive solo en el código y puede ser bypasseada.

---

### 8. UUID como tipo de ID en vez de entero autoincremental
**Elegido:** `String @id @default(uuid())` en todos los modelos.  
**Descartado:** `Int @id @default(autoincrement())`.  
**Por qué:**
- **Sin colisiones entre sistemas:** un entero autoincremental es único solo dentro de una tabla. Si el sistema crece a múltiples instancias o se fusionan bases de datos, los IDs numéricos chocan. Un UUID es globalmente único — dos servidores lo pueden generar de forma independiente sin coordinarse.
- **No expone métricas internas:** con IDs numéricos, el ID `1042` revela que existen al menos 1042 registros. Con UUID esa información queda oculta al cliente.
- **Generación en el cliente:** un servicio externo puede construir el ID antes del `POST`, lo que simplifica flujos optimistas y facilita la integración con otros sistemas.

---

### 9. `closedAt` nullable
**Elegido:** `DateTime?` (nullable) — solo se estampa cuando `status` pasa a `resuelta`.  
**Descartado:** `DateTime` con un valor centinela (ej. `9999-12-31`) para indicar "aún abierta".  
**Por qué:** `NULL` no es un valor vacío aquí; es información semántica: "esta interacción aún no ha cerrado". La condición `closed_at IS NOT NULL` filtra resueltas sin joins ni comparaciones de fechas artificiales. Un valor centinela contamina agregaciones (AVG de tiempos de resolución incluiría registros abiertos) y requiere que toda la lógica conozca el centinela.

---

### 9. `openedAt` separado de `createdAt`
**Elegido:** Dos campos distintos: `opened_at` (cuándo el agente abre la interacción) y `created_at` (cuándo se creó el registro en BD).  
**Por qué:** Pueden diferir — por ejemplo, si se importan interacciones históricas o si hay latencia entre que el agente abre una llamada y el sistema la registra. Las métricas de tiempo de resolución deben medirse desde `opened_at`, no desde `created_at`. Fusionar ambos en un solo campo haría imposible distinguir estos casos en el futuro.

---

### 10. Índice compuesto `(agent_id, status)` en vez de dos índices sueltos
**Elegido:** `@@index([agentId, status])` — un solo índice compuesto.  
**Descartado:** `@@index([agentId])` + `@@index([status])` como índices separados.  
**Por qué:** La consulta de métricas más frecuente es `WHERE agent_id = $1 AND status = 'resuelta'`. El índice compuesto resuelve ambas condiciones en un solo barrido B-tree. Con dos índices separados, Postgres elegiría uno y filtraría el otro en memoria, o haría un Bitmap Index Scan combinando ambos — ambas opciones son más costosas. La regla del prefijo izquierdo garantiza que el compuesto también sirve para consultas que filtran solo por `agent_id`, haciendo redundante un índice suelto en esa columna.

---

---

## FASE 8 — Seed de datos

### 26. El seed fuerza el caso de medianoche (19:00–23:59 Cali → día siguiente en UTC)
**Elegido:** ~40% de las interacciones (140) se generan en ese rango horario deliberadamente.  
**Por qué:** El error de timezone en `date_trunc` es silencioso: la query compila, retorna datos y nadie detecta el problema hasta que un supervisor nota que los totales no cuadran con el reporte del agente. Al tener 140 interacciones nocturnas en el seed, cualquier regresión en la conversión `AT TIME ZONE 'America/Bogota'` hace que esas interacciones aparezcan en el día UTC equivocado y los totales diarios cambien visiblemente. Es la prueba de integración más barata: los datos del seed ya exigen la query correcta.

---

### 27. `createMany` en vez de crear interacción por interacción
**Elegido:** Un solo `prisma.interaction.createMany({ data: [...] })` para las 350 filas.  
**Descartado:** Un bucle con `prisma.interaction.create(...)` por cada interacción.  
**Por qué:** `createMany` traduce a un solo `INSERT INTO ... VALUES (...), (...), ...` en Postgres — un único round-trip a la base de datos. 350 `create` individuales son 350 round-trips. En desarrollo el seed tarda milisegundos; con `create` individual tardaría segundos. Para datos de prueba que se regeneran frecuentemente, la diferencia importa.

---

### 28. `deleteMany` ordenado por FK antes de re-insertar (idempotencia)
**Elegido:** `await prisma.interaction.deleteMany()` primero, luego `await prisma.agent.deleteMany()`.  
**Descartado:** `TRUNCATE CASCADE` o `upsert`.  
**Por qué:** El orden importa: `interactions` referencia `agents` por FK. Si se elimina `agents` primero, Postgres rechaza la operación por violación de integridad referencial. `deleteMany` en el orden correcto es explícito y seguro. `TRUNCATE CASCADE` requeriría SQL crudo y no es idiomático en Prisma. `upsert` por 350 registros sería más complejo sin beneficio real para un seed de desarrollo.

---

## FASE 7 — Controllers y rutas

### 23. El controller no contiene reglas — separación HTTP / negocio
**Elegido:** Controller = leer req → llamar service → escribir res. Nada más.  
**Descartado:** Poner validaciones de negocio, consultas Prisma o lógica condicional en el controller.  
**Por qué:** El controller es una capa de traducción, no de decisión. Si la regla vive aquí, no se puede reutilizar desde una cola de mensajes, un CLI o un test sin levantar Express. Si la regla vive en el service, el controller es intercambiable (REST hoy, GraphQL mañana) sin tocar el negocio. El contrato es simple: el controller recibe datos ya validados, delega completamente al service, y convierte el resultado a HTTP.

---

### 24. `asyncHandler` como wrapper en vez de try/catch en cada handler
**Elegido:** `asyncHandler(fn)` envuelve el handler y hace `.catch(next)` automáticamente.  
**Descartado:** Bloque `try/catch` explícito en cada handler con `next(err)` manual.  
**Por qué:** Con try/catch, cada handler de controller tiene 4 líneas de boilerplate que nunca cambian. Si se omite en un handler (error humano), el error asíncrono queda sin capturar y el servidor no responde. `asyncHandler` elimina esa superficie de error: si una Promise rechaza, siempre llega al `errorHandler` central. Un wrapper de 4 líneas evita docenas de bloques repetidos.

---

### 25. Validación de `:id` en params antes de llegar al controller
**Elegido:** `validate(idParamsSchema, 'params')` en la ruta `PATCH /:id/estado`.  
**Descartado:** Dejar que el service haga la consulta a la BD con un id inválido y falle con un error de Prisma.  
**Por qué:** Un UUID malformado nunca existirá en la base de datos, pero si se deja pasar, Prisma lanza un error de bajo nivel (no un `NotFoundError` limpio). Validar en la entrada es más barato (no hay round-trip a la BD) y el cliente recibe un 400 claro en vez de un 500 genérico.

---

## FASE 6 — Validación de entrada y manejo central de errores

### 19. Estrategia de 3 niveles de defensa
**Nivel 1 — Entrada:** El middleware `validate` corre el schema Zod **antes** de que el controller toque el dato. Si falla, el request muere aquí con un 400 claro. El controller nunca ve datos malformados.  
**Nivel 2 — Negocio:** Services y domain lanzan `AppError` subclases (`ConflictError`, `NotFoundError`) cuando la operación viola una regla de negocio. Estos errores tienen `isOperational = true` y un `statusCode` preciso.  
**Nivel 3 — Captura central:** `errorHandler` es el único lugar que escribe la respuesta HTTP para errores. Distingue operacional vs inesperado: los operacionales se responden tal cual; los inesperados se loguean internamente y el cliente recibe solo un mensaje genérico 500.  
**Por qué 3 niveles y no uno:** Cada nivel tiene responsabilidades distintas. Mezclarlos (ej. validar en el controller, loguear en el service) dispersa la lógica y hace que cada ruta tenga que reimplementar la estrategia de respuesta. Con 3 niveles, agregar un nuevo endpoint solo requiere un schema, el controller y el service — el manejo de errores y la validación vienen gratis.

---

### 20. `validate` como factory que recibe `fuente` ('body' | 'query' | 'params')
**Elegido:** `validate(schema, fuente)` — un solo middleware reutilizable para cualquier parte de la request.  
**Descartado:** Middlewares separados `validateBody`, `validateQuery`, `validateParams`.  
**Por qué:** Un solo factory con dos parámetros cubre todos los casos sin duplicar lógica. La firma es explícita en la ruta: `validate(listarSchema, 'query')` comunica exactamente qué se valida y de dónde.

---

### 21. `next(error)` en vez de `throw` dentro del middleware validate
**Elegido:** `return next(new ValidationError(...))` en el middleware síncrono.  
**Descartado:** `throw new ValidationError(...)`.  
**Por qué:** Express 4 no captura automáticamente excepciones lanzadas en middlewares síncronos — si se hace `throw`, el error no llega al `errorHandler` y el servidor puede quedar en un estado indefinido. `next(error)` es el contrato oficial de Express para propagar errores. Express 5 sí captura throws síncronos, pero el proyecto usa Express 4.

---

### 22. `isOperational` como discriminador en el errorHandler (en vez de `instanceof`)
**Elegido:** `if (err.isOperational)` para separar errores esperados de bugs.  
**Descartado:** `if (err instanceof AppError)` o comparar por `statusCode`.  
**Por qué:** `isOperational` funciona incluso si el error viene de una librería de terceros que extiende `Error` con un `statusCode` pero no hereda de `AppError`. Además, si en el futuro se necesita marcar un error de terceros como operacional, basta con asignar `err.isOperational = true` sin cambiar la jerarquía de clases. Es más robusto y extensible que `instanceof`.

---

## FASE 4 — Repositorios y servicios

### 15. `closedAt` se estampa en el service, no se acepta del cliente
**Elegido:** El service llama `new Date()` cuando `debeEstamparClosedAt(hacia)` retorna `true`.  
**Descartado:** Aceptar `closedAt` como campo del body del cliente o calcularlo en el repository.  
**Por qué:** `closedAt` representa el momento exacto en que el servidor procesó la transición a `resuelta`. Si el cliente lo enviara, podría falsificar la fecha de cierre (para manipular métricas de SLA o reportes de tiempos de resolución). El repository no debe tomar decisiones temporales — solo persiste lo que recibe. El service es el único punto que conoce tanto la regla de dominio (`debeEstamparClosedAt`) como el contexto de ejecución, por eso es el lugar correcto para estamparlo.

---

### 16. `Promise.all` para lista + conteo en `listarInteracciones`
**Elegido:** `[data, total] = await Promise.all([listar(...), contar(...)])`.  
**Descartado:** Dos `await` secuenciales.  
**Por qué:** La lista y el conteo son consultas independientes sobre la misma tabla. Ejecutarlas en paralelo las deja correr simultáneamente en el pool de conexiones de Prisma, reduciendo la latencia del endpoint de paginación a `max(t_lista, t_conteo)` en vez de `t_lista + t_conteo`. El mismo patrón se aplica en `obtenerMetricas` para `metricasPorAgente` y `volumenPorDia`.

---

### 17. SQL crudo con `prisma.$queryRaw` solo para las consultas de métricas
**Elegido:** `prisma.$queryRaw` con template literal parametrizado para las dos consultas de métricas.  
**Descartado:** `prisma.$queryRaw` en todo el repo, o traer filas y agregar en JS.  
**Por qué:** `COUNT FILTER`, `AVG(EXTRACT(EPOCH FROM ...))` y `date_trunc AT TIME ZONE` no tienen equivalente en la API de alto nivel de Prisma. El SQL crudo se justifica solo donde la API ORM es insuficiente. Las consultas CRUD estándar siguen usando la API tipada de Prisma (menos superficie de error, refactoring automático). Agregar en JS está explícitamente prohibido por la regla de oro de métricas del proyecto.

---

### 18. Conversión de `BigInt` a `Number` en el service, no en el repository
**Elegido:** `.map(row => ({ total: Number(row.total), ... }))` en `metrics.service.js`.  
**Descartado:** Convertir en el repository antes de devolver, o en el controller.  
**Por qué:** El repository devuelve los datos tal como PostgreSQL los produce (BigInt para COUNT). La conversión es una decisión de presentación/serialización JSON — pertenece a la capa que compone la respuesta (el service). El controller no debe conocer detalles del tipo de dato interno.

---

## FASE 3 — Capa de dominio

### 12. Lógica de transición de estados en el dominio, no en el controller
**Elegido:** `puedeTransicionar` en `src/domain/interactionStatus.js`, sin dependencias externas.  
**Descartado:** Validar la transición dentro del controller de `PATCH /interactions/:id/status`.  
**Por qué:** La máquina de estados es una regla de negocio, no una regla HTTP. Si el sistema crece y aparecen otras entradas (worker de colas, WebSocket, script de migración), todas deben respetar las mismas transiciones. Si la lógica vive en el controller, cada nueva entrada la duplica o la omite. Al aislarla en el dominio, basta con importar `puedeTransicionar` y la regla se aplica consistentemente en cualquier contexto.

---

### 13. `AppError` con `isOperational` para distinguir tipos de error
**Elegido:** Clase base con `isOperational = true` para errores esperados; el `errorHandler` loguea el stack solo cuando `isOperational` es `false`.  
**Descartado:** Usar códigos numéricos o strings como discriminador de tipo de error.  
**Por qué:** El campo `isOperational` es el patrón estándar de Node.js para separar errores de negocio (predecibles, no requieren alerta) de errores de programación (inesperados, requieren investigación). Permite que el errorHandler tome decisiones de logging sin necesidad de hacer `instanceof` contra múltiples subclases.

---

### 14. Test runner nativo de Node (`node:test`) sin framework externo
**Elegido:** `node --test` con `node:assert/strict`, disponible desde Node 18.  
**Descartado:** Jest, Vitest u otro framework de terceros.  
**Por qué:** La capa de dominio son funciones puras — no necesitan mocks, setup de base de datos ni transformaciones de módulos. El runner nativo tiene cero configuración, cero dependencias extra, y su sintaxis `describe/it` es idéntica a Jest. Agregar un framework pesado para ocho assertions sería sobreingeniería.

---

### 11. `@db.Timestamptz(6)` en todos los campos DateTime
**Elegido:** `timestamptz` (timestamp with time zone) vía `@db.Timestamptz(6)` en Prisma.  
**Descartado:** El default de Prisma (`timestamp(3) without time zone`).  
**Por qué:** La operación es en Colombia (UTC-5). El agrupamiento por día usa `opened_at AT TIME ZONE 'America/Bogota'`. Con `timestamp without time zone`, el operador `AT TIME ZONE` interpreta el valor como si estuviera en la zona horaria indicada (Bogotá) y lo convierte a UTC — exactamente lo contrario de lo que queremos. Con `timestamptz`, interpreta el valor como UTC y lo convierte a Bogotá — correcto. Si se usara el default de Prisma, una interacción abierta a las 8 p.m. en Cali podría contarse en el día siguiente.

---

## FASE 9 — Verificación end-to-end

### 19. Handler de rutas no registradas como `NotFoundError`
**Elegido:** Middleware catch-all entre las rutas y el `errorHandler` que lanza `NotFoundError`.  
**Descartado:** Dejar que Express devuelva su respuesta HTML por defecto para rutas inexistentes.  
**Por qué:** El cliente del API espera siempre `{ error, message }` en JSON. La respuesta HTML de Express rompe ese contrato. Al pasar el error al `errorHandler` central, la respuesta es consistente con todos los demás errores de la aplicación.

---

## Trazabilidad de fases

| Fase | Qué se construyó | Archivo(s) clave |
|------|-----------------|------------------|
| 1 | Scaffolding del proyecto | `src/app.js`, `src/server.js`, `src/config/env.js`, `src/config/prisma.js` |
| 2 | Modelos Prisma + migraciones + repositorios | `prisma/schema.prisma`, `src/repositories/agents.repository.js`, `src/repositories/interactions.repository.js` |
| 3 | Capa de dominio | `src/domain/errors.js`, `src/domain/interactionStatus.js` |
| 4 | Tests de dominio | `tests/interactionStatus.test.js` |
| 5 | Capa de servicios | `src/services/interactions.service.js`, `src/services/metrics.service.js` |
| 6 | Validación con Zod + errorHandler | `src/validators/interactions.schema.js`, `src/validators/metrics.schema.js`, `src/middlewares/validate.js`, `src/middlewares/errorHandler.js` |
| 7 | Controllers y rutas | `src/controllers/`, `src/routes/`, `src/utils/asyncHandler.js` |
| 8 | Seed de datos | `prisma/seed.js` — 350 interacciones, 140 nocturnas (UTC-5) |
| 9 | Verificación end-to-end + documentación | `requests.http`, `README.md`, `DECISIONS.md` |

### Invariantes verificados en la Fase 9

**Caminos felices (200/201):**
- `POST /api/interactions` crea con `status: "abierta"` y `openedAt` server-side si no se provee.
- `PATCH /:id/estado` acepta `abierta → en_progreso`, `abierta → resuelta`, `en_progreso → resuelta`.
- Al pasar a `resuelta`, `closedAt` es estampado por el servidor (no el cliente).
- `GET /api/interactions` devuelve `{ data, page, pageSize, total }` con todos los filtros funcionales.
- `GET /api/metrics` devuelve `porAgente` y `volumenPorDia` con agrupamiento correcto en hora Cali.

**Caso crítico UTC-5 verificado:**
Una interacción abierta a las `22:44 hora Cali` se almacena como `03:44 UTC` del día siguiente. La query `date_trunc('day', opened_at AT TIME ZONE 'America/Bogota')` la agrupa al día `2026-05-25` (Cali), no al `2026-05-26` (UTC). Este comportamiento fue validado contra datos reales del seed.

**Caminos de error (formato `{ error, message, details? }`):**
- `400 ValidationError` — body/query/params con tipos o valores inválidos (con `details`).
- `404 NotFoundError` — agente o interacción inexistente, ruta no registrada.
- `409 ConflictError` — transición de estado no permitida (sin `details`).
