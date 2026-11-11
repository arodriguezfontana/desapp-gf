# FÚTVAL

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

- `backend/.env` → `PORT`, `CORS_ORIGIN` (orígenes del frontend permitidos, separados por coma; por defecto
  `http://localhost:5173`), `DATABASE_URL`, `JWT_SECRET` (secreto real de firma del JWT,
  generar uno propio: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`),
  `QUOTES_API_KEY` (clave para que el frontend consulte el catálogo y dispare recálculos),
  `ADMIN_API_KEY` (clave exclusiva del administrador para operaciones privilegiadas, como activar estrategias de cotización),
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

El sistema usa JWT (24 h). El guard global protege todos los endpoints salvo los marcados con
`@Public()`, que usan ApiKey en su lugar. La colección Postman está en `docs/postman/`.
Los endpoints se documentan en Swagger.

## Documentación de la API

Con el backend corriendo:

- Swagger UI → http://localhost:3000/docs
- Spec OpenAPI v3 (JSON) → http://localhost:3000/docs-json

## Observabilidad (equivalente a Spring Boot Actuator)

El backend es NestJS, así que no usa Actuator. Estos endpoints públicos cubren lo mismo, sin token:

| Actuator | Acá | Qué devuelve |
|---|---|---|
| `/actuator/health` | `GET /health` | Estado de la base de datos (`@nestjs/terminus`): 200 si responde, 503 si no. |
| `/actuator/prometheus` | `GET /metrics` | Formato Prometheus (`prom-client`): duración y conteo de requests por método, ruta y código, más las métricas del proceso Node (`process_*`, `nodejs_*`: CPU, memoria, heap, event loop, GC). |
| `/actuator/info` | `GET /info` | Nombre, versión, commit, entorno, versión de Node, arranque y uptime. |

`GET /info` toma el commit de la variable `GIT_COMMIT`, que tiene que definir el despliegue (por ejemplo
`GIT_COMMIT=$(git rev-parse --short HEAD)`); si no está definida, el commit sale como `null`.

## Ver las métricas

1. Con el backend corriendo (`cd backend && pnpm dev`), las métricas están en http://localhost:3000/metrics.
2. Para verlas en Prometheus y Grafana, levantar los servicios (desde `backend/`):

   ```bash
   docker compose up -d      # Postgres + Prometheus (:9090) + Grafana (:3001)
   ```

3. Prometheus: http://localhost:9090 (en `/targets`, `futval-backend` debe estar en **UP**).
4. Grafana: http://localhost:3001 (usuario `admin`, contraseña `admin`). El dashboard **FútVal — métricas del backend** ya viene cargado.

## Scripts

**Backend**: `dev` · `build` · `start` · `start:prod` · `lint` · `test:unit` (sin Docker) · `test:integration` · `test:e2e` · `test` (unit + integración) · `test:watch` · `test:cov`
**Frontend**: `dev` · `build` · `preview` · `lint`

> `test:unit` no necesita Docker. `test:integration`, `test:e2e`, `test` y `test:cov`
> levantan un Postgres efímero con Testcontainers y requieren Docker corriendo.

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
