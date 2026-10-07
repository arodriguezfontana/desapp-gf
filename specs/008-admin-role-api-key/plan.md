# Implementation Plan: Rol de usuario (admin / user) y rol copiado en la ApiKey

**Branch**: `main` (sin rama creada) | **Feature dir**: `specs/008-admin-role-api-key/` | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-admin-role-api-key/spec.md`

## Summary

Se agrega un rol (`admin` | `user`, default `user`) a `User` y a `ApiKey`. El rol de la ApiKey se fija en el momento de la emisión y no se vuelve a consultar contra el usuario en cada request. El primer admin se crea con un seed idempotente que corre al arrancar la app antes de `listen()`. Se introduce un `AdminApiKeyGuard` que reutiliza la resolución de clave del `ApiKeyGuard` y agrega la verificación de rol; no se aplica a ningún endpoint todavía.

Precondiciones (ya implementadas): `001-user-auth` (entidad `User`, email único, bcrypt detrás de `PasswordHasher`) y `002-api-key-issuance` (entidad `ApiKey`, `ApiKeyGuard` que resuelve por hash sin tocar `User`, `saveWithRevocation`).

## Technical Context

**Language/Version**: TypeScript sobre NestJS 11 (backend).

**Primary Dependencies**: ya presentes: `@nestjs/typeorm`, `typeorm` 1.x, `@nestjs/config`, `bcrypt`, `@nestjs/swagger`. No se agregan dependencias.

**Storage**: PostgreSQL. La columna `role` de `users` y `api_keys` se agrega con una migration formal de TypeORM en `src/database/migrations/`, que corre en el pipeline de deploy a través del runner que ya existe (`runPlayerCatalogMigrations`, invocado desde `main.ts`). `synchronize` sigue a cargo del resto del esquema en dev/CI y queda apagado en producción (`src/database/database.module.ts`). Ver R1.

**Testing**: Jest. Unit (`--selectProjects unit`) para dominio, servicios y guards con mocks; integración (`test:integration`) contra Postgres efímero (Testcontainers, constitución IX); e2e (`test:e2e`) con supertest.

**Target Platform**: Servidor Linux (API REST). Backend-only.

**Project Type**: Web: monorepo `backend/` + `frontend/`. Esta feature toca solo `backend/`.

**Performance Goals**: Sin metas nuevas. La resolución de rol en request con ApiKey es la misma lectura que ya hace el guard (una sola query sobre `api_keys`).

**Constraints**:
- Ninguna contraseña (`ADMIN_PASSWORD` incluida) ni ApiKey en texto plano en logs o almacenamiento (constitución IV).
- El seed no modifica un usuario existente (spec FR-006).
- `ApiKeyGuard` mantiene su comportamiento observable (ver R3).

**Scale/Scope**: Una columna nueva en dos tablas, un enum de dominio, un service nuevo, un guard nuevo, cambios de firma en `User.register` y `ApiKey.issue`/`restore`, y un campo nuevo en la respuesta de `GET /auth/me`.

## Constitution Check

*GATE: evaluado antes de Phase 0 y re-evaluado tras Phase 1. Constitución v1.8.0.*

| # | Principio | Estado | Cómo se cumple / nota |
|---|-----------|--------|-----------------------|
| I | Arquitectura en capas | ✅ | `ApiKeyController` obtiene el `User` vía `AuthService.getById` (Controller → Service) y se lo pasa a `ApiKeyService.issueApiKey(user)`; el service no toca repositorios de otro módulo. `AdminSeedService` orquesta `UserRepository` + `PasswordHasher` (Service → puertos); `main.ts` solo lo invoca. `AdminApiKeyGuard` usa el mismo repositorio que el guard base. |
| II | Modelo de dominio rico | ✅ | `UserRole` es enum de dominio; `User.register` y `ApiKey.issue/restore` validan el rol en la clase de dominio (vía `parseUserRole`), no en DTO ni service. |
| III | Cada validación en su nivel | ✅ | DTO: el alta no recibe rol (ignorado, FR-003). Service: `ADMIN_EMAIL` existe o no; `ADMIN_PASSWORD` se valida con `Password` antes de hashear. Dominio: rol válido (`InvalidRoleError`). Forbidden del admin guard: 403 vía `AllExceptionsFilter` existente. |
| IV | Autenticación | ✅ | Sin cambios al JWT. Hash de `ADMIN_PASSWORD` con el mismo `PasswordHasher`. Logs del seed nombran la variable, nunca su valor. |
| V | Auditoría inmutable | ✅ (N/A) | No hay operación de compra/venta de tokens. |
| VI | Integridad transaccional | ✅ | El seed escribe un solo agregado (`User`). La emisión de ApiKey sigue usando `saveWithRevocation` sin cambios. |
| VII | Observabilidad | ⚠️ Parcial | Se loguea el resultado del seed con `Logger` de Nest (creado / ya existía / omitido / inválido). Sin correlation-ID ni métricas; ya diferido en 001 (ver Complexity Tracking). |
| VIII | Documentación de la API | ✅ | `MeResponseDto` gana `role` con `@ApiProperty`; Swagger se actualiza desde el DTO. No se agrega ningún endpoint nuevo. |
| IX | Testing | ✅ | Unit: `UserRole`, `User`, `ApiKey`, `AdminSeedService`, `AdminApiKeyGuard`, `ApiKeyGuard` (suite existente sin cambios de expectativas). Integración: seed idempotente y concurrente contra Postgres real; `ApiKeyService` copia el rol. E2E: alta → rol `user`; emisión → rol copiado. |
| X | Definición de terminado | ✅ | Tests verdes, backend compila y arranca, Swagger refleja `role`. Postman: `GET /auth/me` cambia su respuesta; se actualiza el ejemplo de la colección. |
| XI | Idioma | ✅ | Identificadores en inglés (`UserRole`, `AdminSeedService`); mensajes y logs en español. |
| XII | Spec-first | ✅ | Deriva de `spec.md`; los riesgos aceptados y decisiones de diseño ya están en la spec. |

**Technology Stack & Constraints**: sin dependencias nuevas. No requiere enmienda a la constitución.

**Resultado del gate**: PASA. Un punto de despliegue (R1) queda explícito como riesgo de operación, no como violación constitucional.

## Project Structure

### Documentation (this feature)

```text
specs/008-admin-role-api-key/
├── plan.md              # Este archivo
├── spec.md              # Especificación (existe)
├── research.md          # Phase 0 — decisiones técnicas
├── data-model.md        # Phase 1 — User, ApiKey, UserRole
├── quickstart.md        # Phase 1 — validación end-to-end y paso de despliegue
├── contracts/
│   └── auth-api-delta.md  # Delta del contrato REST (GET /auth/me) y contrato de arranque (env)
├── checklists/
│   └── requirements.md  # (existe)
└── tasks.md             # Phase 2 — /speckit-tasks, NO lo crea /speckit-plan
```

### Source Code (repository root)

```text
backend/
├── .env.example                                  # MODIFICADO — placeholders ADMIN_EMAIL y ADMIN_PASSWORD
└── src/
    ├── main.ts                                   # MODIFICADO — orden: NestFactory.create → runPlayerCatalogMigrations (incluye la de role) → AdminSeedService.run() → listen()
    ├── database/migrations/
    │   └── 1790985600000-AddRoleToUsersAndApiKeys.ts  # NUEVO — ADD COLUMN IF NOT EXISTS role en users y api_keys; down() las elimina
    ├── domain/
    │   ├── auth/
    │   │   ├── user.ts                           # MODIFICADO — campo role; register(..., role = UserRole.USER)
    │   │   ├── user-role.ts                      # NUEVO — enum UserRole + parseUserRole()
    │   │   ├── user.spec.ts                      # MODIFICADO — casos de rol por default y rol inválido
    │   │   ├── user-role.spec.ts                 # NUEVO
    │   │   └── errors/invalid-role.error.ts      # NUEVO
    │   └── api-key/
    │       ├── api-key.ts                        # MODIFICADO — campo role (rol copiado); issue(..., role), restore(..., role)
    │       └── api-key.spec.ts                   # MODIFICADO — fixtures con rol
    ├── repositories/
    │   ├── auth/
    │   │   ├── entities/user.entity.ts           # MODIFICADO — columna role varchar(16) NOT NULL DEFAULT 'user'
    │   │   └── mappers/user.mapper.ts            # MODIFICADO — role en toDomain/toEntity
    │   └── api-key/
    │       ├── entities/api-key.entity.ts        # MODIFICADO — columna role varchar(16) NOT NULL DEFAULT 'user'
    │       └── mappers/api-key.mapper.ts         # MODIFICADO — role en toDomain/toEntity
    ├── services/
    │   ├── auth/
    │   │   ├── auth.service.ts                   # SIN CAMBIOS de firma; register sigue creando con rol user
    │   │   └── admin-seed.service.ts             # NUEVO — run(): seed idempotente del primer admin
    │   └── api-key/
    │       └── api-key.service.ts                # MODIFICADO — issueApiKey(user: User) copia user.role dentro del método existente
    ├── controllers/
    │   ├── api-key/api-key.controller.ts         # MODIFICADO — obtiene User vía AuthService.getById y lo pasa a issueApiKey
    │   └── auth/dto/me-response.dto.ts           # MODIFICADO — role
    ├── guards/
    │   └── api-key/
    │       ├── api-key.guard.ts                  # MODIFICADO (comportamiento idéntico) — extrae resolveActiveApiKey(context) protegido
    │       ├── api-key.guard.spec.ts             # MODIFICADO — solo fixtures con rol; expectativas intactas
    │       ├── admin-api-key.guard.ts            # NUEVO — extiende ApiKeyGuard, agrega verificación role === admin (403)
    │       └── admin-api-key.guard.spec.ts       # NUEVO
    ├── modules/
    │   └── auth/auth.module.ts                   # MODIFICADO — provee AdminSeedService (main.ts lo resuelve con app.get, strict: false)
    └── shared/errors/messages.ts                 # MODIFICADO — FORBIDDEN_ROLE_MESSAGE

