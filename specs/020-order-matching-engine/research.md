# Research: Superusuario y motor de matching de órdenes

## D1: Dónde vive el campo `username` y la validación del valor reservado

**Decisión**: `username` se agrega como campo plano `string` en la entidad de dominio
`User` (`src/domain/auth/user.ts`), no como un value object propio con reglas de
formato — la spec es explícita: "esa es la única restricción sobre el campo" (409 para
`"superuser"` exacto). Sí se introduce un VO mínimo `Username` (`src/domain/auth/username.ts`)
con un único método `Username.create(raw)` que:
- Lanza `MissingUsernameError` (400, vía class-validator en el DTO, no en el VO —
  "requerido" es forma, Principio III) si está vacío — en la práctica esto ya lo cubre
  `@IsNotEmpty()` en `RegisterRequestDto`, así que el VO solo necesita preocuparse del
  valor reservado.
- Lanza `ReservedUsernameError` (409) si el valor normalizado (`trim()`, sin
  lowercasing — a diferencia de `Email`, la spec no pide case-insensitivity, así que solo
  el string exacto `"superuser"` está reservado) coincide con `"superuser"`.

**Rationale**: sigue el mismo patrón ya establecido por `Email.create()` /
`Password.create()` (VO con `static create()` que lanza un error de dominio propio),
consistente con Principio II/III. Se llama desde `AuthService.register()`, en el mismo
punto donde ya se validan `Email`/`Password`, antes de `User.register(...)`.

**Alternativas consideradas**:
- Chequeo inline en `AuthService.register` sin VO: descartado por romper la convención
  existente para validaciones de campo (`Email`, `Password` siempre tienen su VO).
- Constraint `CHECK` a nivel de base de datos: descartado porque el error 409 necesita
  distinguirse de otros conflictos (p. ej. email duplicado) con un mensaje de dominio
  propio, y la constitución exige que la validación de negocio viva en el dominio, no en
  un constraint de esquema.

## D2: Cómo garantizar que exista un único `"superuser"` sin UNIQUE en la columna

**Decisión**: la columna `username` MUST NOT tener índice único (la spec lo prohíbe
explícitamente: "no único"). La unicidad de un único `"superuser"` se garantiza
enteramente por la regla de aplicación (`ReservedUsernameError` en el registro) más la
naturaleza idempotente del seed (`SuperuserSeedService`, ver D3): nadie más puede
registrarse con ese valor exacto, y el seed solo crea la fila si todavía no existe un
usuario con `username = "superuser"`.

**Rationale**: igual al patrón ya usado para "garantizar un único admin": no hay ningún
`UNIQUE` sobre `role = 'admin'` tampoco; la unicidad del admin depende de que
`AdminSeedService` sea idempotente (`existsByEmail` primero) y de que el email del admin
ya sea único. Para el superusuario, como el username no es único, la verificación de
idempotencia del seed debe hacerse por `username`, no por email (ver D3).

**Alternativas consideradas**: índice único parcial `WHERE username = 'superuser'` —
descartado porque la spec dice explícitamente "no único" para el campo completo, y un
índice único parcial igual depende de que la aplicación nunca intente insertar un
segundo `"superuser"` sin chequear antes (el 409 en el registro ya lo cubre); agregar el
índice sería redundante y no está pedido.

## D3: Patrón del seed del superusuario

**Decisión**: nuevo `SuperuserSeedService` (`src/services/auth/superuser-seed.service.ts`),
mismo patrón que `AdminSeedService` — invocado una vez desde `main.ts` después del seed
de admin, idempotente, logging sin datos sensibles. A diferencia del admin (identificado
por `ADMIN_EMAIL`/`ADMIN_PASSWORD`), el superusuario se identifica por
`username = "superuser"` (fijo, no configurable) pero igual necesita un email y password
únicos para poder loguearse (el sistema de auth es email-based) — se leen de nuevas env
vars `SUPERUSER_EMAIL`/`SUPERUSER_PASSWORD`, mismo contrato que `ADMIN_EMAIL`/
`ADMIN_PASSWORD` (seed omitido con warning si faltan o son inválidas).

