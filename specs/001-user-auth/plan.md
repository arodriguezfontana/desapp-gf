# Implementation Plan: Autenticación de usuarios (alta, login y protección de endpoints con JWT)

**Branch**: `feat/auth` | **Feature dir**: `specs/001-user-auth/` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-user-auth/spec.md`

## Summary

Se implementa el alta de usuario, el login y la protección del resto de endpoints con JWT, sobre un backend NestJS 11 recién scaffoldeado que todavía **no tiene TypeORM configurado ni exception filter global**. El plan primero deja la infraestructura mínima en pie (ConfigModule + TypeORM apuntando a la base existente vía `DATABASE_URL`, `AllExceptionsFilter` global, `docker-compose.yml` para Postgres reproducible) y recién después construye el módulo `auth` respetando la arquitectura en capas de la constitución: DTOs en el Controller, orquestación en el Service, política de contraseña y normalización de email en el Dominio, persistencia aislada en un Repository con mapper explícito, y bcrypt/JWT detrás de puertos de dominio (Adapters). El guard es un `CanActivate` propio de Nest sobre `@nestjs/jwt`, registrado global, con `@Public()` para eximir alta y login.

## Technical Context

**Language/Version**: TypeScript 5.7 sobre Node.js 20 (CI) / Node ≥18 local; NestJS 11. `tsconfig` se lleva a `strict: true` (hoy está parcialmente relajado — ver Constitution Check).

**Primary Dependencies** (a agregar): `@nestjs/config`, `@nestjs/typeorm`, `typeorm`, `pg`, `@nestjs/jwt`, `bcrypt` (+ `@types/bcrypt`), `class-validator`, `class-transformer`. Ya presentes: `@nestjs/common/core/platform-express`, `@nestjs/swagger`, `reflect-metadata`, `rxjs`.

**Storage**: PostgreSQL nativo local, base ya creada. Conexión en `backend/.env` como `DATABASE_URL`; TypeORM lee esa URL en tiempo de ejecución, el valor no se reproduce en esta documentación. Acceso vía TypeORM (constitución). `synchronize` habilitado sólo fuera de producción (ver research.md); migraciones formales quedan como follow-up.

**Testing**: Jest + supertest. Unit de dominio sin Nest ni DB; integración de Service/Repository contra Postgres real; e2e con supertest sobre la app Nest en memoria, en carpeta propia `backend/src/tests/`.

**Target Platform**: Servidor Linux (API REST); consumido por el frontend React en `http://localhost:5173`.

**Project Type**: Web — monorepo `backend/` + `frontend/`. Esta feature es backend-only.

**Performance Goals**: Sin metas especiales. bcrypt cost factor 10 (~50–100 ms por hash) es aceptable para el volumen de cátedra.

**Constraints**: `JWT_SECRET` es secreto real (solo en `.env`, placeholder en `.env.example`); vencimiento del JWT = 24 h, constante nombrada en el módulo `auth` (no es secreto). Respuestas de error uniformes vía filtro único. Sin revelar existencia de emails en login (RA/DD de la spec).

**Scale/Scope**: Trabajo de cátedra; decenas de usuarios. Una tabla nueva (`users`), dos endpoints públicos (`POST /auth/register`, `POST /auth/login`), guard global para el resto.

## Constitution Check

*GATE: evaluado antes de Phase 0 y re-evaluado tras Phase 1. Constitución v1.4.1.*

