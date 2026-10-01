# Phase 0 — Research: Autenticación de usuarios

Todas las decisiones abajo resuelven los "NEEDS CLARIFICATION" implícitos del Technical Context. Ninguna queda abierta.

---

## 1. Configuración de TypeORM leyendo `DATABASE_URL`

**Decisión**: `TypeOrmModule.forRootAsync` con `useFactory` que inyecta `ConfigService` y pasa `url: config.getOrThrow('DATABASE_URL')` al driver `postgres`. `autoLoadEntities: true`. `synchronize: config.get('NODE_ENV') !== 'production'`. Agregar `@nestjs/config` con `ConfigModule.forRoot({ isGlobal: true })` porque hoy **nada carga el `.env`** (el `process.env.PORT` de `main.ts` funciona sólo por el fallback `?? 3000`).

**Rationale**:
- El plan no debe reproducir los valores de conexión; `url` los toma todos de la variable existente.
- El sufijo `?schema=public` de la URL (heredado del formato Prisma) es ignorado por el driver `pg` y no rompe; el `schema` de TypeORM ya default-ea a `public`.
- `getOrThrow` hace que el arranque falle rápido y claro si falta la variable, en vez de conectar a una URL `undefined`.
- `autoLoadEntities` evita mantener a mano un array de entidades por módulo.

**Alternativas consideradas**:
- Descomponer `DATABASE_URL` en `host/port/username/password/database` dentro del factory: descartado, reintroduce el parsing manual y da lugar a drift.
- `TypeOrmModule.forRoot` con un `ormconfig`/DataSource estático: descartado, no puede leer `ConfigService` y obliga a `dotenv` suelto.
- Usar `dotenv` directo sin `@nestjs/config`: descartado, `@nestjs/config` es el idiom Nest y da `ConfigService` inyectable y tipable.

---

## 2. `synchronize` vs migraciones versionadas

**Decisión**: `synchronize: true` **sólo** cuando `NODE_ENV !== 'production'` (local + CI). Migraciones formales de TypeORM quedan como follow-up documentado (deuda aceptada en plan.md → Complexity Tracking).

**Rationale**: una sola tabla (`users`) en esta feature; el costo de montar infra de migraciones (DataSource CLI, scripts, carpeta `migrations/`, orden en CI) no se justifica todavía. En CI los tests de integración/e2e levantan el esquema por `synchronize` contra el Postgres de servicio.

**Alternativas consideradas**:
- Migración inicial `CreateUsersTable`: se posterga hasta tener una segunda entidad o un deploy real; en ese momento se congela el esquema y se apaga `synchronize`.
- `synchronize: true` siempre: descartado, es peligroso si algún día `NODE_ENV=production` apunta a datos reales.

---

## 3. Hasheo de contraseña: bcrypt

**Decisión**: `bcrypt` (paquete `bcrypt`, binding nativo) con **cost factor 10**. Envuelto en el puerto de dominio `PasswordHasher` (`hash(plain): Promise<string>` / `compare(plain, hash): Promise<boolean>`), implementación `BcryptPasswordHasher` en la capa de Adapters.

**Rationale**:
- Pedido explícito del usuario y permitido por el Principio IV.
- Cost 10 ≈ 50–100 ms por hash: suficiente contra fuerza bruta offline sin volver lento el login para el volumen de cátedra.
- El puerto mantiene al Service y al Dominio ignorantes de bcrypt (Principio I): los tests de dominio no dependen de la librería nativa.
- `compare` de bcrypt es constante en tiempo respecto del hash, lo que ayuda a la respuesta uniforme del login (ver punto 6).

**Alternativas consideradas**:
- `argon2`: igualmente válido por la constitución; se elige bcrypt por pedido del usuario y por binding más simple en Windows/CI.
- `bcryptjs` (JS puro): descartado, ~3× más lento y sin ventaja real; el binding nativo compila bien en `ubuntu-latest`.

---

## 4. JWT: emisión, payload y verificación en el guard

