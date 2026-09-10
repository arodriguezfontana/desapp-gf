## Stack

- **Backend**: NestJS 11 · TypeScript · Jest 
- **Frontend**: React 19 · Vite 8 · TypeScript · Tailwind CSS 4 · axios

## Requisitos

- Node.js >= 20
- pnpm (`corepack enable pnpm` o `npm i -g pnpm`)

## Setup

```bash
pnpm install --dir backend
pnpm install --dir frontend
```

Variables de entorno (copiar los `.env.example`):

- `backend/.env` → `PORT`, `DATABASE_URL`, `JWT_SECRET` (secreto real de firma del JWT,
  generar uno propio: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`),
  y `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` (sólo si se
  levanta Postgres con docker-compose; deben coincidir con lo que codifica `DATABASE_URL`).
- `frontend/.env` → `VITE_API_URL` (ej. `http://localhost:3000`)

## Base de datos

Se necesita un PostgreSQL con la base indicada en `DATABASE_URL`. Dos opciones:

```bash
# A) Postgres nativo ya instalado: crear la base una vez y listo.
# B) Postgres reproducible con Docker (requiere parar un Postgres nativo en el mismo puerto):
cd backend && docker compose up -d
```

Fuera de producción, TypeORM crea/actualiza el esquema al arrancar (`synchronize`).

## Desarrollo

```bash
cd backend  && pnpm dev   # http://localhost:3000
cd frontend && pnpm dev   # http://localhost:5173
```

## Autenticación

- `POST /auth/register` — alta con `email` + `password` (8–16 chars, mayúscula, minúscula,
  número y carácter especial). No inicia sesión ni devuelve token.
- `POST /auth/login` — devuelve `{ accessToken, tokenType: "Bearer", expiresIn: 86400 }`.
  El JWT vence a las 24 h.
- El resto de endpoints exige `Authorization: Bearer <jwt>` (guard global). `GET /auth/me`
  es el endpoint protegido de referencia. Colección Postman en `docs/postman/`.

## Documentación de la API

Con el backend corriendo:

- Swagger UI → http://localhost:3000/docs
- Spec OpenAPI v3 (JSON) → http://localhost:3000/docs-json

## Scripts

**Backend**: `dev` · `build` · `start` · `start:prod` · `lint` · `test` (unit + integración) · `test:e2e` · `test:watch` · `test:cov`
**Frontend**: `dev` · `build` · `preview` · `lint`

## Spec-Driven Development

El repo usa [spec-kit](https://github.com/github/spec-kit). La constitución y las specs
viven en `.specify/` (versionado). Los comandos del agente (`.claude/`, `.github/`, …) no
se versionan: cada quien los regenera tras clonar.

```bash
# instalar uv (https://docs.astral.sh/uv)
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
specify integration install claude --script ps   # o copilot, cursor, gemini, codex…
```

Flujo: `/speckit-constitution` → `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.

> Los scripts de spec-kit son PowerShell (`.ps1`); en Mac/Linux requieren `pwsh`.
