# Research: Snapshot de saldo en la auditoría de tokens

Verificación del plan del equipo contra el código actual (rama `feat/core-3`, HEAD `da5404d`). No quedó ningún
`NEEDS CLARIFICATION`; las decisiones que cambian la spec o el plan del equipo están marcadas.

## 1. Dónde cambia un saldo hoy (corrige la precondición "credit/debit son el único punto")

Inventario de todo lo que escribe `token_holdings`:

| Camino | Mecanismo | Deja asiento | Transaccional |
|--------|-----------|:------------:|:-------------:|
| Ejecución de órdenes (`OrdersService.create` → `settleFills`) | `credit`/`debit` | Sí (`TokenTransaction.pairFromFill`) | Sí (`TransactionManager.run`, con `lockForUpdate`) |
| Emisión inicial al superusuario (`SuperuserSeedService.provisionPlayer`) | `createEmpty(...).credit(100)` | **No** | **No** (`holdings.save` y luego `orders.save` sueltos) |
| Siembra de simulación (`MarketSimulationService.saveHoldingQuantity`) | `withQuantity` (cantidad absoluta) | Sí, pero armados a mano y **sin relación con la cantidad fijada** | No |

- **Hallazgo 1 (emisión)**: el movimiento que la spec manda auditar "sin excepciones" hoy no tiene asiento, porque `token_transactions.order_id` y `counterpart_order_id` son `NOT NULL` con FK a `orders` y la emisión no tiene ninguna de las dos. Además nace fuera de transacción: una falla entre `holdings.save` y `orders.save` deja la tenencia sin su orden de venta.
- **Hallazgo 2 (simulación)**: `withQuantity` y los asientos sembrados no pasan por `credit`/`debit`. Los bots reciben `BOT_INITIAL_HOLDING = 250` fijo por jugador y reciben además asientos de CREDIT/DEBIT que no se reflejan en esa cantidad: su historial **nunca** cierra con su saldo actual. Es el caso "irreconstruible" que la spec ya prevé (FR-012).
- **Decisión**: la regla de captura cubre `credit`/`debit` (órdenes y emisión). `withQuantity` queda fuera, como dice la spec. La siembra **sí** crea asientos nuevos, así que debe escribirlos con saldos válidos (ver §8).
- **Consecuencia sobre el plan del equipo**: la frase "si hubiera otro camino sería una violación a corregir" se cumple para la emisión (se corrige acá) y no para la siembra, que es deliberadamente de datos de prueba.

## 2. Captura del snapshot en el dominio

- **Hallazgo**: `TokenHolding.credit/debit` devuelven una instancia nueva; el saldo anterior es `this.quantity` y el posterior es `next.quantity`. No hay un lugar donde ambos valores se expongan juntos, y `settleFills` (pura) devuelve sólo `Map<userId, TokenHolding>`.
- **Decision**:
  - `TokenHolding.applyCredit(q)` / `applyDebit(q)` devuelven `{ holding, snapshot: { before, after } }`; `credit`/`debit` pasan a ser `applyX(q).holding`. Un solo camino de cálculo: el snapshot es el valor del cálculo, no una segunda lectura ni una reconstrucción (FR-002).
  - `settleFillsAudited(fills, holdings)` devuelve `{ holdings, snapshots }` con un snapshot por fill (`buyer` y `seller`), encadenado fill a fill (importa para el auto-cruce, donde el débito parte del saldo ya acreditado). `settleFills` queda igual y delega.
  - `TokenTransaction.pairFromFill(fill, playerId, createdAt, newId, snapshot?)` acepta el snapshot como último parámetro opcional.
- **Rationale**: ninguna firma existente cambia (Principio IX); la lógica sigue en el dominio (Principio II) y se prueba sin Nest ni base.
- **Alternatives considered**: que el Service lea `holding.quantity` antes de llamar (mueve la regla al Service, viola II y se desincroniza con el cálculo); cambiar el retorno de `settleFills` (rompe `settle-fills.spec.ts`).

