# Research: Estrategias de Valuación de Jugadores

## Decisión 1: ApiKeyGuard — ¿reutilizar o crear nuevo?

**Decision**: Reutilizar el `AdminApiKeyGuard` existente.

**Rationale**: El proyecto ya tiene `ApiKeyGuard` en `backend/src/guards/api-key/api-key.guard.ts` y su subclase `AdminApiKeyGuard` en `backend/src/guards/api-key/admin-api-key.guard.ts`. El endpoint `POST /quotes/recalculate` es una operación de sistema, igual que `POST /sync/trigger`, y ese endpoint ya usa `AdminApiKeyGuard`. La constitución (Principio IV) exige `ApiKeyGuard` para endpoints de sistema; `AdminApiKeyGuard` satisface ese requisito y además restringe a keys con rol ADMIN. No se crea ningún guard nuevo.

**Nota importante**: El guard existente es database-backed (lookup de ApiKey por hash SHA-256 en la tabla `api_keys`), no compara contra una variable de entorno. Esto difiere de la sugerencia `QUOTES_API_KEY` del input del usuario, pero es el patrón ya establecido en el proyecto y es correcto. La variable de entorno `QUOTES_API_KEY` no se necesita.

**Alternatives considered**: Crear un guard simple que lea de env con `crypto.timingSafeEqual`. Rechazado porque duplica la infraestructura de autenticación ya existente y la haría divergir del modelo de autorización del proyecto (roles de ApiKey).

---

## Decisión 2: Nombres canónicos de métricas en los pesos de ValuationStrategy

**Decision**: Los pesos de `ValuationStrategy` usan los nombres de campo del dominio `Player`, no los nombres del proveedor externo.

**Rationale**: El dominio `Player` (`backend/src/domain/player/player.ts`) usa:
- `passesCompleted` (no `accuratePasses` — ese es el nombre de WhoScored)
- `shots` (no `totalShots` — ídem)

Los pesos son un mapa `Record<string, number>` en el jsonb. La función de cálculo accede a `player.passesCompleted` y `player.shots` directamente. Si los pesos usaran `accuratePasses` / `totalShots`, la función necesitaría una capa de traducción de nombres. Usar los nombres del dominio elimina esa indirección.

**Impacto en seed**: La Estrategia 2 "Impacto táctico" usa `accuratePasses` y la Estrategia 1 no. Los seeds deben escribirse con `passesCompleted` y `shots`.

**Bounds de normalización actualizados**:
```
goals=40, assists=25, keyPasses=150, dribbles=200, totalTackles=150,
shots=200, passesCompleted=2500, interceptions=100, rating=10,
yellowCards=15, redCards=5
```

**Alternatives considered**: Usar nombres de WhoScored (`accuratePasses`, `totalShots`) como clave canónica. Rechazado porque acopla la capa de dominio a la nomenclatura del proveedor externo.

---

## Decisión 3: Cron schedule semanal

**Decision**: `CronExpression.EVERY_WEEK` con `waitForCompletion: true`, mismo que el job de sincronización existente.

**Rationale**: El job de sync ya usa `CronExpression.EVERY_WEEK` (`0 0 * * 0`, domingos a medianoche). Usar el mismo schedule mantiene consistencia operativa: ambos jobs corren en la misma ventana de mantenimiento semanal. `waitForCompletion: true` previene solapes a nivel del scheduler; el lock en memoria del service maneja el caso de disparo manual concurrente.

---

## Decisión 4: ¿findAll de jugadores o paginación?

**Decision**: Agregar `findAllActive(): Promise<Player[]>` al `IPlayerRepository`.

**Rationale**: El recálculo masivo necesita todos los jugadores activos. La interfaz actual solo expone `findPage(...)`. Cargar página a página aumenta la complejidad y el número de queries. Para un catálogo académico de escala limitada (<10k jugadores) un `findAll` con `WHERE removed_at IS NULL` es apropiado. Se agrega el método a la interfaz y a `TypeOrmPlayerRepository`.

**Alternatives considered**: Usar `findPage` con limit muy alto. Rechazado: frágil y semánticamente incorrecto. Añadir un cursor-based iterator. Rechazado: sobreingeniería para el alcance del proyecto.

---

## Decisión 5: Persistencia de pesos — jsonb vs columnas individuales

**Decision**: jsonb en columna `weights` de tipo `jsonb` (TypeORM column type `'jsonb'`).

**Rationale**: Confirmado por el input del usuario. Las métricas pueden variar; jsonb evita migrations de schema cada vez que se agrega una métrica. El `weightSnapshot` en `PlayerQuote` también es jsonb por la misma razón.

**Alternatives considered**: Columnas individuales. Rechazado: requiere migration por cada nueva métrica; la Estrategia 1 y la Estrategia 2 usan conjuntos de métricas distintos, lo que generaría muchas columnas nullable.

---

## Decisión 6: Patrón de lock de concurrencia

**Decision**: Mismo patrón que `PlayerSyncService`: variable `activeRunId: string | null` (o `isRunning: boolean`) + error de dominio propio + finally.

**Rationale**: El patrón ya existe y el equipo lo conoce. El error de dominio (`RecalculationInProgressError extends DomainError`) se mapea a 409 por el `AllExceptionsFilter` global, igual que `SyncInProgressError`. El job cron retorna silenciosamente si bloqueado.

---

## Decisión 7: Estructura del módulo `QuotationModule`

**Decision**: Módulo propio en `backend/src/modules/quotation/` importando `PlayerModule` (para `PLAYER_REPOSITORY`) y `ScheduleModule` (para el job cron).

```
QuotationModule
  imports:     [PlayerModule, ScheduleModule.forRoot(), TypeOrmModule.forFeature([ValuationStrategyEntity, PlayerQuoteEntity])]
  controllers: [QuotationController]
  providers:   [
    QuotationService,
    AdminApiKeyGuard,
    ApiKeyGuard,
    { provide: VALUATION_STRATEGY_REPOSITORY, useClass: TypeOrmValuationStrategyRepository },
    { provide: PLAYER_QUOTE_REPOSITORY, useClass: TypeOrmPlayerQuoteRepository },
    QuotationJob,
  ]
```

**Nota**: `ApiKeyModule` debe importarse para que `AdminApiKeyGuard` pueda inyectar sus dependencias (igual que en `PlayerSyncModule`).