El seed, en una única operación, debe:
1. Verificar idempotencia por `username` (no por email): si ya existe un usuario con
   `username = "superuser"`, no hacer nada (ni re-crear holdings ni órdenes).
2. Crear el usuario (`User.register(...)`, con el nuevo `username`).
3. Provisionar sus dos `ValuationStrategy` propias, reutilizando
   `UserStrategyProvisioningService.provisionDefaultStrategiesFor(user.id)` — el mismo
   hook que cualquier alta normal (spec FR-005; sin duplicar la lista
   `DEFAULT_STRATEGIES_SEED`).
4. Obtener la lista completa de jugadores del catálogo (`PlayerRepository.findAllActive()`
   o equivalente — ver research.md D6).
5. Por cada jugador: crear un `TokenHolding` con `quantity = 100`, calcular el precio vía
   `QuotationService.valuate(superuserId, playerId)` (la estrategia recién seleccionada
   del paso 3), y crear una `Order` SELL PENDING por `quantity = 100` a ese precio
   (FR-006, FR-007).

**Rationale**: reutilizar el mismo hook de provisioning de estrategias que cualquier
usuario nuevo es exactamente lo que pide la spec ("la misma que recibe cualquier usuario
nuevo, vía el hook de registro de 019"); separar la identificación por `username` fijo de
las credenciales de login por env var es necesario porque `username` no es único en
general pero sí debe ser estable y conocido para el seed (no tiene sentido que sea
configurable, a diferencia del email del admin que sí lo es por si el equipo quiere
cambiarlo).

**Alternativas consideradas**:
- Seed vía migración (como `SeedPlayerCatalog`, `SeedValuationStrategies`): descartado
  porque el superusuario necesita invocar lógica de servicio real (hashing de password,
  `QuotationService.valuate`, `UserStrategyProvisioningService`) que no está disponible
  dentro de una migración SQL pura; el patrón de servicio idempotente en bootstrap
  (`AdminSeedService`) ya resuelve exactamente este tipo de necesidad en este codebase.
- Reconstruir el password del superusuario como un valor fijo hardcodeado: descartado
  por la misma regla de no hardcodear secretos que ya rige para `ADMIN_PASSWORD`.

## D4: Transacciones y locking — primer precedente en el codebase

**Decisión**: usar `DataSource.transaction(async (manager) => { ... })` de TypeORM
(API de alto nivel, no `queryRunner` manual) dentro de `OrdersService.createOrder`, con
locking pesimista explícito (`manager.getRepository(OrderEntity).createQueryBuilder()
.setLock('pessimistic_write')...` o el equivalente `lock: { mode: 'pessimistic_write' }`
en `find`) sobre: (a) las órdenes candidatas del lado opuesto encontradas por el
matching, y (b) ambos `TokenHolding` involucrados (comprador y vendedor), en ese orden,
**siempre ordenando los holdings por `userId` ascendente antes de lockearlos** para
evitar deadlocks cuando dos `POST /orders` concurrentes intentan lockear los mismos dos
holdings en orden inverso.

El plan de cambios (qué órdenes se actualizan, cuánto, qué holdings se mueven, qué
`TokenTransaction` se insertan) lo calcula la función pura de dominio `matchOrder(...)`
*antes* de tocar la base — el `OrdersService` abre la transacción, lockea las filas
necesarias, vuelve a pedir el estado fresco bajo lock, se lo pasa al dominio para
confirmar que el plan sigue siendo válido (nadie más lo modificó entre el cálculo del
precio y el lock), y aplica el resultado.

**Rationale**: no hay ningún precedente de transacción explícita en este codebase (el
lock existente de `QuotationService.recalculate` es un `Set<string>` en memoria,
insuficiente aquí porque el matching toca filas de *dos* usuarios y la app puede
escalar horizontalmente). El orden determinístico de lockeo (candidatas primero, luego
holdings por `userId` ascendente) es la técnica estándar para evitar deadlocks por
lock ordering inconsistente entre transacciones concurrentes — sin un orden fijo, dos
`POST /orders` que afectan a los mismos dos usuarios en direcciones opuestas podrían
deadlockearse mutuamente.

**Alternativas consideradas**:
- Lock a nivel de aplicación (mutex en memoria, como el de `recalculate`): descartado,
  no sirve entre instancias y no protege contra otra escritura directa a la fila.
- Nivel de aislamiento `SERIALIZABLE` sin locks explícitos: descartado por simplicidad —
  requeriría manejar reintentos ante `SerializationFailure` en cada request, mientras que
  el locking pesimista explícito con orden determinístico resuelve el mismo problema sin
  necesidad de retry loops.

## D5: Reutilización del cálculo de precio (nunca manual)

**Decisión**: `OrdersService.createOrder` llama a `QuotationService.valuate(userId,
playerId)` (sin `strategyId` — siempre la estrategia *seleccionada* del usuario en ese
momento, nunca una puntual, porque `POST /orders` no expone ese parámetro) y usa
`result.value` como precio de la orden, redondeado a 2 decimales (ver spec
Clarifications) antes de persistir.

**Rationale**: es exactamente el mismo servicio que ya expone `GET /players/:id/valuation`
(`PlayerController.valuation()` → `QuotationService.valuate`); no se duplica el cálculo
ni se agrega un segundo camino para producir un precio (spec FR-009, "el mismo cálculo
que expone GET /players/:id/valuation").

**Alternativas consideradas**: ninguna — la spec es explícita sobre reutilizar ese
cálculo exacto.

## D6: Cómo el seed obtiene "todos los jugadores existentes"

**Decisión**: reutilizar `PlayerRepository.findAllActive()` (ya existente, usado por
otras features de catálogo) desde `SuperuserSeedService`, inyectando `PLAYER_REPOSITORY`
igual que otros consumidores del catálogo.

**Rationale**: evita introducir un segundo método de listado de jugadores; "activos" es
la noción de catálogo ya vigente en el resto del sistema (sincronización WhoScored,
ranking, etc.), consistente con qué jugadores son "valuables" en el resto de la app.

**Alternativas consideradas**: un método nuevo `findAll()` sin el filtro de activos —
descartado por no estar pedido y por generar inconsistencia con el resto del catálogo
(órdenes SELL iniciales de jugadores inactivos que no aparecen en ningún otro lado de
la UI).

## D7: `TokenHolding`/`TokenTransaction` — construir desde cero (017 nunca implementado)

**Decisión**: confirmado con el usuario (ver conversación de planning): esta feature
construye `TokenHolding` y `TokenTransaction` desde cero como infraestructura real
(entidad de dominio, entidad de persistencia, mapper, repositorio e implementación
TypeORM), siguiendo exactamente el mismo patrón en capas que `quotation`
(`src/domain/portfolio/token-holding.ts`, `src/repositories/portfolio/...`). La clase
`Holding` existente (`src/domain/portfolio/holding.ts`), usada hoy solo como forma de
datos para `Portfolio` (stub de UI), **no se modifica ni se reutiliza**: es un read-model
de presentación distinto (incluye `averageBuyPrice`, `totalProfitLoss`, que no tienen
sentido para el holding transaccional de tokens que necesita el matching).

**Rationale**: la investigación confirmó que `PortfolioService.getPortfolioByUserId`
hoy solo devuelve `Portfolio.empty(userId)` — no existe ninguna tabla, repositorio ni
lógica de holdings real en el codebase. El motor de matching necesita holdings reales
(para validar SELL y para mover tokens en cada fill), así que esta feature es, de
hecho, la primera que implementa esa pieza de 017-buy-tokens, acotada a lo que 020
necesita (no se construye aquí ningún flujo de "comprar tokens con dinero real" —
fuera de alcance, ver spec Assumptions).

**Alternativas consideradas**: pausar 020 y crear primero una spec dedicada a
017-buy-tokens — descartado por decisión explícita del usuario (incluir en 020,
recomendado) para no bloquear el motor de matching detrás de una feature separada que no
tiene en este momento una spec propia que planificar.
