# Research: Health check del backend

Verificación del plan técnico del equipo contra el código del repo y contra el código fuente de
`@nestjs/terminus` (descargado y leído: 11.1.1 y 12.1.0). No quedó ningún `NEEDS CLARIFICATION`.

## 1. Versión de `@nestjs/terminus`

- **Decision**: instalar `@nestjs/terminus@^11.1.1` con `pnpm add`.
- **Rationale**: la última (12.1.0) declara `"type": "module"` y su `dist` usa `import … from '….js'` (ESM puro). El backend
  compila a CommonJS (`nest build`, `start:prod: node dist/src/main`) y los tests corren con `ts-jest` sin ESM; importarla
  fallaría en runtime y en Jest. La 11.1.1 es CommonJS, tiene peers `@nestjs/core|common ^11`, `@nestjs/typeorm ^11`, `typeorm *`
  (el repo usa Nest 11, `@nestjs/typeorm` 11 y `typeorm` 1.1.x) y es la línea compatible.
- **Alternatives considered**: 12.x (descartada: ESM-only); indicador propio con `DataSource.query('SELECT 1')` (descartada: reimplementa lo que Terminus ya resuelve, incluido el timeout).
- **Corrección al plan del equipo**: el repo usa **pnpm** (`backend/pnpm-lock.yaml`), no npm.

## 2. El `AllExceptionsFilter` global destruye el cuerpo del 503 de Terminus

- **Hallazgo**: `HealthCheckService.check()` (11.1.1) hace `throw new ServiceUnavailableException(result)` cuando algún indicador cae,
  con `result = { status: 'error', info, error, details }`. El filtro global (`shared/filters/all-exceptions.filter.ts`) tiene `@Catch()` y,
  para cualquier `HttpException`, sólo conserva `status` y `res.message ?? exception.message`; arma
  `{ statusCode, error: REASON_PHRASES[503] ?? 'Error', message: 'Service Unavailable Exception', timestamp, path }`.
  Resultado: 503 sí, pero **sin** `status: "error"` y **sin** el detalle por componente. Eso rompe FR-003, FR-004, US2 y SC-007.
- **Decision**: `HealthService.check()` atrapa la `ServiceUnavailableException` (`exception.getResponse()` es el resultado) y **devuelve** el
  resultado en lugar de relanzarla. El controller usa `@Res({ passthrough: true })` y fija `503` si `status !== 'ok'`. El filtro global no se modifica.
- **Rationale**: no toca el comportamiento de errores del resto de la API (Principio III); mantiene la lógica de "qué status HTTP" en un único lugar
  testeable; el endpoint de salud no es un error de negocio, es un informe.
- **Alternatives considered**:
  - Agregar una rama especial en `AllExceptionsFilter` para `ServiceUnavailableException` con forma de health check: acopla el filtro global a Terminus y es más invasivo.
  - Usar `@HealthCheck()` y confiar en el 503 automático (plan original): descartado por lo anterior.
  - `@UseFilters` local en el controller: agrega un filtro más sólo para un endpoint; peor que atrapar en el service.

## 3. No hay fuga de información en el cuerpo (FR-008)

- **Hallazgo**: en 11.1.1 `TypeOrmHealthIndicator.pingCheck` captura cualquier error del ping y devuelve `check.down()` **sin mensaje**; sólo
  agrega `message: "timeout of Nms exceeded"` en caso de timeout. Nunca copia `err.message`, la URL de conexión ni el stack.
  Si no encuentra la `DataSource`, devuelve `down('Connection provider not found in application context')` — texto fijo, sin datos sensibles.
- **Decision**: usar el indicador tal cual, y cubrir con un test e2e que un error de ping con texto "sensible" (p. ej. contiene la cadena de conexión) no aparece en el body.
- **Nota**: Terminus además loguea en el servidor (`Health Check has failed!` + `details`) cuando algo cae; son los mismos datos sin sensibles y no llegan al cliente.

## 4. Timeout del chequeo (FR-009, SC-004)

- **Hallazgo**: `pingCheck` usa 1000 ms por defecto (`options.timeout || 1000`); al vencer devuelve `down`.
- **Decision**: pasar `timeout: 3000` explícito. Con base sana la respuesta tarda milisegundos (< 1 s); con la base colgada responde 503 a los ~3 s (< 5 s).
- **Rationale**: 1 s es corto para un `SELECT 1` bajo carga (falsos "down"); 3 s deja margen sin pasar el límite de SC-004.
- **Alternatives considered**: mantener 1000 ms (riesgo de falsos positivos); variable de entorno para el timeout (descartada: el plan pide cero variables nuevas y no hay necesidad).

## 5. Ubicación de archivos

