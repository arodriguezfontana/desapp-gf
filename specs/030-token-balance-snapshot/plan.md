# Implementation Plan: Snapshot de saldo en la auditoría de tokens

**Branch**: `030-token-balance-snapshot` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/030-token-balance-snapshot/spec.md` + plan técnico aportado por el equipo (captura en `credit`/`debit`, columnas nullable → backfill con validación cruzada → `NOT NULL`), verificado contra el código (ver [research.md](research.md)).

## Summary

Cada asiento de `token_transactions` guarda `balance_before` y `balance_after` de su tenencia, capturados en el mismo
punto del dominio donde el saldo cambia y escritos en la misma transacción que la tenencia y el resto de la
operación. La emisión inicial de 100 tokens al superusuario —hoy el único movimiento que cambia una tenencia sin
dejar asiento— pasa a auditarse con un asiento propio (0 → 100) y a ser atómica. Los asientos históricos se
completan con un script de backfill por tenencia, con validación cruzada contra el saldo actual; después, un paso
separado endurece las columnas a `NOT NULL`.

El plan del equipo se adopta con **nueve ajustes** que salieron de contrastarlo con el código:

1. **`credit`/`debit` no son el único camino, y la emisión no deja asiento.** `TokenHolding.withQuantity` fija cantidades absolutas (siembra de simulación) y `SuperuserSeedService.provisionPlayer` llama a `credit(100)` pero **no escribe ningún `TokenTransaction`** (un asiento exige `order_id` y `counterpart_order_id` `NOT NULL`, y la emisión no tiene ninguno) ni usa `TransactionManager`. Hay que cambiar el seed (transacción + asiento) y relajar a `NULL` esas dos columnas. `withQuantity` queda fuera de la regla (no es un movimiento por `credit`/`debit`; ver spec).
2. **El acumulador "arranca en 0" no funciona para el superusuario.** Su historial parte de una emisión de 100 que el log nunca registró, así que **todas** sus tenencias fallarían la validación cruzada y el script no terminaría nunca. Regla: el punto de partida es 0, salvo para el superusuario, donde también se acepta la cantidad emitida (`closing − neto == 100`). Cualquier otro desfasaje es inconsistencia.
3. **La validación cruzada se adopta (la spec se actualizó).** La spec original la dejaba fuera de alcance; el plan la incorpora y la spec se ajustó (FR-011/FR-012, Fuera de alcance, Assumptions). Se valida contra el saldo actual **o**, si la tenencia ya tiene asientos con saldo (escritos por el código nuevo), contra el `balance_before` del primero de ellos: así el script es idempotente y convive con tráfico posterior al despliegue.
4. **Por tenencia y sin frenar a las demás.** Cada tenencia se reconstruye y se confirma en su propia transacción (con `FOR UPDATE` sobre su fila de `token_holdings`). Las inconsistentes no se persisten y se **reportan todas juntas**; el script termina con código ≠ 0 si hubo alguna. Detenerse en la primera ocultaría el resto.
5. **El backfill y el `NOT NULL` no pueden ser migraciones que corren solas.** Las migraciones se ejecutan al arrancar (`main.ts`, `test-app.ts`) y una vez corridas quedan registradas; un backfill que debe poder fallar, reportar y volver a correrse —y un `NOT NULL` que bloquearía el arranque si faltara un dato— no encajan. El backfill es un **script explícito y re-ejecutable**; el `NOT NULL` es un segundo paso gateado. Además, en desarrollo y tests el esquema lo maneja `synchronize` a partir de la entidad: la entidad debe quedar `nullable` hasta el paso 2.
6. **Emisión fuera del historial y de la cuenta de costo promedio.** `GET /orders/history` (`findByUserId`) y el costo promedio de compra de `PortfolioService` (`findCreditsByUserId`, que promedia **todos** los CREDIT) leerían el nuevo asiento de emisión y cambiarían su resultado (FR-017). Ambas consultas excluyen los asientos sin orden.
7. **`settleFills` devuelve un `Map` y `pairFromFill` crea los asientos.** Se agrega `settleFillsAudited` (devuelve holdings y snapshots por fill) y `pairFromFill` acepta los snapshots como parámetro opcional: no se cambia ninguna firma existente (Principio IX).
8. **La siembra de simulación también crea asientos nuevos** y debe escribir saldos coherentes (SC-001); se calculan con la misma función pura de cadena que usa el backfill.
9. **Tests existentes: el paso 1 no modifica ninguno; el paso 2 sí** (los que construyen asientos sin saldos). Eso requiere permiso explícito (Principio IX) y queda listado en el research.

## Technical Context

**Language/Version**: TypeScript 5.7 (`strict`), Node.js 20, NestJS 11.2

**Primary Dependencies**: TypeORM sobre PostgreSQL (`pg`); sin dependencias nuevas

**Storage**: PostgreSQL. Cambios de esquema en `token_transactions`: `+ balance_before integer NULL`, `+ balance_after integer NULL`, `order_id` y `counterpart_order_id` pasan a `NULL`. Mismo tipo `integer` que `token_holdings.quantity`

**Testing**: Jest unit de dominio (sin Nest ni DB), integración con Testcontainers (backfill, migración de esquema), e2e supertest con PostgreSQL efímero; test de arquitectura tsarch existente

**Target Platform**: Servicio HTTP Linux/Docker + script de mantenimiento ejecutado a mano por entorno

**Project Type**: web-service (monorepo; sólo `backend/`)

**Performance Goals**: sin costo medible en `POST /orders` (dos lecturas en memoria por movimiento); backfill lineal en la cantidad de asientos

**Constraints**: nunca saldos negativos; un asiento nunca se modifica salvo llenar los dos campos vacíos (backfill); la API no cambia; ninguna tenencia se toca durante el backfill

**Scale/Scope**: ~4 archivos de dominio nuevos/editados, 1 entidad + 1 mapper + 1 repositorio, 4 servicios editados (`OrdersService`, `SuperuserSeedService`, `MarketSimulationService`, módulos), 1 migración de esquema, 1 módulo de backfill + script, 1 migración y 1 cambio de entidad en el paso 2

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Nota |
|-----------|--------|------|
| I. Capas | ✅ | La lógica nueva (cadena de saldos, snapshots, emisión) vive en `domain/`, sin decoradores de TypeORM ni imports de Nest. El backfill usa el `DataSource` desde `database/` (infraestructura de mantenimiento, como las migraciones) y delega el cálculo a una función de dominio pura |
| II. Dominio rico | ✅ | `TokenHolding.applyCredit/applyDebit` devuelven el snapshot; `settleFillsAudited`, `issueInitialEmission` y `reconstructHoldingChain` son dominio. El Service sólo orquesta |
| III. Validación por nivel | ✅ | Invariantes en el dominio (no negativo, `after = before ± cantidad`); `NOT NULL`/`CHECK` en la base como último recurso |
| IV. Secretos | ✅ N/A | Sin datos personales nuevos |
| V. Auditoría inmutable | ⚠️ **desvío justificado** | El backfill hace `UPDATE` sobre filas del log, que el principio prohíbe. Excepción acotada y de una sola vez: sólo pasa de `NULL` a valor (`WHERE balance_before IS NULL AND balance_after IS NULL`), nunca cambia ni borra un dato, no crea ni quita asientos, es idempotente, y tras el paso 2 las columnas son obligatorias. Registrada en Complexity Tracking |
| VI. Atomicidad | ✅ | El snapshot se escribe en el mismo `TransactionManager.run` que la tenencia; **la emisión pasa a ser transaccional** (hoy no lo es) |
| VII. Observabilidad | ✅ | El script reporta por tenencia (aplicada / ya completa / inconsistente) y un resumen; el seed loguea la emisión |
| VIII / X-3,4. Swagger y Postman | ✅ N/A | No cambia ningún endpoint ni su respuesta |
| IX. Testing | ✅ / ⚠️ | Unit de dominio, integración Testcontainers (backfill, esquema), e2e (orden real, emisión, atomicidad, historial intacto). **Paso 1: cero tests existentes modificados. Paso 2: requiere modificar tests existentes (ver research §10) y por lo tanto permiso explícito** |
| X. Definición de terminado | ✅ planificado | Tests verdes, `nest build`; sin documentación de API |
| XI. Idioma | ✅ | Identificadores de código en inglés (`balanceBefore`); mensajes, comentarios y docs en español |
| XII. Spec-first | ✅ | `spec.md` previo; se actualizó antes de planificar los cambios que el plan introduce |
| XIII. Performance | ✅ N/A | Sin SLA nuevo; el script no corre en el camino de requests |

**Post-design (re-evaluado tras Fase 1)**: sin violaciones sin justificar. Un desvío (V) y un riesgo operativo (el paso 2 exige datos limpios en cada entorno).

## Project Structure

### Documentation (this feature)

```text
specs/030-token-balance-snapshot/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── backfill-cli.md
├── checklists/
│   └── requirements.md
└── tasks.md             # lo genera /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── package.json                                              # + script db:backfill-token-balances
├── scripts/
│   └── backfill-token-balances.ts                            # entrada CLI (ts-node): arma el DataSource, llama al módulo y fija el exit code
├── src/
│   ├── domain/
│   │   ├── auth/superuser.ts                                 # SUPERUSER_USERNAME (se mueve del service; lo usa el backfill)
│   │   ├── portfolio/token-holding.ts                        # + applyCredit/applyDebit → { holding, snapshot }; credit/debit delegan
│   │   └── orders/
│   │       ├── token-transaction.ts                          # + balanceBefore/After (opcionales), orderId/counterpart nullables, isEmission, pairFromFill con snapshots
│   │       ├── settle-fills.ts                               # + settleFillsAudited (settleFills no cambia)
│   │       ├── token-emission.ts                             # INITIAL_EMISSION_QUANTITY + issueInitialEmission → { holding, entry }
│   │       └── balance-chain.ts                              # orden de desempate, cadena de saldos y reconstrucción de una tenencia (pura)
│   ├── repositories/orders/
│   │   ├── entities/token-transaction.entity.ts              # + balance_before/after (nullable), order_id/counterpart_order_id nullable
│   │   ├── mappers/token-transaction.mapper.ts               # + mapeo de los dos saldos y de los nullables
│   │   └── token-transaction.repository.ts                   # findByUserId/findCreditsByUserId excluyen la emisión
│   ├── services/
│   │   ├── orders/orders.service.ts                          # settleFillsAudited + pairFromFill con snapshots
│   │   ├── auth/superuser-seed.service.ts                    # emisión transaccional con asiento
│   │   └── simulation/market-simulation.service.ts           # saldos coherentes en los asientos sembrados
│   ├── modules/
│   │   ├── orders/orders.module.ts                           # exporta TransactionManager
│   │   └── auth/auth.module.ts                               # (sin cambios si OrdersModule ya llega vía forwardRef)
│   └── database/
│       ├── migrations/1793100000000-AddBalanceSnapshotToTokenTransactions.ts   # esquema (producción, sin synchronize)
│       └── backfill/backfill-token-balances.ts               # orquesta el backfill por tenencia sobre un DataSource
└── test/
    └── token-balance-snapshot.e2e-spec.ts                    # orden real, auto-cruce, multi-fill, emisión, atomicidad, historial/portafolio intactos