## 3. Emisión inicial: asiento propio, sin orden, atómica

- **Decision**: `issueInitialEmission({ userId, playerId, quantity, price, createdAt, newId })` (dominio) devuelve `{ holding, entry }`: el holding con 100 tokens y un asiento CREDIT con `balance_before = 0`, `balance_after = 100`, `order_id = NULL`, `counterpart_order_id = NULL`, `price` = el mismo precio de referencia de la orden de venta inicial. `provisionPlayer` pasa a: resolver el precio → `TransactionManager.run(tx => { orden (ya existente) + holding + asiento })`.
- **Cambio de esquema asociado**: `order_id` y `counterpart_order_id` pasan a `NULL`. Un asiento con `order_id IS NULL` **es** una emisión (no se agrega una columna discriminadora).
- **Por qué `order_id` también nulo y no la orden de venta inicial**: `test/orders-matching.e2e-spec.ts` busca asientos por `orderId` de la orden del vendedor; un asiento de emisión con ese mismo `orderId` sumaría una fila más a esas búsquedas (rompería tests existentes) y mezclaría dos significados en la misma columna.
- **Idempotencia**: no cambia — `provisionPlayer` ya salta las tenencias con `quantity > 0`.
- **Alternatives considered**: contraparte ficticia (falsea el log); asiento ligado a la orden de venta (ver arriba); no auditar la emisión (incumple la spec y deja cada cadena del superusuario sin origen).

## 4. La emisión no debe aparecer en el historial ni en el costo promedio (FR-017)

- **Hallazgo**: `OrdersService.getHistory` usa `findByUserId` y `PortfolioService` calcula el costo promedio de compra con `findCreditsByUserId`, que promedia **todos** los CREDIT del usuario. Un CREDIT de emisión (100 tokens a precio de referencia) cambiaría ambas salidas para el superusuario.
- **Decision**: ambas consultas filtran `order_id IS NOT NULL`. El asiento de emisión sólo lo leen las consultas de auditoría/cadena (backfill y tests). El DTO de historial conserva `counterpartOrderId: string` (el filtro garantiza que nunca es nulo; `fromDomain` lo documenta).
- **Impacto**: ningún contrato de API cambia; Swagger y Postman no se tocan.
- **Tests existentes**: `portfolio.service.spec`/`orders.service.spec` usan mocks del repositorio; no se modifican.

## 5. Backfill: reglas y por qué es un script (ajusta el plan del equipo)

### 5.1 Algoritmo por tenencia (usuario + jugador)

1. Abrir transacción; `SELECT … FOR UPDATE` sobre la fila de `token_holdings` (mismo lock que la ejecución de órdenes). Sin fila de tenencia, el saldo actual es 0.
2. Leer los asientos de la tenencia. **Pendientes** = los que tienen `balance_before IS NULL OR balance_after IS NULL`; si no hay, la tenencia ya está completa (no se toca).
3. Ordenar los pendientes: `created_at` ascendente, y a igual instante CREDIT antes que DEBIT, y luego `id` (desempate final determinista).
4. **Saldo de cierre esperado** = `balance_before` del primer asiento ya completo de la tenencia (los escribe el código nuevo, siempre posteriores a los legacy) o, si no hay, el saldo actual de `token_holdings`.
5. `neto` = Σ CREDIT − Σ DEBIT de los pendientes. `apertura = cierre − neto`.
6. **Validación** (cruzada, FR-012): `apertura` debe ser `0`, o —sólo si el titular es el superusuario— la cantidad emitida (`INITIAL_EMISSION_QUANTITY`, 100). Cualquier otro valor es inconsistencia. Además la cadena no puede pasar por un saldo negativo.
7. Si valida: aplicar la cadena desde `apertura` y `UPDATE … SET balance_before, balance_after WHERE id = $1 AND balance_before IS NULL AND balance_after IS NULL` (nunca sobrescribe). Commit. Si no: rollback y a la lista de inconsistencias con la causa (`apertura`, `neto`, `cierre`).

