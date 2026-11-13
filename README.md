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
| `/actuator/health` | [`GET /health`](http://localhost:3000/health) | Estado de la base de datos (`@nestjs/terminus`): 200 si responde, 503 si no. |
| `/actuator/prometheus` | [`GET /metrics`](http://localhost:3000/metrics) | Formato Prometheus (`prom-client`): duración y conteo de requests por método, ruta y código, más las métricas del proceso Node (`process_*`, `nodejs_*`: CPU, memoria, heap, event loop, GC). |
| `/actuator/info` | [`GET /info`](http://localhost:3000/info) | Nombre, versión, commit, entorno, versión de Node, arranque y uptime. |

`GET /info` toma el commit de la variable `GIT_COMMIT`, que tiene que definir el despliegue (por ejemplo
`GIT_COMMIT=$(git rev-parse --short HEAD)`); si no está definida, el commit sale como `null`.

## Ver las métricas

1. Con el backend corriendo (`cd backend && pnpm dev`), las métricas están en [http://localhost:3000/metrics](http://localhost:3000/metrics).
2. Para verlas en Prometheus y Grafana, levantar los servicios (desde `backend/`):

   ```bash
   docker compose up -d      # Postgres + Prometheus (:9090) + Grafana (:3001)
   ```

3. Prometheus: http://localhost:9090 (en [`/targets`](http://localhost:9090/targets), `futval-backend` debe estar en **UP**).
4. Grafana: http://localhost:3001 (usuario `admin`, contraseña `admin`). El dashboard [**FútVal — métricas del backend**](http://localhost:3001/d/futval-http-metrics) ya viene cargado.
   Trae paneles de latencia p95, tasa de error 5xx (la del SLA) y tasa de 4xx, y una sección del proceso Node. La tasa de 4xx es informativa: los 4xx no entran en la tasa de error del SLA.
   El mismo dashboard tiene una fila **Negocio** con las métricas de negocio (ver abajo): mercado, sincronización de datos, cotización, y alertas y notificaciones.
   Hay un segundo dashboard, [**FútVal — errores**](http://localhost:3001/d/futval-errors), con el detalle de los errores: totales de 4xx y 5xx, desglose por código de estado, endpoints con más errores y una tabla por método, ruta y código.

### Métricas de negocio

Además de cómo responde la API, `GET /metrics` expone cómo se usa y cómo funciona el producto (sin endpoints ni SLA nuevos). Las etiquetas toman valores de conjuntos cerrados y nunca identifican a un usuario, un jugador ni una corrida puntual.

| Métrica | Tipo | Etiquetas | Qué mide |
|---|---|---|---|
| `business_operations_total` | counter | `operation`, `outcome` (`success`, `rejected`, `unexpected`) | Operaciones de escritura de la API por tipo y resultado. `success` es "operación aceptada": para `PLAYER_SYNC_TRIGGERED` es *corrida aceptada*, no *corrida terminada* (eso lo cuenta `sync_runs_total`). |
| `market_tokens_traded_total` | counter | `side` (`buy`, `sell`) | Tokens operados, sólo de órdenes efectivamente registradas. |
| `market_volume_credits_total` | counter | `side` | Volumen en créditos (cantidad × precio de cada fill). |
| `market_order_rejections_total` | counter | `reason` (`insufficient_balance`, `insufficient_tokens`, `tokens_unavailable`, `other`) | Órdenes rechazadas al crearse. Mide sólo el alta de órdenes, no las cancelaciones. Hoy sólo `insufficient_tokens` y `other` tienen datos: no hay saldo monetario ni un error de "tokens no disponibles". |
| `sync_runs_total` | counter | `source` (`whoscored`, `football_data`), `trigger` (`scheduled`, `manual`), `outcome` (`success`, `partial`, `failure`) | Corridas de sincronización. `success`: todas las unidades bien; `partial`: algunas fallaron y otras no; `failure`: se abortó o ninguna terminó bien. |
| `sync_run_duration_seconds` | histogram | `source`, `trigger` | Duración de cada corrida. |
| `sync_last_success_timestamp_seconds` | gauge | `source` | Momento de la última corrida **`success`** de cada fuente (una `partial` o `failure` no lo mueve). Se guarda en la base y sobrevive al reinicio; sin ninguna corrida exitosa, la serie no existe. |
| `quote_recalculations_total` | counter | `trigger`, `outcome` (`success`, `failure`) | Recálculos de cotizaciones; la simulación de mercado cuenta como `manual`. |
| `quote_recalculation_duration_seconds` | histogram | `trigger` | Duración de cada recálculo. |
| `alerts_triggered_total` | counter | — | Alertas de precio disparadas. |
| `notifications_created_total` | counter | `delivery` (`live`, `stored_only`) | Notificaciones creadas: `live` llegó al usuario conectado, `stored_only` quedó guardada porque no estaba conectado. |
| `sse_connections_active` | gauge | — | Conexiones abiertas del stream de notificaciones en tiempo real. |

**Decisión de diseño:** el negocio se mide por separado de la API (`BusinessMetricsService` junto a `MetricsService`, mismo `GET /metrics`) y sólo se cuenta lo que realmente ocurrió: el éxito de una orden se cuenta después de confirmar la transacción y desde la capa de servicios, así una operación revertida o que no se concretó nunca figura como exitosa. Medir nunca altera el resultado de la operación medida.

**Riesgos aceptados (fuera de alcance):** las métricas viven en memoria y se reinician con el backend (salvo la última sincronización exitosa); con varias instancias cada una expone las suyas; no hay alertas sobre estos valores.

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
