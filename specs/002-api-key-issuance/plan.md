# Implementation Plan: Emisión de ApiKey para usuario autenticado

**Branch**: `002-api-key-issuance` | **Feature dir**: `specs/002-api-key-issuance/` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-api-key-issuance/spec.md` + notas de diseño del usuario (SHA-256, adapter `TokenHasher`, prefijo `pmk_`, header `X-Api-Key`).

## Summary

Se implementa la emisión y rotación de ApiKey para usuarios autenticados exponiendo el endpoint `POST /auth/api-key`. El endpoint está protegido por el `JwtAuthGuard` global existente (Feature 1). Cada usuario posee como máximo una ApiKey activa a la vez; si se emite una nueva, la anterior es invalidada de inmediato de forma atómica en base de datos. La ApiKey se genera con 32 bytes de entropía criptográfica (`crypto.randomBytes`), codificada en hexadecimal con el prefijo `pmk_` (68 caracteres en total). Se devuelve en texto plano únicamente en la respuesta del endpoint y se almacena en la base de datos hasheada con SHA-256 (no bcrypt, por su condición de secreto de alta entropía y para no penalizar el rendimiento por request). El hasheo se aisla detrás del puerto de dominio `TokenHasher` implementado por el adaptador `Sha256TokenHasher`, cumpliendo estrictamente la arquitectura en capas y los tests automáticos de arquitectura con `tsarch`.

## Technical Context

**Language/Version**: TypeScript 5.7 sobre Node.js 20 (CI) / Node ≥18 local; NestJS 11 (`strict: true`).

**Primary Dependencies**: Ya presentes en el workspace: `@nestjs/common`, `@nestjs/core`, `@nestjs/config`, `@nestjs/typeorm`, `typeorm`, `pg`, `@nestjs/jwt`, `@nestjs/swagger`, `class-validator`, `class-transformer`. En devDependencies: `@testcontainers/postgresql`, `tsarch`, `jest`, `supertest`. Módulo nativo: `node:crypto`. No se requieren dependencias externas adicionales.

**Storage**: PostgreSQL. Tabla nueva `api_keys` con columnas `id` (uuid), `user_id` (uuid, fk -> `users`), `key_hash` (varchar(64), unique), `created_at` (timestamptz), `revoked_at` (timestamptz, nullable). Índice parcial único: `CREATE UNIQUE INDEX idx_api_keys_active_user ON api_keys (user_id) WHERE revoked_at IS NULL;` para garantizar a nivel de motor relacional exactamente una clave activa por usuario.

**Testing**: Jest + supertest + Testcontainers + tsarch (Constitución v1.5.0):
- **Unitarios**: tests puros de dominio para `RawApiKey` (validación de formato `pmk_...`, generación aleatoria), `ApiKey` (invariantes y método `revoke()`), y adaptador `Sha256TokenHasher` sin levantar Nest ni base de datos.
- **Arquitectura**: tests con `tsarch` en `test/architecture/layers.spec.ts` verificando que el Controller no dependa de repositorios/adaptadores, y que el Service no importe `node:crypto` ni entidades de TypeORM directamente.
- **Integración**: tests de `ApiKeyService` + `TypeOrmApiKeyRepository` contra instancia efímera de PostgreSQL con Testcontainers (`pnpm test:integration`).
- **End-to-End**: test e2e con supertest en memoria (`backend/src/tests/api-key/api-key.e2e-spec.ts`) validando el flujo Register -> Login -> Issue ApiKey -> Re-issue (invalidación) -> 401 Unauthorized.

**Target Platform**: Servidor Linux / Node.js (API REST); consumido por clientes externos y aplicaciones autorizadas.

**Project Type**: Backend dentro del monorepo (`backend/`).

**Performance Goals**: Emisión de ApiKey en < 1 segundo (< 10 ms de cálculo de CPU; SHA-256 se calcula en microsegundos y la persistencia requiere una única transacción en Postgres).

**Constraints**:
- La ApiKey en texto plano JAMÁS se persiste ni se loguea.
- Header `Authorization: Bearer <jwt>` se mantiene para la emisión; header `X-Api-Key` queda formalmente estandarizado para el consumo futuro de la clave.
- Cero tolerancia a dobles claves activas: garantizado por transacción y por índice parcial único en la base de datos.

**Scale/Scope**: Trabajo de cátedra. Monorepo con backend NestJS. 1 módulo nuevo (`ApiKeyModule`), 1 tabla nueva (`api_keys`), 1 endpoint nuevo (`POST /auth/api-key`).

## Constitution Check

*GATE: evaluado antes de Phase 0 y re-evaluado tras Phase 1. Constitución v1.5.0.*

| # | Principio | Estado | Cómo se cumple / justificación |
|---|-----------|--------|--------------------------------|
| I | Arquitectura en capas | ✅ | El módulo se organiza estrictamente en capas: Controller (`ApiKeyController`) → Service (`ApiKeyService`) → {Dominio, Repository, Adapter}. El Controller solo interactúa con el Service; DTOs viven en el Controller; el Service solo recibe/devuelve objetos de dominio; la entidad `ApiKeyEntity` y `ApiKeyMapper` viven exclusivamente en el Repository. La librería `node:crypto` para hasheo se aísla detrás del puerto `TokenHasher` implementado en el adaptador `Sha256TokenHasher`. |
| II | Modelo de dominio rico | ✅ | La regla de formato de la clave (`pmk_` + 64 hex), la generación criptográfica segura y las transiciones de validez (`revoke()`, `isActive()`) residen en clases de dominio puras (`RawApiKey`, `ApiKey`), no en el Controller ni en el Service. |
| III | Cada validación en su nivel | ✅ | DTO: valida requests HTTP. Service: orquesta la verificación del usuario autenticado. Dominio: invariantes de formato de clave y restricción de doble revocación (`ApiKeyAlreadyRevokedError`). Errores capturados y normalizados por el `AllExceptionsFilter` global existente. |
| IV | Autenticación | ✅ | Endpoint protegido mediante `JwtAuthGuard`. El secreto de la ApiKey nunca se persiste en texto plano ni se expone en logs. Se adopta SHA-256 (con justificación documentada en `research.md`) en lugar de bcrypt por tratarse de un secreto de alta entropía del sistema para evitar degradación de latencia. |
| V | Auditoría inmutable | ✅ | Se mantiene historial de credenciales mediante soft-revocation (`revoked_at`), preservando constancia auditable de cuándo fue creada y revocada cada clave. |
| VI | Integridad transaccional | ✅ | La revocación de la clave existente y la creación de la nueva se confirman conjuntamente en una única transacción de TypeORM; si algo falla, no se revoca la anterior ni se crea la nueva. |
| VII | Observabilidad | ✅ | La ApiKey en texto plano nunca se loguea en consola ni en trazas de error. Correlation ID y `AllExceptionsFilter` ocultan datos sensibles. |
| VIII | Documentación de la API | ✅ | El endpoint se documenta mediante `@nestjs/swagger` (`@ApiTags('auth')`, `@ApiBearerAuth()`, `@ApiResponse`) en DTOs y Controller. No se edita OpenAPI a mano. |
| IX | Testing | ✅ | Pirámide completa: Unitarios de dominio/adaptador sin base; integración con Testcontainers (Postgres efímero); e2e con supertest; test de arquitectura `tsarch` que falla el build si se violan las capas; no se modifican ni eliminan tests existentes. |
| X | Definición de terminado | ✅ | Incluye tests unitarios + integración + e2e + tsarch pasando; compilación limpia; Swagger actualizado; colección de Postman (`docs/postman/desapp.postman_collection.json`) actualizada con `POST /auth/api-key`. |
| XI | Idioma | ✅ | Identificadores en inglés (`ApiKey`, `ApiKeyService`, `TokenHasher`, `Sha256TokenHasher`, `RawApiKey`), comentarios, errores y documentación en español. |
| XII | Spec-first | ✅ | Plan derivado formalmente de `specs/002-api-key-issuance/spec.md`. |

**Resultado del gate**: PASA sin violaciones ni desvíos injustificados.

## Project Structure

### Documentation (this feature)

```text
specs/002-api-key-issuance/
├── plan.md              # Este documento
├── spec.md              # Especificación funcional aprobada
├── research.md          # Decisiones de arquitectura (SHA-256, TokenHasher, pmk_, persistencia)
├── data-model.md        # Diagrama de entidades de dominio y persistencia
├── quickstart.md        # Guía paso a paso de validación y comandos
├── contracts/
│   ├── api-key-api.md        # Contrato REST del endpoint POST /auth/api-key
│   └── openapi-api-key.yaml  # Esquema OpenAPI 3.0 de referencia
├── checklists/
│   └── requirements.md  # Checklist de calidad de la spec
└── tasks.md             # Tareas ordenadas (generado en /speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── app.module.ts                         # Importa ApiKeyModule
│   └── modules/
│       └── api-key/
│           ├── api-key.module.ts
│           ├── api-key.constants.ts          # Tokens: API_KEY_REPOSITORY, TOKEN_HASHER
│           ├── controller/
│           │   ├── api-key.controller.ts     # POST /auth/api-key (@ApiBearerAuth())
│           │   ├── api-key.controller.spec.ts
│           │   └── dto/
│           │       └── issue-api-key-response.dto.ts
│           ├── service/
│           │   ├── api-key.service.ts        # Orquesta emisión y rotación atómica
│           │   ├── api-key.service.spec.ts   # Unitario con mocks de dominio
│           │   └── api-key.service.integration.spec.ts  # Testcontainers Postgres efímero
│           ├── domain/
│           │   ├── api-key.ts                # Entidad de dominio rica (id, userId, keyHash, revoke, isActive)
│           │   ├── raw-api-key.ts            # Value object: formato 'pmk_[0-9a-f]{64}', generate()
│           │   ├── api-key.spec.ts           # Tests unitarios de dominio
│           │   ├── raw-api-key.spec.ts       # Tests unitarios del value object
│           │   └── errors/
│           │       ├── invalid-api-key-format.error.ts
│           │       └── api-key-already-revoked.error.ts
│           ├── repository/
│           │   ├── api-key.repository.ts     # Puerto de dominio (interface)
│           │   ├── typeorm-api-key.repository.ts
│           │   ├── entities/
│           │   │   └── api-key.entity.ts     # @Entity('api_keys') con @Index parcial
│           │   └── mappers/
│           │       └── api-key.mapper.ts     # Mapeo bidireccional ApiKey <-> ApiKeyEntity
│           └── adapters/
│               ├── token-hasher.ts           # Puerto de dominio (interface)
│               ├── sha256-token-hasher.ts    # Implementación con node:crypto (timingSafeEqual)
│               └── sha256-token-hasher.spec.ts
│
backend/src/tests/
└── api-key/
    └── api-key.e2e-spec.ts                   # supertest: register -> login -> issue -> rotate -> 401

backend/test/architecture/
└── layers.spec.ts                            # Se agregan verificaciones tsarch para api-key

docs/postman/
└── desapp.postman_collection.json            # Se agrega la request POST /auth/api-key
```

**Structure Decision**: Se ubica en `backend/src/modules/api-key/` como módulo autónomo y desacoplado, integrado en `AppModule`. Reutiliza `JwtAuthGuard` y `CurrentUser()` de `modules/auth/` sin acoplarse a los detalles internos de persistencia de usuarios.

## Complexity Tracking

No se registran violaciones a la Constitución. La elección de SHA-256 para ApiKey en lugar de bcrypt se fundamenta técnicamente en la entropía intrínseca del token (256 bits) y la preservación de la latencia del sistema, encapsulado bajo el puerto `TokenHasher` según lo exigido en el Principio I.