### 5.2 Diferencias con el plan del equipo

- **"Acumulador arranca en 0 y valida el último contra `TokenHolding`"**: se mantiene, pero reformulado como `apertura = cierre − neto` para (a) admitir la emisión histórica del superusuario y (b) funcionar cuando una tenencia ya tiene asientos nuevos. Sin la excepción del superusuario, el 100% de sus tenencias fallaría y el script no terminaría nunca.
- **"El backfill se detiene"**: se interpreta por tenencia. Frenar todo en la primera inconsistencia ocultaría las demás y bloquearía a las tenencias sanas; se reportan todas juntas y el script termina con código ≠ 0.
- **Lectura**: `lockForUpdate`-equivalente con SQL crudo vía `DataSource` (el módulo no usa las entidades de la app).

### 5.3 Por qué un script y no una migración de TypeORM

`runPlayerCatalogMigrations` ejecuta todo `migrations/*` al arrancar (`main.ts`, `test-app.ts`) y TypeORM registra cada migración como corrida. Un backfill que debe poder fallar por tenencia, reportar y re-ejecutarse tras corregir datos no encaja: o bloquea el arranque, o queda marcado como hecho aunque haya dejado filas sin completar. El script (`pnpm db:backfill-token-balances`) es idempotente y su lógica vive en un módulo importable y testeable (`database/backfill/`).

## 6. Esquema: `synchronize` en dev/test vs migraciones en producción

- **Hallazgo**: `DatabaseModule` usa `synchronize: NODE_ENV !== 'production'`. En desarrollo y tests, **la entidad** define el esquema y se aplica antes que las migraciones (que se corren después de `NestFactory`). En producción sólo existen las migraciones. `CreateTokenTransactions` ya usa `IF NOT EXISTS` por esto.
- **Decision (paso 1)**: entidad con `balance_before/after` `nullable: true` y `order_id`/`counterpart_order_id` `nullable: true`; migración `1793100000000-AddBalanceSnapshotToTokenTransactions` con `ADD COLUMN IF NOT EXISTS …` y `ALTER COLUMN … DROP NOT NULL` (idempotente, para producción). Probada con un test de integración como `add-role-migration.integration.spec.ts`.
- **Decision (paso 2, gateado)**: migración `1793100000001-EnforceTokenTransactionBalances` (precondición: cero filas con saldo nulo; si no, lanza con un mensaje que apunta al script) + entidad a `nullable: false`. Se entrega aparte, cuando el informe del backfill es limpio en cada entorno. Es el "una vez verificado" del plan del equipo: ese verificado es un paso de proceso, no algo que una migración que corre sola pueda esperar.
- **Riesgo**: si la entidad pasara a `NOT NULL` antes, una base de desarrollo con filas legacy no arranca (`ADD COLUMN … NOT NULL` falla sobre una tabla con datos).
- **Tipo de columna**: `integer`, igual que `token_holdings.quantity` (como pide el plan).

## 7. Tests: estrategia

- **Unit de dominio (sin Nest ni DB)**: `token-holding-snapshot.spec` (`applyCredit/applyDebit`: valores, tenencia vacía, saldo 0, invariante `after = before ± q`, no negativo), `settle-fills-audited.spec` (un fill, varios fills encadenados, auto-cruce, equivalencia con `settleFills`), `token-emission.spec` (0 → 100, sin órdenes, precio), `token-transaction-snapshot.spec` (`pairFromFill` con snapshot; `isEmission`), `balance-chain.spec` (desempate, cadena, apertura 0, apertura de emisión sólo para el superusuario, negativo, cierre con primer asiento completo, determinismo).
- **Integración (Testcontainers)**: `backfill-token-balances.integration.spec` (dataset con movimientos conocidos: cadena esperada exacta, último saldo = tenencia, idempotencia, no sobrescribe, tenencia inconsistente reportada y no tocada, superusuario con emisión histórica, mezcla legacy + nuevos, conteo de filas intacto); `token-balance-snapshot-migration.integration.spec` (esquema).
- **E2E**: `token-balance-snapshot.e2e-spec` — orden real con ambos saldos correctos en la misma transacción; auto-cruce; varios fills; atomicidad (falla forzada en medio de la operación → cero asientos y tenencias intactas); emisión vía `SuperuserSeedService.run()` (0 → 100, idempotente, cadena empalma con la primera venta); historial y portafolio idénticos con el asiento de emisión presente.
- **Arquitectura**: el test tsarch existente cubre las capas nuevas sin cambios (el dominio no importa Nest ni TypeORM).
- **Tests existentes**: paso 1, **ninguno** se modifica.