# Tests nuevos (unit, junto al código; ninguno modifica uno existente)
backend/src/domain/portfolio/token-holding-snapshot.spec.ts
backend/src/domain/orders/{balance-chain,settle-fills-audited,token-emission,token-transaction-snapshot}.spec.ts
backend/src/database/backfill/backfill-token-balances.integration.spec.ts
backend/src/database/token-balance-snapshot-migration.integration.spec.ts

# PASO 2 (gateado, se entrega aparte cuando el informe del backfill esté limpio en cada entorno)
backend/src/database/migrations/1793100000001-EnforceTokenTransactionBalances.ts      # precondición + SET NOT NULL
backend/src/repositories/orders/entities/token-transaction.entity.ts                  # nullable: false
```

**Structure Decision**: el dominio concentra toda la regla (cadena, snapshots, emisión, reconstrucción) para probarla sin Nest ni base; los servicios sólo orquestan transacciones; el backfill es infraestructura de mantenimiento fuera de las capas de request. Los tests de la feature van en archivos nuevos.

## Riesgos conocidos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| **Dos fuentes de verdad del esquema**: `synchronize` (dev/test, desde la entidad) y migraciones (producción). Si la entidad dijera `NOT NULL` antes de tiempo, una base de desarrollo con filas legacy no arranca (`ADD COLUMN … NOT NULL` sobre tabla con datos) | Paso 1 con entidad `nullable`; la migración de esquema usa `IF NOT EXISTS`/`DROP NOT NULL` idempotentes y tiene su test de integración. El cambio de entidad a `nullable: false` va **sólo** en el paso 2 |
| **Entornos con datos de simulación antiguos** (bots con 250 tokens fijados con `withQuantity`) no cierran la validación cruzada | Es esperado: se reportan y el paso 2 no se aplica ahí hasta limpiarlos (reset de la base de desarrollo o re-siembra). El código nuevo de simulación ya escribe saldos coherentes |
| **Asientos con el mismo instante** en una tenencia: el log no tiene secuencia | Desempate fijo CREDIT → DEBIT → `id`; el saldo final y la validación no dependen del orden entre iguales; los saldos intermedios de asientos idénticos en tipo e instante son una aproximación documentada |
| **Backfill concurrente con órdenes**: el saldo de cierre se movería | Transacción por tenencia con `FOR UPDATE` sobre `token_holdings` (el mismo lock que toma la ejecución de órdenes); además se recomienda correrlo sin tráfico y la validación usa el primer asiento ya completo como cierre |
| **Un movimiento faltante que se compense** (crédito y débito iguales omitidos) pasa la validación | Riesgo residual aceptado en la spec; la validación cubre cualquier desfasaje neto |
| **Emisión histórica del superusuario con una cantidad distinta de 100** (p. ej. se corrió el seed y después cambió la constante) | Cae como inconsistencia y se reporta; no se adivina |

## Complexity Tracking

| Desvío | Por qué hace falta | Alternativa descartada |
|--------|--------------------|------------------------|
| Principio V: `UPDATE` de filas del log en el backfill | Es la única forma de cumplir el principio para toda operación, pasada y futura (spec FR-010); el dato es reconstruible del propio log | Dejar los históricos vacíos (excepción permanente, sin cota en el tiempo) o crear asientos nuevos que reemplacen a los viejos (rompe el append-only de verdad: borra o duplica auditoría) |
| `order_id`/`counterpart_order_id` nullables | La emisión no tiene orden ni contraparte; inventar una orden o una contraparte falsearía el log | Asociar la emisión a la orden de venta inicial (ensucia `findBy orderId` de los tests de matching y la lectura del asiento) o una contraparte ficticia |
| Backfill como script y no como migración | Debe poder fallar por tenencia, reportar y re-ejecutarse tras corregir datos | Migración de TypeORM (corre sola al arrancar, queda registrada, bloquearía el arranque ante un dato malo) |