- **Hallazgo**: `backend/src` está organizado por capa (`controllers/<feature>/`, `services/<feature>/`, `modules/<feature>/`, …) y el test tsarch
  (`test/architecture.spec.ts`) aplica sus reglas por carpeta de capa (`controllers`, `services`, `domain`, …). Una carpeta `src/health/` quedaría fuera de ese esquema.
- **Decision**: `controllers/health/`, `services/health/`, `modules/health/` (sin `domain/` ni `repositories/`).
- **Rationale**: consistencia con el resto del repo y con la constitución (Principio I y sección Estructura); el controller sólo habla con el service.
- **Alternatives considered**: `src/health/` con controller y módulo juntos (plan original): rompe la convención y deja la feature sin cobertura de las reglas de capas.

## 6. Chocan los `GET /health`: hay que retirar el viejo

- **Hallazgo**: `AppController.getHealth()` ya expone `GET /health` con `@Public()` (siempre `ok`, más `service` y `timestamp`) y `AppService.getHealth()`. Con un
  segundo handler en `HealthController` el ruteo quedaría ambiguo (gana el primero registrado y el check real no correría).
- **Decision**: eliminar `getHealth` de `AppController` y `AppService` y los bloques `describe('getHealth')` de sus specs.
- **Consumidores verificados**:
  - `frontend/test/setup/global-setup.ts` espera `res.ok` en `/health`: sigue funcionando (200 con base sana); no depende de `service`/`timestamp`.
  - `backend/test/protected.e2e-spec.ts` sólo afirma 200 sin token: sigue pasando.
  - `docker-compose.yml` usa `pg_isready` para Postgres; no consume el endpoint.
  - `docs/postman/desapp.postman_collection.json`: una request a `/health` (sólo afirma 200); se actualiza descripción y aserciones.
- **Restricción**: Principio IX prohíbe modificar/borrar tests existentes sin un "sí" explícito. Queda registrado como puerta en `plan.md` (sección "Tests existentes afectados").

## 7. Swagger

- **Hallazgo**: no hay convención de excluir endpoints de infraestructura (`AppController` no usa ningún decorador de Swagger; hoy `/health` aparece sin descripción). Los demás controllers usan `@ApiTags`, `@ApiOperation`, `@ApiResponse` y DTOs en `controllers/<feature>/dto/`.
- **Decision**: documentarlo como cualquier otro endpoint: `@ApiTags('health')`, `@ApiOperation`, `@ApiResponse` 200 y 503 con un `HealthResponseDto`. No se usa `@HealthCheck()` de Terminus (el service ya maneja el 503 y su decorador agregaría esquemas Swagger propios duplicados).

## 8. Estrategia de pruebas (Principio IX)

- **Unit (`HealthService`)**: con `HealthCheckService` y `TypeOrmHealthIndicator` simulados: base up → devuelve `ok`; `check` lanza `ServiceUnavailableException` → devuelve el resultado `error` sin relanzar; error inesperado distinto de `ServiceUnavailableException` → se propaga (lo resolverá el filtro como 500, sin fuga). Se verifica `pingCheck('database', { timeout: 3000 })`.
- **Unit (`HealthController`)**: resultado `ok` → no cambia el status (200); resultado `error` → `res.status(503)`.
- **E2E (`test/health.e2e-spec.ts`)**, sobre `createTestApp()` (Postgres Testcontainers, nunca la base de desarrollo):
  - 200 sin token, `status: "ok"`, `details.database.status: "up"`.
  - 503 con `jest.spyOn(dataSource, 'query').mockRejectedValue(new Error(<texto con cadena de conexión>))`: `status: "error"`, `error.database.status: "down"` y el texto sensible **no** aparece en el body.
  - 503 con `query` que nunca resuelve: responde dentro de < 5 s con `database` `down` (timeout).
  - Recuperación: tras restaurar el spy, la siguiente consulta vuelve a 200 (FR-010 / SC-003).
  - Sólo `database` figura en `details` (no hay Football-Data/WhoScored — FR-006).
- **Arquitectura**: el test tsarch existente cubre las capas nuevas sin cambios.
- **Sin tocar**: `protected.e2e-spec.ts` (sigue válido).
- **Alternativa descartada**: no testear el 503 "porque lo resuelve Terminus" (plan original): el 503 con cuerpo depende de código propio (punto 2) y FR-003/FR-008/FR-009/SC-001 lo exigen.

## 9. Fuera de alcance / notas

- `shutting_down`: Terminus devuelve `status: "shutting_down"` (503) sólo si la app llama `enableShutdownHooks()`; `main.ts` hoy no lo hace, así que ese valor no aparece. Si en el futuro se habilita, el contrato admite también ese valor (se documenta en el contrato).
- Logging/métricas (ítems #1 y #3 del plan del equipo): independientes, sin orden forzado.
