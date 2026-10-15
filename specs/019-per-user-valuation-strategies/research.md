# Research: Estrategias de Valuación Propias por Usuario

No quedaron `NEEDS CLARIFICATION` en el Technical Context del plan (stack, testing y
storage ya están fijados por la constitución y por el código existente). Esta sección
documenta las decisiones de diseño que sí requerían investigar el código actual antes de
poder planificar con confianza, siguiendo el formato Decision/Rationale/Alternativas.

## D1: Cómo modelar "seleccionada" en reemplazo de "activa"

**Decision**: Reemplazar la columna `is_active` (boolean, global, una sola fila en todo
el sistema) por `is_selected` (boolean, con el invariante "exactamente una fila en
`true` por `user_id`"), y eliminar los métodos de dominio `activate()`/`deactivate()` de
`ValuationStrategy` en favor de `select()`/`deselect()`. El toggle transaccional
"desmarcar la anterior + marcar la nueva" se reutiliza en estructura (ya existe en
`typeorm-valuation-strategy.repository.ts` como `activateStrategy`, con `QueryRunner`),
solo cambia el `WHERE` para incluir `user_id = :userId`.

**Rationale**: El código ya tiene resuelto el patrón "exactamente una seleccionada,
transacción que desmarca+marca"; sólo había que acotarlo por usuario en vez de global.
Reusar la misma forma minimiza el diff y el riesgo de introducir un bug nuevo de
concurrencia.

**Alternativas consideradas**: Mantener `is_active` y simplemente agregarle `user_id`
sin renombrar. Rechazada por claridad: "activa" en el dominio anterior significaba "rige
para todo el sistema"; renombrar a "seleccionada" evita que alguien lea el código nuevo
y asuma semántica global donde ya no la hay.

## D2: Qué hacer con las filas globales preexistentes de `valuation_strategies` y `player_quotes`

**Decision**: Las dos filas seed actuales (`Performance general`, `Impacto táctico`, ids
fijos `a1b2c3d4-...`/`b2c3d4e5-...`) y cualquier `player_quotes` generada por el cron
semanal anterior quedan fuera de alcance de migración de datos (ver spec.md §Assumptions:
"La migración o el destino de las estrategias de sistema y del historial de cotizaciones
generados antes de esta feature quedan fuera de alcance"). La migración de esquema agrega
`user_id` como `NOT NULL` a ambas tablas; para no romper la migración por las filas
globales preexistentes, se eliminan esas filas (y sus `player_quotes` asociadas vía
`strategy_id`) en la misma migración, antes de aplicar el `NOT NULL`, dejando ambas
tablas vacías al terminar — el único path para repoblarlas pasa a ser el provisioning
por usuario de esta feature.

**Rationale**: Es la única opción consistente con "no hay ninguna estrategia que no
pertenezca a un usuario" (FR-020) sin inventar un dueño ficticio para datos que la spec
explícitamente declaró fuera de alcance de migrar. Conservar las filas con un `user_id`
inventado violaría la invariante de "exactamente dos estrategias por usuario, creadas al
alta" para cualquier usuario al que se le asignaran. Repoblar `player_quotes` desde cero
es aceptable porque la spec ya asume que el historial empieza desde el momento en que se
implementa esta feature en adelante.

**Alternativas consideradas**: (a) Asignar las filas globales al usuario admin
existente — rechazada porque el admin no las creó con un recálculo propio, y violaría
FR-015 (inmutable y asociada a quien disparó el recálculo). (b) Dejar `user_id` nullable
para las filas legacy — rechazada porque el resto del código (ownership checks, queries
`WHERE user_id = :userId`) tendría que manejar un caso `NULL` que ninguna historia de
usuario necesita, y contradice "el usuario siempre tiene exactamente esas dos" (FR-003).

## D3: Dónde vive el provisioning de las dos estrategias al alta

**Decision**: Nuevo servicio de dominio/aplicación `UserStrategyProvisioningService` en
`quotation` (o en un módulo compartido si se prefiere evitar que `auth` dependa de
`quotation`), expuesto por `QuotationModule` y consumido desde `AuthModule`. Se inyecta
en `AuthService.register()` (justo después de `this.users.save(user)`,
`auth.service.ts:30-42`) y en `AdminSeedService.run()` (`admin-seed.service.ts:34-85`),
porque ambos son los dos únicos puntos de creación de un `User` en el sistema hoy
(alta normal y seed idempotente del admin). El servicio crea las dos `ValuationStrategy`
(pesos generales + perfiles de posición, copiados literalmente de los valores seed
documentados en `data-model.md`) dentro de la misma transacción que la creación del
usuario cuando sea posible, para que un alta nunca deje un usuario sin sus dos
estrategias.

**Rationale**: Es el mismo patrón `forwardRef` que ya existe entre `QuotationModule` y
`PlayerModule`; evita duplicar los valores de pesos seed en dos lugares (auth y
quotation) y mantiene el Principio I (el Service de auth no importa el repositorio de
`quotation` directamente, sólo el servicio de aplicación expuesto).

**Alternativas consideradas**: Event listener desacoplado (`UserRegisteredEvent` →
handler en `quotation`) — rechazada por ahora porque introduce latencia eventual
(el usuario podría listar sus estrategias antes de que el handler corra) cuando la spec
exige "sin que el usuario tenga que hacer nada" inmediatamente después del alta
(Acceptance Scenario 1 de la Historia 1); una llamada síncrona dentro de la misma
transacción es la única forma de garantizar esa atomicidad sin agregar infraestructura de
eventos nueva no pedida por la spec.

## D4: Cómo implementar el lock de concurrencia por usuario en el recálculo síncrono

**Decision**: Lock en memoria keyed por `userId` dentro de `QuotationService`
(`Map<string, true>` o equivalente ya usado por el actual `RecalculationInProgressError`
del cron global, visto en `quotation.job.ts`), adquirido al entrar a `recalculate(userId,
playerId?)` y liberado en un `finally`, con un `try/catch` temprano que lanza
`RecalculationInProgressError` (mapeado a 409 por `AllExceptionsFilter`) si la clave ya
existe. Al ser síncrono (D1 del spec.md, respuesta esperada de `/speckit-clarify`), no
hace falta persistir el estado del lock en base de datos: el proceso Node único del
backend ya serializa el acceso al `Map`, y el lock desaparece naturalmente si el proceso
muere a mitad de un recálculo (no deja un 409 fantasma).

**Rationale**: Reutiliza el mecanismo ya validado por el cron global existente
(`RecalculationInProgressError`), sólo cambia la clave de "global" a "por `userId`".
Evita introducir un mecanismo de locking distribuido (Redis, advisory locks de Postgres)
que la spec no pide y que la constitución no exige para esta operación.

**Alternativas consideradas**: Fila de estado en base de datos (`recalculation_status`
por usuario) — rechazada por ahora: añade una tabla y I/O extra para resolver el mismo
problema que ya resuelve una estructura en memoria, válida mientras el backend corra en
un único proceso (no hay mención en la spec ni en la constitución de despliegue
multi-instancia para este endpoint).

## D5: Qué pasa con `QuotationJob` (cron semanal) y el endpoint `POST quotes/recalculate` (admin)

**Decision**: Se elimina por completo `backend/src/services/quotation/quotation.job.ts`
y su registro en `quotation.module.ts` (incluyendo, si no se usa para nada más,
`ScheduleModule.forRoot()`). Se elimina también el endpoint
`POST quotes/recalculate` bajo `AdminApiKeyGuard` en `quotation.controller.ts`. Ambos son
reemplazados por `POST /users/me/quotes/recalculate` bajo `JwtAuthGuard` (FR-016,
FR-016a, DD-003).

**Rationale**: Discontinuado explícitamente por DD-003 del spec — ya no hay una
estrategia global cuyo recálculo periódico tenga sentido ejecutar para todos los
usuarios por igual.

**Alternativas consideradas**: Ninguna — la spec es explícita (FR-016: "MUST NOT
ejecutar ningún recálculo de forma automática o programada").

## D6: Impacto en `GET /players/ranking` (016-player-ranking-endpoint)

**Decision**: Fuera de alcance de esta feature (ya declarado en spec.md §Assumptions).
El plan no modifica `typeorm-player.repository.ts::findRanking` ni la CTE `latest_quotes`
que hoy lee `player_quotes`/`valuation_strategies` como tablas globales. Se documenta
aquí como riesgo conocido: una vez que `player_quotes` tenga `user_id` NOT NULL y ya no
existan filas globales (ver D2), esa CTE deja de poder resolver "la cotización más
reciente" sin ambigüedad de qué usuario, y probablemente empiece a devolver 0 filas o
falle en runtime si no se la toca en un trabajo posterior.

**Rationale**: Coincide con la decisión explícita de la spec de dejar la reconciliación
del ranking como trabajo posterior; no se improvisa una solución no pedida.

**Alternativas consideradas**: Adaptar el ranking en este mismo plan — rechazada porque
excede el alcance que la spec define explícitamente como "fuera de alcance... se resuelve
como un trabajo posterior".