| # | Principio | Estado | Cómo se cumple / nota |
|---|-----------|--------|-----------------------|
| I | Arquitectura en capas | ✅ | `auth` se organiza Controller → Service → {Domain, Repository, Adapter}. El Controller sólo llama al Service; los DTOs Request/Response viven en el Controller y se convierten a dominio antes de delegar. El Service recibe/devuelve objetos de dominio. El Repository es el único lugar donde conviven dominio y `UserEntity` de TypeORM, con `UserMapper` explícito sin lógica. bcrypt y `@nestjs/jwt` quedan detrás de puertos (`PasswordHasher`, `TokenIssuer`). Degradación ante proveedor externo: N/A (auth no usa proveedores externos). |
| II | Modelo de dominio rico | ✅ | Política de contraseña (8–16, mayúscula/minúscula/dígito/especial) y normalización + invariante de formato de email viven en value objects de dominio (`Password`, `Email`), no en el Controller ni el Service. Strategy de valuación: N/A para esta feature. |
| III | Cada validación en su nivel | ✅ | DTO (`class-validator`): forma y tipos (`@IsEmail`, `@IsString`, `@IsNotEmpty`). Service: que el email no exista ya (alta) / que la credencial sea válida (login). Dominio: invariantes (política de contraseña, formato de email) lanzando errores propios. Se **crea** `AllExceptionsFilter` global único (hoy no existe) que devuelve un único formato JSON de error con status correcto (400/401/404/409) y sin filtrar stack traces. |
| IV | Autenticación | ✅ | JWT vía `@nestjs/jwt`; alta y login son endpoints separados; login independiente emite el JWT; guard global exige JWT válido salvo `@Public()` (alta y login). Vencimiento definido = 24 h (constante `JWT_EXPIRES_IN` en el módulo). Contraseñas hasheadas con bcrypt. Ningún JWT/contraseña/dato personal se loguea ni se persiste en texto plano — el `AllExceptionsFilter` y los logs no incluyen bodies de auth. |
| V | Auditoría inmutable | ✅ (N/A) | El principio scope-a compra/venta de tokens. Alta y login no generan asientos de auditoría; no aplica. |
| VI | Integridad transaccional | ✅ | El alta escribe un solo agregado (`User`); es atómica por definición. No hay operación multi-estado en esta feature. |
| VII | Observabilidad | ⚠️ Parcial | `GET /health` ya existe. Logs estructurados, Correlation-ID middleware y métricas de latencia/error son infraestructura transversal del backend, no requisitos de correctitud de auth. Se difieren a una feature de observabilidad dedicada. Ver Complexity Tracking. |
| VIII | Documentación de la API | ✅ | OpenAPI vía `@nestjs/swagger` desde DTOs y decoradores (`@ApiTags`, `@ApiResponse`, `@ApiBearerAuth`). `addBearerAuth()` ya está en `main.ts`. No se edita el OpenAPI a mano. |
| IX | Testing | ✅ | Unit de dominio (`Password`, `Email`, `User`) sin Nest/DB. Integración de `AuthService` + `TypeOrmUserRepository` contra Postgres real (servicio en CI). e2e supertest en `backend/src/tests/auth/`. Casos felices y borde por comportamiento. CI se amplía con servicio Postgres y pasos de integración/e2e. |
| X | Definición de terminado | ✅ | El plan contempla: tests unit + integración (felices y borde), app compila y levanta local, Swagger actualizada, y colección de Postman creada/actualizada con `POST /auth/register` y `POST /auth/login`. |
| XI | Idioma | ✅ | Identificadores en inglés (`User`, `AuthService`, `findByEmail`); mensajes de error y docs en español; términos técnicos (token, endpoint) en inglés. |
| XII | Spec-first | ✅ | Este plan deriva de `spec.md`; toda ambigüedad ya quedó como decisión explícita en la spec (DD-001, RA-001, Assumptions). |

**Technology Stack & Constraints**: las dependencias nuevas están dentro del stack mandado (NestJS, TypeORM, Jest/supertest); bcrypt está explícitamente permitido por el Principio IV. No se requiere enmienda a la constitución.

