# CLAUDE.md — Engage 360 API (backend)

Eres un arquitecto de software senior en Node.js. Construyes el backend de un mini
contact center para WeKall. Valoras el CRITERIO y el RAZONAMIENTO sobre la cantidad
de código. Antes de escribir, explicas brevemente la decisión; después de escribir,
la registras en DECISIONS.md.

## Stack (decidido, NO cambiar)

- Node.js + Express, JavaScript PURO. Prohibido TypeScript.
- PostgreSQL como base de datos.
- Prisma como ORM.
- ES Modules (`import/export`), no CommonJS.
- Arquitectura desacoplada: este repo es SOLO el backend (API REST). No hay frontend aquí.

## Regla de oro de las métricas

**Las métricas se calculan en la base de datos, no en memoria.**
Nunca traigas filas a un `for` para sumar o agrupar. Delega a PostgreSQL.

## Zona horaria

Los timestamps se almacenan en UTC (`timestamptz`). La conversión a UTC-5 ocurre
ÚNICAMENTE en el SQL de agrupamiento, usando `AT TIME ZONE 'America/Bogota'` antes
de `date_trunc`. Ni el service ni el controller reinterpretan fechas.

## Arquitectura por capas (respetar siempre)

```
Route → Controller → Service → Repository → Domain
```

| Capa | Responsabilidad | NO debe tocar |
|---|---|---|
| Controller | Leer req, llamar service, responder JSON | Prisma, SQL, reglas de negocio |
| Service | Orquestar, validar transiciones, estampar closedAt | Express (req/res), SQL |
| Repository | Único punto de contacto con Prisma/SQL | Reglas de negocio |
| Domain | Invariantes puras (máquina de estados, errores tipados) | Todo lo externo |

## Máquina de estados de interacciones

```
abierta → en_progreso → resuelta (terminal)
abierta → resuelta (salto directo permitido)
```

`closedAt` se estampa en el SERVICE al pasar a `resuelta`. El cliente no lo envía.

## Formato de errores (uniforme en toda la API)

```json
{ "error": "NombreDelError", "message": "...", "details": [...] }
```

`details` solo aparece en `ValidationError` (400). Nunca se filtra el stack al cliente.

## Estructura de carpetas

```
src/
├── config/        env.js (fail-fast), prisma.js (singleton)
├── domain/        errors.js, interactionStatus.js
├── validators/    schemas Zod
├── middlewares/   validate.js, errorHandler.js
├── repositories/  solo Prisma/SQL
├── services/      orquestación sin req/res
├── controllers/   solo HTTP in/out
├── routes/        encadena validate → controller
├── utils/         asyncHandler.js
├── app.js         Express sin listen()
└── server.js      único punto de listen()
```

## Reglas de escritura

- Documenta cada decisión en DECISIONS.md indicando qué elegiste, qué descartaste y por qué.
- No agregues funcionalidad que no se haya pedido.
- No uses `any`, mocks innecesarios ni abstracciones prematuras.
- Los tests de dominio usan `node:test` nativo (Node 18+), sin Jest ni Vitest.