**Decisión**:
- `@nestjs/jwt` (`JwtModule.registerAsync`) con `secret: config.getOrThrow('JWT_SECRET')` y `signOptions: { expiresIn: JWT_EXPIRES_IN }` donde `JWT_EXPIRES_IN = '24h'` es una **constante nombrada** en `auth.constants.ts` (no es secreto).
- Puerto de dominio `TokenIssuer` con `issue(userId): string` y `verify(token): { userId: string }` (lanza si inválido/vencido). Implementación `JwtTokenIssuer` envuelve `JwtService`.
- **Payload**: `{ sub: <userId> }`. `iat` y `exp` los agrega `@nestjs/jwt`. Nada más (ni email, ni roles) — FR-014 y Principio IV: no filtrar más de lo necesario.
- **Guard** `JwtAuthGuard` (`CanActivate` propio): lee `Authorization: Bearer <token>`; si falta el header, no tiene el esquema `Bearer`, o `verify` falla → `throw new UnauthorizedException()` (→ 401 por el filtro). Si verifica, setea `request.user = { userId: payload.sub }`.
- Registro **global** vía `APP_GUARD`. Decorador `@Public()` (`SetMetadata('isPublic', true)`) exime `POST /auth/register`, `POST /auth/login`, `GET /`, `GET /health`. El guard consulta el metadata con `Reflector` y deja pasar si `isPublic`.

**Rationale**:
- Guard propio sin Passport: pedido del usuario; para un solo esquema Bearer, Passport agrega dependencias y capas de estrategia que no aportan.
- `sub` como user id es la convención estándar de JWT; el resto del sistema obtiene "quién opera" desde `request.user.userId`.
- Verificación centralizada en un puerto: el guard no toca `jsonwebtoken` directo y es testeable.

**Alternativas consideradas**:
- `@nestjs/passport` + `passport-jwt`: descartado por pedido explícito y por sobre-ingeniería para un único esquema.
- Poltíticas de refresh token / logout server-side: fuera de alcance por la spec (RA-001, Assumptions).
- Guardar el email en el payload para ahorrar un `findById`: descartado, viola "no filtrar de más" y agranda el token; el costo de un lookup por request es aceptable (y varias operaciones igual necesitan el `User` completo).

---

## 5. Ubicación de la validación de la política de contraseña

**Decisión**: **dominio**. Value object `Password` con factory `Password.create(plain: string)` que valida:
- longitud 8–16 inclusive,
- ≥1 `[A-Z]`, ≥1 `[a-z]`, ≥1 `[0-9]`, ≥1 carácter que **no** sea `[A-Za-z0-9]` (definición de "especial" de la spec).
Si falla, lanza `InvalidPasswordError` (error de dominio) con mensaje en español → el filtro lo mapea a **400**. El DTO `RegisterRequestDto` sólo valida forma: `@IsString()`, `@IsNotEmpty()` (y `@MaxLength(72)` como guarda anti-DoS de bcrypt, no como regla de negocio).

**Rationale**: FR-003 es una regla de negocio de la spec; el Principio II manda que viva en el dominio y sea testeable sin Nest. Mantener la regla completa en class-validator la ataría al framework y la duplicaría si otro flujo (p. ej. cambio de contraseña futuro) la necesita.

**Alternativas consideradas**:
- Todo en `@Matches()` del DTO con un regex único: descartado (Principio II; además un solo regex da un mensaje de error pobre y difícil de testear por clase de carácter).
- Regla partida entre DTO (longitud) y dominio (composición): descartado, deja media regla en cada lado y complica el mensaje.

**Nota sobre "carácter especial"**: se documenta en `data-model.md` que incluye espacios interiores y cualquier símbolo Unicode no alfanumérico ASCII; coherente con Assumptions de la spec.

---

## 6. Respuesta idéntica para "email inexistente" y "contraseña incorrecta"

**Decisión**: `AuthService.login` lanza **el mismo** `InvalidCredentialsError` en los dos caminos:
1. `userRepository.findByEmail(email)` devuelve `null` → `InvalidCredentialsError`.
2. usuario encontrado pero `passwordHasher.compare(plain, user.passwordHash)` es `false` → `InvalidCredentialsError`.

El filtro lo mapea a **401** con cuerpo `{ statusCode: 401, error: "Unauthorized", message: "Credenciales inválidas" }` — idéntico byte a byte en ambos casos.

**Defensa contra timing**: si el usuario no existe, igualmente se ejecuta un `passwordHasher.compare` contra un **hash dummy fijo** precomputado, para que el tiempo de respuesta no delate la existencia del email.

**Rationale**: FR-012 y SC-004 exigen indistinguibilidad de código y cuerpo; el dummy-compare cubre además el canal lateral de latencia que la spec menciona como objetivo ("no revelar qué emails están registrados").

**Alternativas consideradas**:
- Devolver 404 cuando el email no existe: descartado, revela exactamente lo que la spec prohíbe.
- No hacer el dummy-compare: aceptable funcionalmente pero deja un side-channel de timing barato de explotar; el costo es un bcrypt-compare extra sólo en logins con email inexistente.