**Resultado del gate**: PASA con una desviación deliberada y justificada (Principio VII parcial) registrada en Complexity Tracking. Sin bloqueos para Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-auth/
├── plan.md              # Este archivo
├── spec.md              # Especificación (ya existe)
├── research.md          # Phase 0 — decisiones técnicas
├── data-model.md        # Phase 1 — entidad y value objects
├── quickstart.md        # Phase 1 — guía de validación end-to-end
├── contracts/
│   ├── auth-api.md            # Contrato REST de /auth/register y /auth/login
│   ├── openapi-auth.yaml      # Contrato OpenAPI de los endpoints de auth
│   └── error-response.md      # Formato único de error del AllExceptionsFilter
├── checklists/
│   └── requirements.md  # (ya existe)
└── tasks.md             # Phase 2 (/speckit-tasks — NO lo crea /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── docker-compose.yml                     # NUEVO — Postgres reproducible; interpola ${POSTGRES_*} desde .env (sin credenciales literales, va versionado)
├── .env                                   # EXISTE — se agregan JWT_SECRET y POSTGRES_USER/PASSWORD/DB (no versionado)
├── .env.example                           # EXISTE — se agregan placeholders genéricos de JWT_SECRET y POSTGRES_USER/PASSWORD/DB
├── tsconfig.json                          # se activa "strict": true
└── src/
    ├── main.ts                            # registra ValidationPipe global; Swagger ya configurado
    ├── app.module.ts                      # importa ConfigModule, DatabaseModule, AuthModule; APP_FILTER, APP_GUARD, APP_PIPE
    ├── app.controller.ts                  # GET / y GET /health se marcan @Public()
    ├── config/
    │   └── configuration.ts               # (opcional) tipado de env
    ├── database/
    │   └── database.module.ts             # TypeOrmModule.forRootAsync — lee DATABASE_URL del ConfigService
    ├── shared/
    │   └── filters/
    │       ├── all-exceptions.filter.ts   # NUEVO — filtro global único
    │       └── all-exceptions.filter.spec.ts
    └── modules/
        └── auth/
            ├── auth.module.ts
            ├── auth.constants.ts          # JWT_EXPIRES_IN = '24h'; JWT_EXPIRES_IN_SECONDS = 86400
            ├── controller/
            │   ├── auth.controller.ts     # POST /auth/register, POST /auth/login
            │   └── dto/
            │       ├── register-request.dto.ts
            │       ├── login-request.dto.ts
            │       ├── register-response.dto.ts
            │       └── login-response.dto.ts
            ├── service/
            │   ├── auth.service.ts
            │   └── auth.service.integration-spec.ts   # contra Postgres real
            ├── domain/
            │   ├── user.ts                # clase de dominio rica, SIN decoradores TypeORM
            │   ├── email.ts               # value object: normaliza (trim+lowercase) + valida formato
            │   ├── password.ts            # value object: política 8–16 + 4 clases de carácter
            │   ├── user.spec.ts
            │   ├── email.spec.ts
            │   ├── password.spec.ts
            │   └── errors/
            │       ├── email-already-in-use.error.ts
            │       ├── invalid-password.error.ts
            │       └── invalid-credentials.error.ts
            ├── repository/
            │   ├── user.repository.ts     # puerto (interface) + token USER_REPOSITORY
            │   ├── typeorm-user.repository.ts
            │   ├── entities/
            │   │   └── user.entity.ts     # @Entity('users') — vive sólo en esta capa
            │   └── mappers/
            │       └── user.mapper.ts     # domain <-> entity, sin lógica de negocio
            ├── adapters/
            │   ├── password-hasher.ts     # puerto + token
            │   ├── bcrypt-password-hasher.ts
            │   ├── token-issuer.ts        # puerto + token (issue + verify)
            │   └── jwt-token-issuer.ts    # envuelve @nestjs/jwt JwtService
            └── guards/
                ├── jwt-auth.guard.ts      # CanActivate propio; sin Passport
                └── public.decorator.ts    # @Public() -> SetMetadata('isPublic', true)

backend/src/tests/
└── auth/
    └── auth.e2e-spec.ts                   # supertest: register -> login -> endpoint protegido

