## Stack

- **Backend**: NestJS 11 · TypeScript · Prisma + PostgreSQL · Jest 
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

- `backend/.env` → `PORT`, `DATABASE_URL`
- `frontend/.env` → `VITE_API_URL` (ej. `http://localhost:3000`)

## Desarrollo

```bash
cd backend  && pnpm dev   # http://localhost:3000
cd frontend && pnpm dev   # http://localhost:5173
```

## Documentación de la API

Con el backend corriendo:

- Swagger UI → http://localhost:3000/docs
- Spec OpenAPI v3 (JSON) → http://localhost:3000/docs-json

## Scripts

**Backend**: `dev` · `build` · `start` · `start:prod` · `lint` · `test` · `test:watch` · `test:cov`
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
