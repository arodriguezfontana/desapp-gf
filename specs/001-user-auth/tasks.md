---
description: "Task list — Autenticación de usuarios (alta, login y protección de endpoints con JWT)"
---

# Tasks: Autenticación de usuarios (alta, login y protección de endpoints con JWT)

> **Estado: IMPLEMENTADO (2026-09-09).** Las 67 tareas están completas. `pnpm lint`,
> `pnpm test` (59 tests unit + integración), `pnpm test:e2e` (15 tests, 3 suites) y
> `pnpm build` pasan en verde contra el Postgres local.
>
> **Ajustes respecto del plan durante la implementación:**
> - `@nestjs/config` / `@nestjs/jwt` / `@nestjs/typeorm` v12 son ESM-only e incompatibles
>   con Jest (ts-jest CJS) sobre Node 20 → se fijaron en `^4.0.4` / `^11.0.2` / `^11.0.3`
>   (línea CJS, compatible con NestJS 11). TypeORM quedó en `^1.1.1`.
> - Tests de integración nombrados `*.integration.spec.ts` (con punto) para que los tome
>   `pnpm test` sin colisionar con el patrón e2e.
> - `pnpm test` / `test:cov` / `test:e2e` corren con `--runInBand`: comparten la base
>   `desapp` y el `beforeEach` la limpia, así que deben ser secuenciales.
> - Se eliminó `backend/app.controller.spec.ts` (duplicado mal ubicado del scaffold que
>   rompía el typecheck estricto).
> - Endpoint protegido de referencia: `GET /auth/me` (además de `@Public()` en `/` y `/health`).
> - `docker-compose.yml`: servicio Postgres que interpola `${POSTGRES_*}` desde `.env`
>   (sin credenciales literales).

**Input**: Design documents from `specs/001-user-auth/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: INCLUIDOS. La constitución (Principio IX) exige tests unitarios de dominio (sin Nest/DB), de integración de Service/Repository contra Postgres real, y e2e con supertest en carpeta propia. Los tests de una historia se escriben antes de su implementación y deben fallar primero.

**Organization**: Tareas agrupadas por historia de usuario. Las tres historias son P1; se entregan en orden (US1 → US2 → US3) porque US2 reutiliza la persistencia de US1 y US3 consume el token de US2, pero cada una es testeable de forma independiente en su checkpoint.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: US1 (Alta), US2 (Login), US3 (Protección de endpoints)
- Rutas relativas a la raíz del repo. El módulo vive en `backend/src/modules/auth/`.

## Path Conventions

Monorepo web. Backend NestJS en `backend/`. Código de la feature bajo `backend/src/modules/auth/` + infraestructura compartida en `backend/src/{config,database,shared}/` + e2e en `backend/src/tests/auth/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dejar el proyecto listo para configurar TypeORM y construir auth. NADA de auth todavía.

