# Engage 360 API

Mini contact center backend for WeKall. Built with Node.js + Express + PostgreSQL + Prisma.

## Requirements

- Node.js >= 18
- PostgreSQL running locally or via Docker

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables and fill them in
cp .env.example .env

# 3. Run database migrations
npm run prisma:migrate

# 4. Start development server (with hot reload)
npm run dev
```

## Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start with nodemon (hot reload) |
| `npm start` | Start in production mode |
| `npm run prisma:migrate` | Run pending database migrations |
| `npm run prisma:seed` | Seed the database with sample data |
| `npm run prisma:studio` | Open Prisma Studio (visual DB browser) |

## Health check

```
GET /health  →  { "status": "ok" }
```