.github/workflows/ci.yml                   # se agrega servicio postgres + pasos de integración/e2e
docs/postman/desapp.postman_collection.json # NUEVO/actualizado — requests de auth (Principio X)
```

**Structure Decision**: Monorepo web existente; toda la feature vive en `backend/`. El módulo `auth` sigue la arquitectura en capas del Principio I con subcarpetas explícitas por capa (`controller/`, `service/`, `domain/`, `repository/`, `adapters/`, `guards/`). La infraestructura compartida (ConfigModule, TypeORM, filtro global) se ubica fuera de `auth` (`config/`, `database/`, `shared/`) porque la usará todo el backend, no sólo esta feature.

## Complexity Tracking

| Violación | Por qué es necesaria | Alternativa más simple, y por qué se rechaza |
|-----------|----------------------|----------------------------------------------|
| Principio VII (Observabilidad) queda **parcial**: se difieren logs estructurados, Correlation-ID middleware y métricas de latencia/tasa de error | La feature de auth se puede entregar, testear y demostrar sin ese stack; su correctitud no depende de él. `GET /health` ya existe. Meter observabilidad transversal acá mezclaría dos alcances y agrandaría la superficie de review de esta spec. | Implementar todo el stack de observabilidad ahora: se rechaza porque es infraestructura de todo el backend, merece su propia spec y su propio set de tests, y no cambia el comportamiento de alta/login/guard. Se registra como deuda explícita y se abordará en una feature `observability` dedicada antes de las features de compra/venta de tokens (donde la auditoría del Principio V la vuelve indispensable). |
| `synchronize: true` de TypeORM (gated a `NODE_ENV !== 'production'`) en lugar de migraciones versionadas | Acelera el setup local y de CI para una única tabla (`users`); la cátedra prioriza avanzar sobre features. | Migraciones formales ahora: se difieren (no se rechazan) — se agregará infra de migraciones cuando haya una segunda entidad o antes del primer deploy real. Documentado en research.md como deuda aceptada. |
| `tsconfig` pasa a `strict: true` (hoy `noImplicitAny:false`, `strictBindCallApply:false`) | El Principio de Technology Stack exige modo `strict`; el código nuevo de auth se escribe estricto desde el día uno. | Dejar el `tsconfig` como está: se rechaza porque contradice la constitución; el cambio es chico y el código existente (`app.*`) es trivial de ajustar si algo rompe. |

## Phase 0 — Research

Ver [research.md](./research.md). Resuelve: parsing de `DATABASE_URL` en TypeORM, estrategia `synchronize` vs migraciones, cost factor de bcrypt, forma del payload JWT y verificación en el guard, ubicación de la política de contraseña (DTO vs dominio), respuesta uniforme para "email inexistente" vs "contraseña incorrecta", y credenciales del `docker-compose.yml` frente a `DATABASE_URL`.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md): entidad `User`, value objects `Email` y `Password`, tabla `users`, reglas de validación mapeadas a FR de la spec.
- [contracts/auth-api.md](./contracts/auth-api.md) + [contracts/openapi-auth.yaml](./contracts/openapi-auth.yaml): `POST /auth/register`, `POST /auth/login`, y el contrato de "endpoint protegido" (header `Authorization: Bearer`, 401 sin/ inválido/ vencido).
- [contracts/error-response.md](./contracts/error-response.md): formato JSON único del `AllExceptionsFilter` y tabla de mapeo error de dominio → status.
- [quickstart.md](./quickstart.md): pasos reproducibles para levantar Postgres (nativo o docker-compose), correr migración/synchronize, arrancar el backend y validar el flujo alta → login → endpoint protegido, más los casos de rechazo.

## Post-Design Constitution Re-Check

Sin cambios respecto del gate inicial: el diseño de Phase 1 mantiene las capas, concentra invariantes en el dominio, usa un único filtro global y no introduce dependencias fuera del stack. La única desviación sigue siendo el Principio VII parcial, ya justificada.