backend/src/services/auth/
└── admin-seed.service.integration.spec.ts        # NUEVO — arranque x2, arranque concurrente, contraseña no reseteada (Postgres efímero)

backend/test/
└── role.e2e-spec.ts                              # NUEVO — register → user; issue ApiKey → rol copiado; rol no retroactivo
```

**Structure Decision**: Todo en `backend/`. Los cambios se ubican en las capas existentes (domain, repositories, services, controllers, guards) siguiendo la convención actual del módulo `auth` y `api-key`. No se crea un módulo nuevo: el seed vive en `AuthModule` porque depende de `USER_REPOSITORY` y `PASSWORD_HASHER`, y el guard vive junto al `ApiKeyGuard`.

## Decisiones técnicas (resumen; detalle en research.md)

1. **Migration formal para `role`**: una migration de TypeORM en `src/database/migrations/` ejecuta `ALTER TABLE users ADD COLUMN IF NOT EXISTS role ...` y lo mismo para `api_keys`, con `NOT NULL DEFAULT 'user'`. El runner existente la aplica en el arranque del deploy, sin paso manual. Es idempotente frente a dev, donde `synchronize` ya creó la columna. Las entidades declaran la columna con el mismo default para que `synchronize` no genere diferencias. El `ALTER` manual de producción desaparece del plan.
2. **Rol copiado dentro del método existente**: `ApiKeyService.issueApiKey` recibe el `User` y copia `user.role` en el mismo flujo que ya emite y revoca. No hay flujo paralelo.
3. **Seed en un service, no en `main.ts`**: `main.ts` solo invoca `AdminSeedService.run()` antes de `listen()`. La lógica vive en un Service para respetar la constitución I (el seed usa repositorio y hasher; ponerlo en `main.ts` lo sacaría de la capa de servicio).
4. **Concurrencia sin lock**: se apoyan en el índice único de `users.email` y en el mapeo existente de `23505` a `EmailAlreadyInUseError` dentro de `TypeOrmUserRepository.save`. El seed captura ese error y lo trata como "ya existe".
5. **Guard de admin reutilizando la resolución**: se extrae `resolveActiveApiKey` en `ApiKeyGuard` (cambio mecánico, comportamiento idéntico). `AdminApiKeyGuard` extiende la clase y agrega la verificación de rol.

## Complexity Tracking

| Violación | Por qué es necesaria | Alternativa más simple, y por qué se rechaza |
|-----------|----------------------|----------------------------------------------|
| Principio VII parcial (sin correlation-ID ni métricas) | Igual que 001: la feature es correcta sin ese stack. | Stack de observabilidad ahora: fuera de alcance, ya diferido. |
| Migration de TypeORM con SQL crudo (`ADD COLUMN IF NOT EXISTS`) en lugar de depender de `synchronize` | Producción tiene `synchronize` apagado; sin migration, el deploy requeriría un paso manual olvidable. | Paso manual en el deploy: se rechaza porque depende de memoria humana en cada release. Migration por `synchronize` en producción: no existe, está apagado por diseño. |
| `ApiKeyGuard` se toca (extracción de método) | Reutilizar la resolución de clave sin duplicarla requiere exponerla. Extender sin tocar la clase no permite recuperar el `ApiKey` resuelto (el guard base devuelve `true`). | Duplicar la lógica en `AdminApiKeyGuard`: se rechaza porque dos caminos de resolución de ApiKey pueden divergir en seguridad. |