## 8. Siembra de simulación

- **Hallazgo**: `seedTransactionsAndHoldings` arma `TokenTransaction.create(...)` sin saldos. En el paso 1 quedarían nulos (violan SC-001) y bloquearían el paso 2.
- **Decision**: la siembra calcula la cadena de cada (usuario, jugador) en orden cronológico con la misma función pura (`balance-chain`) y la escribe en los asientos: admin con apertura 0 (como hoy, no empieza con tenencias) y bots con apertura `BOT_INITIAL_HOLDING` (hoy la tenencia del bot se fija en 250 sin contar los movimientos; se documenta esa diferencia y se mantiene, porque cambiarla alteraría la salida de la simulación). Los asientos quedan bien formados (no negativos, `after = before ± q`, encadenados); la tenencia del bot no se reconcilia con ellos y eso se declara como limitación de los datos simulados.
- **Alternatives considered**: dejar los saldos nulos (incumple SC-001); rehacer la simulación para que cierre contra la tenencia (cambia la salida visible de `seed:simulation` y su spec).

## 9. Diseño de módulos y wiring

- `SuperuserSeedService` necesita `TransactionManager` y `TokenTransactionRepository`. `OrdersModule` ya provee `TransactionManager` y exporta `TokenTransactionRepository`; se agrega `TransactionManager` a `exports` (AuthModule ya importa `OrdersModule` por `forwardRef`). No existe spec unitario del seed (sólo `superuser-seed.e2e-spec.ts`), así que el cambio de constructor no rompe tests.
- `SUPERUSER_USERNAME` hoy es una constante privada del service; se extrae a `domain/auth/superuser.ts` para que la use el backfill (y la validación de nombres reservados puede reutilizarla).

## 10. Impacto del paso 2 sobre tests existentes (requiere permiso, Principio IX)

Con `balance_before/after` obligatorios (dominio y base), estos tests existentes construyen asientos sin saldos y dejarían de compilar o de insertar:

| Test existente | Qué construye |
|----------------|---------------|
| `src/domain/orders/token-transaction.spec.ts` | 4 llamadas a `TokenTransaction.create` sin saldos |
| `test/portfolio.e2e-spec.ts` | helper `insertCreditTx` inserta filas de `TokenTransactionEntity` sin saldos |
| `test/orders-matching-concurrency.e2e-spec.ts` | 1 inserción directa de `TokenTransactionEntity` |

Se propone, para el paso 2, el cambio mínimo de agregar los dos campos a esos constructores/inserciones. **No se hace sin un "sí" explícito**; si no se aprueba, el paso 2 queda sin entregar (las columnas siguen `NULL`-ables pero el código nuevo siempre las completa).

## 11. Fuera de alcance / riesgos

- Exponer los saldos en `GET /orders/history`: otra decisión de contrato.
- Reconciliar las tenencias de los bots de simulación: son datos de prueba.
- Un par de movimientos faltantes que se compensen exactamente no lo detecta la validación cruzada: riesgo residual aceptado en la spec.
- El backfill debe correrse en una ventana sin tráfico de órdenes; el `FOR UPDATE` por tenencia protege la consistencia pero no evita que el saldo de cierre cambie entre tenencias.