- [x] T001 Instalar dependencias en `backend/`: `pnpm add @nestjs/config @nestjs/typeorm typeorm pg @nestjs/jwt bcrypt class-validator class-transformer` y `pnpm add -D @types/bcrypt`; verificar que quedan en `backend/package.json` y `backend/pnpm-lock.yaml`.
- [x] T002 [P] Activar modo estricto en `backend/tsconfig.json`: `"strict": true`, quitar `"noImplicitAny": false` y `"strictBindCallApply": false`; corregir los errores de compilación resultantes en `backend/src/app.controller.ts`, `backend/src/app.service.ts`, `backend/src/main.ts`.
- [x] T003 [P] Agregar placeholders genéricos a `backend/.env.example`: `JWT_SECRET`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` (comentario recordando que deben coincidir con lo que codifica `DATABASE_URL`). Agregar los valores reales sólo a `backend/.env` (local, no versionado) y confirmar `git check-ignore backend/.env`.
- [x] T004 [P] Crear `backend/docker-compose.yml`: servicio `postgres:16`, `env_file: .env`, interpolación `${POSTGRES_USER}` / `${POSTGRES_PASSWORD}` / `${POSTGRES_DB}`, puerto `${POSTGRES_PORT:-5432}:5432`, volumen nombrado `pgdata`. Sin credenciales literales.
- [x] T005 [P] Configurar Jest e2e: crear `backend/test/jest-e2e.json` (o bloque equivalente en `backend/package.json`) con `rootDir` cubriendo `src/tests/`, `testRegex` `.e2e-spec.ts$`; agregar script `"test:e2e"` en `backend/package.json`; crear carpeta `backend/src/tests/auth/.gitkeep`.
- [x] T006 [P] Ampliar `.github/workflows/ci.yml` (job `backend`): agregar `services.postgres` (imagen `postgres:16`, healthcheck, env desde secrets/valores de CI), exportar `DATABASE_URL` de CI, y agregar pasos `pnpm test` (ya existe) + `pnpm test:e2e`. Mantener lint y build.
- [x] T007 [P] Ajustar disparadores de CI en `.github/workflows/ci.yml` para que también corra en `pull_request` hacia `main` desde ramas `feat/**` (hoy sólo `main`/`dev`).

**Checkpoint**: `pnpm install`, `pnpm lint` y `pnpm build` pasan en `backend/` con TypeScript estricto.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: ConfigModule + TypeORM apuntando a la base existente, filtro de errores global único, y andamiaje del módulo auth. **Bloquea todas las historias.**

**⚠️ CRITICAL**: ninguna historia puede empezar hasta cerrar esta fase.

- [x] T008 Importar `ConfigModule.forRoot({ isGlobal: true })` en `backend/src/app.module.ts` (carga `backend/.env`, que hoy nadie lee).
- [x] T009 Crear `backend/src/database/database.module.ts` con `TypeOrmModule.forRootAsync` que inyecta `ConfigService` y pasa `url: config.getOrThrow('DATABASE_URL')` al driver `postgres`, `autoLoadEntities: true`, `synchronize: config.get('NODE_ENV') !== 'production'`. Importar `DatabaseModule` en `backend/src/app.module.ts`. No reproducir valores de conexión.
- [x] T010 [P] Crear clase base `DomainError` (extiende `Error`, no `HttpException`) en `backend/src/shared/errors/domain-error.ts`.
- [x] T011 Crear `backend/src/shared/filters/all-exceptions.filter.ts`: cuerpo uniforme `{ statusCode, error, message, timestamp, path }`, tabla de mapeo de [contracts/error-response.md](./contracts/error-response.md) (400/401/409, 500 genérico sin stack), y **sin loguear el body de la request**. Registrar una sola vez vía `APP_FILTER` en `backend/src/app.module.ts`.
- [x] T012 [P] Unit test del filtro en `backend/src/shared/filters/all-exceptions.filter.spec.ts`: verifica formato, mapeo por tipo de error, y que un 500 no expone `stack` ni mensaje interno.
- [x] T013 [P] Crear `backend/src/modules/auth/auth.constants.ts`: `JWT_EXPIRES_IN = '24h'`, `JWT_EXPIRES_IN_SECONDS = 86400` (no son secretos).
- [x] T014 [P] Crear decorador `@Public()` en `backend/src/modules/auth/guards/public.decorator.ts` (`SetMetadata('isPublic', true)`) — se usa desde US1 aunque el guard global recién se active en US3.
- [x] T015 Crear `backend/src/modules/auth/auth.module.ts` (esqueleto: importa `ConfigModule`, `TypeOrmModule.forFeature([...])` vacío por ahora; sin providers), e importarlo en `backend/src/app.module.ts`.
- [x] T016 [P] Crear tipo compartido `AuthenticatedRequest` (`request.user: { userId: string }`) en `backend/src/modules/auth/guards/authenticated-request.ts` para tipar el `request` en guard y controllers protegidos.

**Checkpoint**: el backend levanta con `pnpm dev`, TypeORM conecta a la base existente y crea la tabla vacía al primer arranque; un error lanzado a propósito devuelve el JSON uniforme del filtro.

---

## Phase 3: User Story 1 — Alta de cuenta (Priority: P1) 🎯 MVP

**Goal**: crear una cuenta a partir de email + contraseña, rechazar email duplicado (409) y contraseña que incumple la política (400), sin devolver token ni iniciar sesión, con la contraseña guardada hasheada.

**Independent Test**: `POST /auth/register` con datos válidos → 201 con `{id,email,createdAt}` y **sin** `accessToken`; repetir el mismo email (incluso otra capitalización) → 409; contraseña `"password"` → 400; en la tabla `users`, `password_hash` es un hash bcrypt. (quickstart.md escenarios 1–3)

### Tests for User Story 1 ⚠️ (escribir primero, deben fallar)

- [x] T017 [P] [US1] Unit tests del value object `Email` en `backend/src/modules/auth/domain/email.spec.ts`: normaliza trim + lowercase; `"  Ana@Mail.com "` == `"ana@mail.com"`; `"anamail.com"`, `"ana@"`, `"ana @mail.com"` → `InvalidEmailError`.
- [x] T018 [P] [US1] Unit tests del value object `Password` en `backend/src/modules/auth/domain/password.spec.ts`: 7 falla / 8 ok / 16 ok / 17 falla; falta mayúscula, minúscula, dígito o especial (cada una por separado) → `InvalidPasswordError`; `"Password 1"` ok (espacio = especial).
- [x] T019 [P] [US1] Unit tests de la clase de dominio `User` en `backend/src/modules/auth/domain/user.spec.ts`: `User.register` fija `id`/`email`/`passwordHash`/`createdAt`, getters de sólo lectura, no expone la contraseña en claro.
- [x] T020 [P] [US1] Integration test de `AuthService.register` + `TypeOrmUserRepository` contra Postgres real en `backend/src/modules/auth/service/auth.service.register.integration-spec.ts`: alta feliz persiste; email duplicado → `EmailAlreadyInUseError`; alta concurrente del mismo email → sólo una gana.
- [x] T021 [P] [US1] e2e test en `backend/src/tests/auth/register.e2e-spec.ts`: 201 sin `accessToken`; 409 en duplicado (`Ana@Mail.com` tras `ana@mail.com`); 400 con contraseña inválida; 400 con campo extra en el body; funciona sin header `Authorization`.

### Implementation for User Story 1

- [x] T022 [P] [US1] `Email` value object en `backend/src/modules/auth/domain/email.ts`: factory `Email.create(raw)`, normalización trim+lowercase, invariante de formato, `equals`, `toString`.
- [x] T023 [P] [US1] `Password` value object en `backend/src/modules/auth/domain/password.ts`: factory `Password.create(plain)`, reglas 8–16 + mayúscula + minúscula + dígito + especial (`[^A-Za-z0-9]`), `value()`.
- [x] T024 [P] [US1] Errores de dominio en `backend/src/modules/auth/domain/errors/`: `invalid-email.error.ts`, `invalid-password.error.ts`, `email-already-in-use.error.ts` (todos extienden `DomainError`), con mensajes en español de [data-model.md](./data-model.md).
- [x] T025 [US1] Clase de dominio `User` en `backend/src/modules/auth/domain/user.ts`: factory `User.register(id, email: Email, passwordHash, createdAt)`, getters inmutables, sin decoradores TypeORM (depende de T022).
- [x] T026 [US1] Mapear los errores de dominio nuevos en `backend/src/shared/filters/all-exceptions.filter.ts`: `InvalidEmailError`/`InvalidPasswordError` → 400, `EmailAlreadyInUseError` → 409 (depende de T024; actualiza T011).
- [x] T027 [P] [US1] `UserEntity` TypeORM en `backend/src/modules/auth/repository/entities/user.entity.ts`: `@Entity('users')`, `id uuid` PK, `email varchar(320)` UNIQUE NOT NULL, `password_hash varchar(60)` NOT NULL, `created_at timestamptz` default now.
- [x] T028 [US1] `UserMapper` en `backend/src/modules/auth/repository/mappers/user.mapper.ts`: `toDomain(entity): User` / `toEntity(user): UserEntity`, sin lógica de negocio (depende de T025, T027).
- [x] T029 [US1] Puerto `UserRepository` + token `USER_REPOSITORY` en `backend/src/modules/auth/repository/user.repository.ts`: `findByEmail(email: Email)`, `existsByEmail(email: Email)`, `save(user: User)`, `findById(id: string)` — todos en términos de dominio.
- [x] T030 [US1] `TypeOrmUserRepository` en `backend/src/modules/auth/repository/typeorm-user.repository.ts`: implementa el puerto; `save` captura la violación de índice único de Postgres y la traduce a `EmailAlreadyInUseError` (respalda FR-008) (depende de T028, T029).
- [x] T031 [P] [US1] Puerto `PasswordHasher` + token en `backend/src/modules/auth/adapters/password-hasher.ts`: `hash(plain): Promise<string>`, `compare(plain, hash): Promise<boolean>`.
- [x] T032 [US1] `BcryptPasswordHasher` en `backend/src/modules/auth/adapters/bcrypt-password-hasher.ts`: cost factor 10 (depende de T031).
- [x] T033 [P] [US1] `RegisterRequestDto` en `backend/src/modules/auth/controller/dto/register-request.dto.ts`: `@IsEmail`, `@IsString`, `@IsNotEmpty`, `@MaxLength(72)` (guarda anti-DoS, no regla de negocio), decoradores `@ApiProperty`.
- [x] T034 [P] [US1] `RegisterResponseDto` en `backend/src/modules/auth/controller/dto/register-response.dto.ts`: `id`, `email`, `createdAt`; `@ApiProperty`; sin `password`/`passwordHash`/`accessToken`.
- [x] T035 [US1] `AuthService.register` en `backend/src/modules/auth/service/auth.service.ts`: `Email.create` → `Password.create` → `existsByEmail` (409) → `hasher.hash` → `User.register` → `repository.save`; devuelve el `User` de dominio (depende de T030, T032, T025, T023).
- [x] T036 [US1] `AuthController` + `POST /auth/register` en `backend/src/modules/auth/controller/auth.controller.ts`: `@Public()`, convierte el DTO a primitivos/dominio, llama al Service, mapea `User` → `RegisterResponseDto`, `201`; `@ApiTags('auth')`, `@ApiResponse` 201/400/409 (depende de T035, T014, T034).
- [x] T037 [US1] Cablear `backend/src/modules/auth/auth.module.ts`: `TypeOrmModule.forFeature([UserEntity])`, provider `{ provide: USER_REPOSITORY, useClass: TypeOrmUserRepository }`, `{ provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher }`, `UserMapper`, `AuthService`, `AuthController` (depende de T036).
- [x] T038 [US1] Verificar que T017–T021 pasan; ajustar hasta verde. Correr `pnpm test` y `pnpm test:e2e`.

**Checkpoint**: US1 completa y demostrable de forma independiente (quickstart.md 1–3). El alta funciona; login y guard todavía no existen.

---

## Phase 4: User Story 2 — Inicio de sesión y obtención del JWT (Priority: P1)

**Goal**: `POST /auth/login` valida credenciales; si son correctas devuelve un JWT (payload `{sub}`) que expira a las 24 h; si el email no existe o la contraseña no coincide, respuesta **idéntica** (401, mismo cuerpo) y sin canal lateral de timing.

**Independent Test**: crear cuenta (US1) → login correcto → 200 con `accessToken`/`tokenType`/`expiresIn: 86400`, `exp - iat == 86400`, payload sólo `sub`/`iat`/`exp`; login con email inexistente y login con contraseña incorrecta → respuestas byte a byte iguales (401). (quickstart.md 4–5)

### Tests for User Story 2 ⚠️ (escribir primero, deben fallar)

- [x] T039 [P] [US2] Unit tests de `JwtTokenIssuer` en `backend/src/modules/auth/adapters/jwt-token-issuer.spec.ts`: `issue(userId)` produce un JWT con `sub` y `exp = iat + 86400`; `verify` acepta el token recién emitido y rechaza uno manipulado o vencido.
- [x] T040 [P] [US2] Integration test de `AuthService.login` contra Postgres real en `backend/src/modules/auth/service/auth.service.login.integration-spec.ts`: credenciales correctas → token; email inexistente y password incorrecta → mismo `InvalidCredentialsError`.
- [x] T041 [P] [US2] e2e test en `backend/src/tests/auth/login.e2e-spec.ts`: 200 con la forma de `LoginResponse`; comparar cuerpo y status de "email inexistente" vs "password incorrecta" y afirmar igualdad exacta; 400 si falta un campo; funciona sin `Authorization`.

### Implementation for User Story 2

- [x] T042 [P] [US2] Error de dominio `InvalidCredentialsError` en `backend/src/modules/auth/domain/errors/invalid-credentials.error.ts` (extiende `DomainError`, mensaje `"Credenciales inválidas."`).
- [x] T043 [US2] Mapear `InvalidCredentialsError` → 401 (`error: "Unauthorized"`, `message: "Credenciales inválidas."`) en `backend/src/shared/filters/all-exceptions.filter.ts` (actualiza T011/T026).
- [x] T044 [P] [US2] Puerto `TokenIssuer` + token en `backend/src/modules/auth/adapters/token-issuer.ts`: `issue(userId: string): string`, `verify(token: string): { userId: string }` (lanza si inválido/vencido).
- [x] T045 [US2] `JwtTokenIssuer` en `backend/src/modules/auth/adapters/jwt-token-issuer.ts`: envuelve `JwtService`, payload `{ sub: userId }`, usa `JWT_EXPIRES_IN` (depende de T044, T013).
- [x] T046 [US2] Configurar `JwtModule.registerAsync` en `backend/src/modules/auth/auth.module.ts`: `secret: config.getOrThrow('JWT_SECRET')`, `signOptions: { expiresIn: JWT_EXPIRES_IN }`; registrar provider `{ provide: TOKEN_ISSUER, useClass: JwtTokenIssuer }` (depende de T045).
- [x] T047 [P] [US2] Constante `DUMMY_PASSWORD_HASH` (hash bcrypt precomputado fijo) en `backend/src/modules/auth/service/dummy-password-hash.ts` para la defensa de timing cuando el email no existe.
- [x] T048 [P] [US2] `LoginRequestDto` (`@IsEmail`, `@IsString`, `@IsNotEmpty`) y `LoginResponseDto` (`accessToken`, `tokenType: 'Bearer'`, `expiresIn: number`, `@ApiProperty`) en `backend/src/modules/auth/controller/dto/login-request.dto.ts` y `.../login-response.dto.ts`.
- [x] T049 [US2] `AuthService.login` en `backend/src/modules/auth/service/auth.service.ts`: `Email.create` → `findByEmail`; si `null`, ejecutar `hasher.compare(plain, DUMMY_PASSWORD_HASH)` y lanzar `InvalidCredentialsError`; si existe y `compare` es `false`, mismo error; si ok, `tokenIssuer.issue(user.id)` (depende de T030, T032, T045, T042, T047).
- [x] T050 [US2] `POST /auth/login` en `backend/src/modules/auth/controller/auth.controller.ts`: `@Public()`, `@HttpCode(200)`, devuelve `LoginResponseDto` con `expiresIn: JWT_EXPIRES_IN_SECONDS`; `@ApiResponse` 200/400/401 (ejemplo de 401 de [contracts/openapi-auth.yaml](./contracts/openapi-auth.yaml)) (depende de T049, T048). Verificar T039–T041 en verde.

**Checkpoint**: US1 + US2 funcionan de forma independiente. Hay tokens; todavía no hay endpoint protegido.

---

## Phase 5: User Story 3 — Acceso a endpoints protegidos con el JWT (Priority: P1)

**Goal**: guard global exige `Authorization: Bearer <jwt>` válido y vigente en todo endpoint no marcado `@Public()`; sin token / inválido / vencido / usuario inexistente → 401 sin ejecutar la operación; con token válido, la operación se atribuye al usuario del `sub`.

**Independent Test**: con `GET /auth/me` como endpoint protegido de referencia: token válido → 200 con la identidad del dueño; sin header / `Bearer xxx` / JWT vencido → 401; token válido de un usuario borrado → 401; `POST /auth/register` y `POST /auth/login` siguen respondiendo sin `Authorization`. (quickstart.md 6–8)

### Tests for User Story 3 ⚠️ (escribir primero, deben fallar)

- [x] T051 [P] [US3] Unit tests de `JwtAuthGuard` en `backend/src/modules/auth/guards/jwt-auth.guard.spec.ts` (con `TokenIssuer` y `UserRepository` mockeados): deja pasar si `@Public()`; 401 sin header, con esquema distinto de `Bearer`, con `verify` que lanza; 401 si `findById` devuelve `null` (FR-019); setea `request.user` si todo ok.
- [x] T052 [P] [US3] e2e test en `backend/src/tests/auth/protected.e2e-spec.ts`: `GET /auth/me` → 401 sin token, con token malformado y con token vencido (firmar uno con `expiresIn: -1` o `exp` pasado); 200 con token válido devolviendo el `id`/`email` correctos; `GET /` y `GET /health` siguen 200 sin token.

### Implementation for User Story 3

- [x] T053 [US3] `JwtAuthGuard` (`CanActivate`) en `backend/src/modules/auth/guards/jwt-auth.guard.ts`: lee `Reflector` para `isPublic`; parsea `Authorization: Bearer`; `tokenIssuer.verify`; `userRepository.findById` (FR-019); en cualquier fallo `throw new UnauthorizedException()`; en éxito `request.user = { userId }` (depende de T044/T045, T029, T014, T016).
- [x] T054 [US3] Registrar el guard global vía `{ provide: APP_GUARD, useClass: JwtAuthGuard }` en `backend/src/app.module.ts` (o en `auth.module.ts`); asegurar que `TokenIssuer` y `UserRepository` son visibles para el guard (exports de `AuthModule`) (depende de T053).
- [x] T055 [US3] Marcar `@Public()` en `GET /` y `GET /health` de `backend/src/app.controller.ts` para que sigan exentos tras activar el guard global (depende de T014, T054).
- [x] T056 [P] [US3] Decorador de parámetro `@CurrentUser()` en `backend/src/modules/auth/guards/current-user.decorator.ts` que extrae `request.user.userId`.
- [x] T057 [US3] Endpoint protegido de referencia `GET /auth/me` en `backend/src/modules/auth/controller/auth.controller.ts`: `@ApiBearerAuth()`, usa `@CurrentUser()`, devuelve `{ id, email }` del usuario (nuevo `AuthService.getById` o reutiliza `findById`); `@ApiResponse` 200/401 (depende de T054, T056).
- [x] T058 [US3] Mapear `UnauthorizedException` del guard → 401 uniforme (`message: "No autenticado."`) en `backend/src/shared/filters/all-exceptions.filter.ts` si no quedó cubierto por el passthrough de `HttpException` (actualiza T011).
- [x] T059 [US3] Documentar en Swagger el esquema Bearer global: confirmar `@ApiBearerAuth()` en los endpoints protegidos y que `POST /auth/register` / `POST /auth/login` figuran sin candado en `http://localhost:3000/docs`.
- [x] T060 [US3] Verificar T051–T052 en verde; correr `pnpm test` y `pnpm test:e2e` completos.

**Checkpoint**: las tres historias funcionan de forma independiente. El guard protege todo lo que no sea `@Public()`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: cerrar la "Definición de terminado" (Principio X) y limpiar.

- [x] T061 [P] Crear/actualizar `docs/postman/desapp.postman_collection.json`: requests `POST /auth/register`, `POST /auth/login` (test-script que guarda `accessToken` en variable de entorno) y `GET /auth/me` con `Authorization: Bearer {{accessToken}}`.
- [x] T062 [P] Actualizar `README.md` y/o `backend/README.md`: cómo setear `JWT_SECRET`, cómo levantar Postgres (nativo u `docker compose up -d`), y el flujo alta → login → endpoint protegido.
- [x] T063 [P] Unit test adicional de `AuthService` con dependencias mockeadas en `backend/src/modules/auth/service/auth.service.spec.ts` (rutas de error de register y login sin tocar la DB).
- [x] T064 Revisar que ninguna capa loguea contraseña, hash ni JWT: `AllExceptionsFilter`, interceptores, `AuthService`, repositorio (Principio IV).
- [x] T065 [P] Ejecutar `specs/001-user-auth/quickstart.md` de punta a punta contra el backend corriendo y marcar su checklist.
- [x] T066 Correr `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:e2e` en `backend/` — todo verde — y `pnpm test:cov` para confirmar cobertura de dominio para SonarCloud.
- [x] T067 [P] Verificar que `backend/docker-compose.yml` no contiene credenciales literales y que `backend/.env` sigue git-ignored (`git check-ignore`).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. **Bloquea US1/US2/US3.**
- **US1 (Phase 3)**: depende de Foundational.
- **US2 (Phase 4)**: depende de Foundational; reutiliza `TypeOrmUserRepository`, `BcryptPasswordHasher` y `User` de US1 (T030, T032, T025).
- **US3 (Phase 5)**: depende de Foundational; usa `TokenIssuer` de US2 (T044/T045) y `UserRepository.findById` de US1 (T029). Sus tests de "token vencido/válido" necesitan poder emitir tokens (US2).
- **Polish (Phase 6)**: depende de las historias que se quieran entregar.

### User Story Dependencies

- **US1 (Alta)**: independiente. Es el MVP.
- **US2 (Login)**: técnicamente se apoya en la persistencia de US1, pero es testeable de forma aislada (crear un usuario y loguearse). No modifica el comportamiento de US1.
- **US3 (Protección)**: se apoya en US2 para obtener tokens de prueba; no modifica US1 ni US2 salvo agregar `@Public()` a endpoints ya existentes y activar el guard global.

### Within Each User Story

- Tests primero (deben fallar) → value objects / entidades → mappers / repositorios → adapters → service → controller → wiring del módulo → tests en verde.
- `AllExceptionsFilter` se amplía incrementalmente (T026, T043, T058) a medida que aparecen errores de dominio nuevos.

### Parallel Opportunities

- **Phase 1**: T002–T007 en paralelo tras T001.
- **Phase 2**: T010, T012, T013, T014, T016 en paralelo; T011 tras T010; T009 tras T008; T015 tras T009+T011.
- **US1**: tests T017–T021 en paralelo; luego T022, T023, T024, T027, T031, T033, T034 en paralelo; T025→T028→T030 en cadena; T035 tras (T030,T032,T025,T023); T036 tras T035; T037 tras T036.
- **US2**: T039–T041 en paralelo; T042, T044, T047, T048 en paralelo; T045→T046; T049 tras (T045,T042,T047,T030,T032); T050 tras T049.
- **US3**: T051–T052 en paralelo; T053→T054→T055; T056 en paralelo con T053; T057 tras T054+T056.
- **Phase 6**: T061, T062, T063, T065, T067 en paralelo.

---

## Parallel Example: User Story 1

```bash
# Tests de US1 juntos (deben fallar):
Task: "Unit tests Email en backend/src/modules/auth/domain/email.spec.ts"
Task: "Unit tests Password en backend/src/modules/auth/domain/password.spec.ts"
Task: "Unit tests User en backend/src/modules/auth/domain/user.spec.ts"
Task: "Integration test AuthService.register en backend/src/modules/auth/service/auth.service.register.integration-spec.ts"
Task: "e2e register en backend/src/tests/auth/register.e2e-spec.ts"

# Piezas independientes de US1 juntas:
Task: "Email VO en backend/src/modules/auth/domain/email.ts"
Task: "Password VO en backend/src/modules/auth/domain/password.ts"
Task: "Errores de dominio en backend/src/modules/auth/domain/errors/"
Task: "UserEntity en backend/src/modules/auth/repository/entities/user.entity.ts"
Task: "PasswordHasher port en backend/src/modules/auth/adapters/password-hasher.ts"
Task: "RegisterRequestDto / RegisterResponseDto en backend/src/modules/auth/controller/dto/"
```

---

## Implementation Strategy

### MVP First (sólo US1)

1. Phase 1 (Setup) → 2. Phase 2 (Foundational) → 3. Phase 3 (US1) → **STOP y validar** con quickstart.md 1–3 → demo del alta.

### Incremental Delivery

1. Setup + Foundational → base lista (TypeORM + filtro global).
2. US1 → alta funcionando → demo (MVP).
3. US2 → login + JWT → demo.
4. US3 → guard global + `/auth/me` → demo del sistema protegido.
5. Phase 6 → Postman, README, quickstart, CI verde.

### Parallel Team Strategy

Tras Foundational, un dev puede tomar US1 mientras otro adelanta el esqueleto de tests de US2/US3; la integración real de US2 y US3 arranca en cuanto `TypeOrmUserRepository` (T030) y `BcryptPasswordHasher` (T032) están listos.

---

## Notes

- `[P]` = archivo distinto, sin dependencias pendientes.
- El `AllExceptionsFilter` es único y global; se amplía, no se duplica.
- Los tests de dominio (T017–T019) corren sin Nest ni base (Principio IX).
- Los tests de integración (T020, T040) corren contra Postgres real — local y como servicio en CI.
- No modificar ni borrar tests existentes para hacerlos pasar sin permiso explícito (Principio IX).
- Commit por tarea o grupo lógico; identificadores en inglés, mensajes de error y docs en español (Principio XI).
- No reproducir en código ni en docs los valores reales de `DATABASE_URL`; viven sólo en `backend/.env`.