---

## 7. `docker-compose.yml` vs `DATABASE_URL`

**Decisión**: `backend/docker-compose.yml` **está versionado**, así que no puede contener credenciales reales. Se agregan a `backend/.env` (no versionado) tres variables discretas —`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`— con placeholders genéricos en `.env.example`, y el compose las consume por interpolación (`${POSTGRES_USER}`, etc.) con `env_file: .env`. Los valores concretos coinciden con los que ya codifica `DATABASE_URL`; un comentario en el compose y en `.env.example` recuerda mantener ambas cosas consistentes. Puerto host y volumen nombrado se parametrizan del mismo modo o con defaults no sensibles (`${POSTGRES_PORT:-5432}`, volumen `pgdata`).

**Rationale**: la restricción firme es "las credenciales reales sólo viven en `backend/.env`" (que está git-ignored). Un `docker-compose.yml` con `POSTGRES_PASSWORD=<valor>` filtraría el secreto igual que reproducirlo en la documentación. La interpolación desde `.env` mantiene el archivo versionado libre de secretos y sigue apuntando "a la misma base y credenciales que ya están en el .env".

**Caveat de puerto**: ya hay un Postgres nativo en el puerto estándar. Levantar el compose exige parar el servicio nativo o remapear el puerto host (`POSTGRES_PORT`). Se documenta en `quickstart.md`; el compose queda listo pero su uso es opcional mientras el Postgres nativo esté corriendo.

**Alternativas consideradas**:
- Hardcodear `POSTGRES_USER/PASSWORD/DB` en el `docker-compose.yml`: **descartado**, filtra las credenciales reales en un archivo versionado (el mismo problema que reproducirlas en la doc).
- Derivar las tres variables parseando `DATABASE_URL` con un script: descartado, sobre-ingeniería para un compose de cátedra; la duplicación controlada en `.env` con el comentario de enlace es suficiente.
- Componer `DATABASE_URL` a partir de las tres variables para tener una única fuente: viable a futuro; por ahora se mantienen ambas en `.env` con la nota de consistencia para no tocar el formato de URL que ya funciona.

---

## 8. `AllExceptionsFilter` global

**Decisión**: no existe hoy en `backend/src` → se crea `src/shared/filters/all-exceptions.filter.ts`, registrado una sola vez vía `APP_FILTER` en `AppModule`. Mapea:

| Origen | Status | `error` |
|--------|--------|---------|
| `EmailAlreadyInUseError` (dominio) | 409 | `Conflict` |
| `InvalidPasswordError` (dominio) | 400 | `Bad Request` |
| `InvalidCredentialsError` (dominio) | 401 | `Unauthorized` |
| `UnauthorizedException` (guard) | 401 | `Unauthorized` |
| `BadRequestException` (ValidationPipe) | 400 | `Bad Request` (conserva el array `message` de class-validator) |
| `HttpException` genérica | su status | su `error` |
| cualquier otra `Error` | 500 | `Internal Server Error` (mensaje genérico, **sin** stack ni detalle interno) |

Cuerpo uniforme: ver [contracts/error-response.md](./contracts/error-response.md). El filtro **no loguea** el body de la request (Principio IV: no filtrar contraseñas/JWT a logs); loguea sólo método, path, status y, para 5xx, el `error.stack` en el logger del servidor (nunca en la respuesta).

**Rationale**: Principio III exige filtro único y formato de error consistente sin fuga de internals.

**Alternativas consideradas**:
- Filtros por módulo: descartado, el Principio III pide **uno** global.
- Traducir errores de dominio a `HttpException` dentro del Service: descartado, ataría el Service a HTTP (Principio I: el Service no conoce HTTP).

---

## 9. `ValidationPipe` global

**Decisión**: `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))` en `main.ts` (o `APP_PIPE` en `AppModule`). Necesario para que los decoradores de `class-validator` de los DTOs se apliquen.

**Rationale**: `whitelist + forbidNonWhitelisted` implementa la "sanitización de input" del Principio III (descarta/rechaza campos no declarados, p. ej. un `role` inyectado en el body del alta).

---

## 10. TypeScript `strict`

**Decisión**: activar `"strict": true` en `backend/tsconfig.json` y quitar los overrides que lo relajan (`noImplicitAny: false`, `strictBindCallApply: false`). Ajustar el código existente (`app.*`) si el compilador se queja (es trivial).

**Rationale**: la sección Technology Stack de la constitución exige modo `strict`; el código nuevo de auth se escribe bajo esa premisa desde el inicio.
