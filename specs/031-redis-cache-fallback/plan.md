# Implementation Plan: Caché Redis para endpoints de alta frecuencia y degradación controlada ante fallas externas

**Branch**: `031-redis-cache-fallback` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/031-redis-cache-fallback/spec.md` + directivas del equipo para aceleración con Redis, fallback ante caídas externas y optimización de base de datos con índices reales medidos (ver [research.md](research.md)).

## Summary

La feature incorpora una capa de aceleración y resiliencia distribuida basada en Redis para absorber las consultas de lectura de mayor concurrencia del sistema: catálogo (`GET /players`), detalle de jugador (`GET /players/:id`) y ranking de cotizaciones personal (`GET /players/ranking`), aplicando el patrón Cache-Aside con generación canónica de claves y tiempos de vida (TTL) diferenciados. Se implementa una política de invalidación reactiva por eventos de dominio (`quote.recalculated`, cambio de estrategia y fin de sincronización), garantizando consistencia inmediata de precios sin exhibir datos obsoletos.

Para cumplir con los Principios I y XIII de la constitución, el sistema implementa un mecanismo de fallback explícito de dos niveles para datos dependientes de APIs externas (Football-Data.org / WhoScored): ante errores 5xx, timeouts o límites de tasa (HTTP 429), se recurre a la copia en caché o al almacenamiento local en PostgreSQL, degradando a `null` sin propagar respuestas 500 al cliente. Asimismo, la integración con Redis opera en modo *fail-open*, derivando las consultas a PostgreSQL si el broker de caché sufriera una caída. Finalmente, se agregan dos índices compuestos específicos calculados a partir de los patrones de acceso reales medidos en `players` y `player_quotes`, y se optimiza la consulta de ranking en el repositorio para suprimir ordenamientos globales redundantes en memoria.

## Technical Context

**Language/Version**: TypeScript 5.7 (`strict`), Node.js 20, NestJS 11.0

**Primary Dependencies**: `ioredis` (v5.x), TypeORM (1.1.x) sobre PostgreSQL (`pg`), `@nestjs/event-emitter`, `axios`, `nestjs-pino`, `prom-client`

**Storage**: Redis 7 (`redis:7-alpine`) en memoria para caché distribuida; PostgreSQL 16 para persistencia relacional. Dos nuevos índices compuestos creados mediante migración TypeORM: `idx_players_removed_league_position` y `idx_player_quotes_user_player_calc_desc`.

**Testing**: Jest unitario con mocks de Redis (sin levantar contenedor), pruebas de integración con Testcontainers (PostgreSQL y Redis efímeros), tests e2e con Supertest validando cache hit, fail-open, invalidaciones reactivas y fallback ante fallas externas simuladas.

**Target Platform**: Linux / Docker (desarrollo local en Windows/Docker Desktop, producción en contenedores).

**Project Type**: Web service backend (monorepo; cambios concentrados en `backend/`).

**Performance Goals**: Latencia p95 < 15 ms en consultas con acierto en caché (*cache hit*) para catálogo y ranking; p95 < 100 ms ante *cache miss* en PostgreSQL gracias a los nuevos índices; tiempo de fallback < 50 ms ante fallas externas simuladas.

**Constraints**: Tolerancia estricta a caídas (*fail-open*): la indisponibilidad de Redis nunca debe provocar un 500; tasa de error 5xx del 0 % ante caídas de proveedores externos; aislamiento absoluto de cotizaciones entre usuarios en el ranking.

**Scale/Scope**: ~1 módulo nuevo (`RedisCacheModule` + `RedisCacheService`), ~3 servicios adaptados (`PlayerEnrichmentService`, `QuotationService`, `HttpFootballDataAdapter`), 1 migración TypeORM de índices, 1 listener de invalidación reactiva, actualización de `docker-compose.yml`, `package.json` y `.env.example`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Nota |
|-----------|--------|------|
| **I. Arquitectura en capas** | ✅ | La lógica de caché y fallback vive en la capa de servicios (`PlayerEnrichmentService`, `HttpFootballDataAdapter`) e infraestructura (`RedisCacheService`). Los Controllers no manejan conexiones a Redis ni orquestación compleja. La degradación ante caída del proveedor externo cumple la regla explícita del Principio I (continuar con datos locales sin bloquearse). |
| **II. Modelo de dominio rico** | ✅ | La normalización y hashing canónico de parámetros de consulta se expresa en funciones puras sin dependencias de frameworks ni de TypeORM. |
| **III. Validación por nivel** | ✅ | Los DTOs de entrada continúan validando los filtros y paginación (`class-validator`); la caché sólo almacena respuestas validadas y sanitizadas. |
| **IV. Seguridad y secreto** | ✅ | Las claves de ranking incluyen el `userId` autenticado mediante el JWT validado; ningún usuario puede consultar ni inferir claves de cotizaciones de otros usuarios. Credenciales de Redis en variables de entorno. |
| **V. Auditoría inmutable** | ✅ N/A | Las operaciones de consulta en caché son de solo lectura y no alteran los asientos inmutables de auditoría de transacciones ni tenencias. |
| **VI. Integridad transaccional** | ✅ | Las invalidaciones de caché se ejecutan tras confirmar las transacciones en base de datos (`saveMany` de cotizaciones y sincronizaciones), evitando lecturas fantasma o estados inconsistentes. |
| **VII. Observabilidad** | ✅ | Cada acierto/fallo de caché, evento de invalidación, error de conexión de Redis y activación de fallback externo se registra en los logs estructurados con Correlation ID. Las métricas de latencia en `/metrics` reflejan las mejoras de SLA. |
| **VIII. Documentación de API** | ✅ N/A | Los contratos públicos de Swagger y Postman (`GET /players`, `GET /players/:id`, `GET /players/ranking`) no cambian sus esquemas de respuesta: responden idéntico pero más rápido. |
| **IX. Testing** | ✅ | Unitarios puros de hashing y fail-open, pruebas de integración con contenedores efímeros y e2e validando escenarios de acierto, expiración, invalidación y fallback. Cero tests existentes rotos. |
| **X. Definición de terminado (DoD)** | ✅ | Todo cubierto con tests, lint aprobado, `pnpm build` sin errores, Docker Compose actualizado y documentación alineada. |
| **XI. Idioma** | ✅ | Código e identificadores en inglés (`RedisCacheService`, `buildCacheKey`); comentarios, documentación, commits y mensajes de log en español. |
| **XII. Spec-first** | ✅ | `spec.md` redactado y validado en `specs/031-redis-cache-fallback/` antes de la planificación. |
| **XIII. Performance y degradación** | ✅ | Cumplimiento directo y exhaustivo: SLA verificado (<15 ms), capa de caché para alta frecuencia que sigue sirviendo si el proveedor externo falla, e índices de base de datos justificados en accesos reales medidos. |

**Post-design (re-evaluado tras Fase 1)**: Todos los principios se cumplen estrictamente sin requerir desvíos ni excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/031-redis-cache-fallback/
├── plan.md              # Este documento
├── research.md          # Investigación técnica, trade-offs y decisiones
├── data-model.md        # Esquema de claves Redis, payloads e índices en PostgreSQL
├── quickstart.md        # Guía paso a paso de verificación y pruebas
├── contracts/           # Contratos formales
│   ├── cache-keys-and-payloads.md
│   └── external-fallback-behavior.md
├── checklists/
│   └── requirements.md  # Validación de calidad de la especificación
└── tasks.md             # Tareas de implementación (generadas por /speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── docker-compose.yml                                            # + servicio redis (redis:7-alpine) en puerto 6379 con healthcheck
├── package.json                                                  # + ioredis en dependencies, + @types/ioredis en devDependencies
├── .env.example                                                  # + REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_TTL_*
├── src/
│   ├── app.module.ts                                             # + import de RedisCacheModule
│   ├── database/
│   │   └── migrations/
│   │       └── 1793200000000-AddPerformanceIndexes.ts           # + índices idx_players_removed_league_position y idx_player_quotes_user_player_calc_desc
│   ├── domain/
│   │   └── cache/
│   │       ├── build-cache-key.ts                                # Función pura de hashing canónico y normalización
│   │       └── build-cache-key.spec.ts                           # Tests unitarios de hashing determinista
│   ├── shared/
│   │   └── cache/
│   │       ├── redis-cache.module.ts                             # Módulo global de infraestructura de caché
│   │       ├── redis-cache.service.ts                            # Servicio con métodos get/set/del/delByPrefix y fail-open
│   │       └── redis-cache.service.spec.ts                       # Tests de servicio con cliente simulado y manejo de errores
│   ├── adapters/
│   │   └── competition/
│   │       ├── http-football-data-adapter.ts                     # + Fallback explícito de dos niveles (Redis → Postgres local → null)
│   │       └── http-football-data-adapter.spec.ts                # Tests de fallback ante 5xx, timeout y 429
│   ├── services/
│   │   ├── player/
│   │   │   ├── player-enrichment.service.ts                      # + Cache-Aside en listPlayersWithCrests, getRankingWithCrests, getPlayerByIdWithCrest
│   │   │   └── player-enrichment.service.spec.ts                 # Tests de acierto y fallo de caché en enriquecimiento
│   │   └── quotation/
│   │       ├── quotation.service.ts                              # + Emisión de evento o llamada a invalidación tras recalculateAll
│   │       └── listeners/
│   │           └── quotation-cache-invalidation.listener.ts      # Invalida futval:ranking:userId:* ante recálculo o cambio de estrategia
│   └── repositories/
│       └── player/
│           ├── player.repository.ts                              # Optimización de consulta findRanking con nuevo índice compuesto
│           └── player.repository.integration.spec.ts             # Verificación de findRanking con cotizaciones acumuladas
└── test/
    └── e2e/
        └── redis-cache-fallback.e2e-spec.ts                      # Validación integral end-to-end (hit, miss, invalidación, fail-open, fallback externo)
```

**Structure Decision**: El proyecto backend es una aplicación modular NestJS estructurada en capas (`domain/`, `services/`, `repositories/`, `adapters/`, `shared/`). La integración de Redis se ubica en `shared/cache/`, desacoplada de la lógica de negocio; el adaptador de Football-Data incorpora el fallback en `adapters/competition/`; la invalidación reactiva se gestiona mediante eventos en `services/quotation/listeners/`; y los índices se registran en una migración estándar de TypeORM en `database/migrations/`.

## Complexity Tracking

> No se detectaron violaciones a los principios de la constitución ni desvíos que requieran justificación adicional.
