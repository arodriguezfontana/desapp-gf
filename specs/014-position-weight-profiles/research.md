# Research: Perfiles de Pesos por Posición

## Decisión 1: Nombres canónicos de métricas en los perfiles de posición (`totalShots`→`shots`, `accuratePasses`→`passesCompleted`)

**Decision**: Los perfiles de posición usan los nombres de campo del dominio `Player`, igual que los pesos generales. Los valores de seed del input de usuario (`totalShots`, `accuratePasses`) se traducen a `shots` y `passesCompleted` respectivamente, preservando los valores numéricos exactos.

**Rationale**: La feature 012-valuation-strategies ya resolvió esta misma traducción para los pesos generales (`research.md` §2 de esa feature): el dominio `Player` (`backend/src/domain/player/player.ts`) expone `shots` y `passesCompleted`, no `totalShots`/`accuratePasses` (nombres de WhoScored). `calculate-player-value.ts` resuelve cada métrica accediendo directamente a esos campos del dominio (`getMetric()`); si los perfiles de posición usaran los nombres del proveedor externo, cada clave de `positionWeights` necesitaría pasar por una capa de traducción antes de poder indexar al jugador, duplicando el problema que la feature 012 ya evitó. Los pesos del input quedan así:

- "Performance general" FW: `goals=0.45, shots=0.25, assists=0.15, rating=0.15`
- "Performance general" DF: `totalTackles=0.40, interceptions=0.25, rating=0.25, passesCompleted=0.10`
- "Performance general" GK: `rating=0.50, passesCompleted=0.30, interceptions=0.20`
- "Impacto táctico" FW: `goals=0.45, shots=0.25, assists=0.15, rating=0.20, yellowCards=-0.05`
- "Impacto táctico" MF: `assists=0.25, keyPasses=0.25, passesCompleted=0.20, rating=0.20, totalTackles=0.10`
- "Impacto táctico" GK: `rating=0.50, passesCompleted=0.35, interceptions=0.15`

(MF y DF de "Performance general" que no usan `totalShots`/`accuratePasses` quedan igual que en el input: MF=`assists=0.30, keyPasses=0.30, dribbles=0.15, rating=0.25`; DF de "Impacto táctico"=`totalTackles=0.40, interceptions=0.35, rating=0.25`.)

**Alternatives considered**: Mantener los nombres del input (`totalShots`, `accuratePasses`) y agregar una tabla de alias en el dominio. Rechazado: reintroduce exactamente la indirección que 012 eliminó, y crea dos convenciones de nombres de métrica coexistiendo en el mismo sistema (pesos generales vs. perfiles de posición), violando la consistencia terminológica exigida por el spec (spec.md, categoría "Terminología").

---

## Decisión 2: Representación del origen del snapshot — `appliedPosition: Position | null` en `PlayerQuote`

**Decision**: Un único campo nuevo `appliedPosition: Position | null` en el dominio `PlayerQuote` (y `applied_position varchar(2) nullable` en persistencia). `null` significa "se usaron los pesos generales"; un valor de `Position` (`FW`/`MF`/`DF`/`GK`) significa "se usó el perfil de esa posición".

**Rationale**: La espec (FR-009) pide un indicador de "si los pesos usados corresponden al perfil de una posición (y cuál) o al conjunto general". Un único campo nullable captura ambos datos (el "si" y el "cuál") sin necesitar un booleano adicional redundante (`usedPositionProfile: boolean` + `position: Position | null` obligaría a mantener dos campos sincronizados). Reutiliza el enum `Position` ya existente en `backend/src/domain/player/enums/position.ts`, consistente con cómo `calculate-player-value.ts` ya importa `Player` (y por lo tanto conoce el dominio `player`) desde el dominio `quotation`.

**Alternatives considered**: Campo de texto libre (`weightsSource: string`, p. ej. `'GENERAL'` o `'FW'`). Rechazado: pierde el type-safety del enum `Position` ya existente sin ninguna ventaja (no hay más orígenes posibles que "general" o una de las 4 posiciones).

---

## Decisión 3: `calculatePlayerValue` devuelve también los pesos efectivamente usados

**Decision**: La firma de `calculatePlayerValue(player, strategy)` pasa de devolver `{ score, value }` a `{ score, value, appliedPosition, weightsUsed }`, donde `weightsUsed` es el `Record<string, number>` que efectivamente se usó (el perfil de la posición o los pesos generales).

**Rationale**: El único call site (`QuotationService.recalculateAll`) necesita tanto `appliedPosition` (para `PlayerQuote.appliedPosition`) como el mapa de pesos exacto para `weightSnapshot` (que antes siempre era `strategy.weights`, y ahora puede ser `strategy.positionWeights[position]`). Devolver `weightsUsed` desde la función pura evita que el Service tenga que reimplementar la misma lógica de selección de perfil que ya vive en el dominio (violaría el Principio II: el Service no debe contener lógica de negocio propia).

**Alternatives considered**: Que el Service derive `weightsUsed` a partir de `appliedPosition` consultando `strategy.positionWeights` de nuevo. Rechazado: duplica en el Service la misma rama condicional que ya resolvió `calculatePlayerValue`, y requeriría que el Service conozca la estructura interna de `ValuationStrategy.positionWeights` en lugar de tratar la estrategia como una caja negra.

---

## Decisión 4: Validación de perfiles de posición — mismo invariante que los pesos generales, reutilizado en `ValuationStrategy.create`

**Decision**: `ValuationStrategy.create` valida, para cada posición presente en `positionWeights`, que (a) la suma de sus pesos esté en `[0.999, 1.001]` y (b) todas sus claves sean métricas válidas (mismo `NORMALIZATION_BOUNDS` que ya valida los pesos generales). Se extrae un helper privado `validateWeightsSum(weights, label)` para no duplicar la lógica de tolerancia entre pesos generales y cada perfil.

**Rationale**: El spec (FR-003) exige "la misma validación que ya aplica a los pesos generales". El control de claves válidas (ya existente para `weights`) se extiende a `positionWeights` por la misma razón de origen: un perfil con una métrica mal escrita quedaría silenciosamente con peso 0 implícito para esa métrica real y un peso "fantasma" para la clave inválida, sin que nada lo detecte — el mismo riesgo que ya se previene para los pesos generales.

**Alternatives considered**: Validar solo la suma, sin revalidar las claves por perfil (ya que las claves del perfil son un subconjunto "libre" según el spec). Rechazado: "subconjunto libre de métricas que la estrategia reconoce" no significa "cualquier string"; sigue debiendo ser un subconjunto de las métricas válidas del dominio (ver spec.md Assumptions), y no validarlo reabre el mismo hueco que already se cierra para los pesos generales.

---

## Decisión 5: Persistencia — `jsonb` para `positionWeights`, confirmado por el input de planning

**Decision**: Columna `position_weights jsonb NULL` en `valuation_strategies`, mapeando `Record<Position, Record<string, number>>` completo (solo las posiciones que la estrategia define, sin entradas `null` por posición faltante).

**Rationale**: Mismo criterio ya aplicado a `weights` y `weight_snapshot` en 012-valuation-strategies (ver `data-model.md` de esa feature): el conjunto de métricas varía por estrategia y por posición, y columnas individuales por métrica/posición requerirían una migración cada vez que se agregue o cambie una métrica. El volumen de datos es trivial (como máximo 4 posiciones × un puñado de métricas por estrategia), por lo que no se necesitan índices ni queries dentro del jsonb — se lee completo y se resuelve en memoria dentro de `calculatePlayerValue`.

**Alternatives considered**: Tabla separada `position_weight_profiles(strategy_id, position, metric, weight)` normalizada. Rechazada: introduce joins y una entidad de persistencia nueva para un dato que nunca se consulta por filas individuales (siempre se lee el perfil completo de una posición a la vez), y rompe la consistencia con el patrón jsonb ya establecido para `weights`/`weight_snapshot` en la misma tabla y en `player_quotes`.

---

## Decisión 6: Alcance de exposición por API — `positionWeights` no se expone en `StrategyResponseDto`

**Decision**: `GET /quotes/strategies` (listado de estrategias para el panel admin) no se modifica; `positionWeights` no se agrega a `StrategyResponseDto`. Solo se extienden `PlayerQuoteResponseDto` (`GET /quotes/player/:playerId`) y `PlayerQuoteDetailResponseDto` (`GET /players/:id/quote`) con `appliedPosition`.

**Rationale**: El spec (FR-010) solo exige que la vista de detalle del jugador indique el origen de su cotización vigente; no pide que el panel admin de selección de estrategias (agregado en el commit `0f3bf4d`, fuera del alcance de esta feature) muestre ni edite los perfiles de posición — estos se cargan exclusivamente por seed (FR-008) y no hay ninguna pantalla de administración para ellos. Agregar `positionWeights` a `StrategyResponseDto` sin un consumidor real sería alcance no solicitado por el spec.

**Alternatives considered**: Exponer `positionWeights` en `StrategyResponseDto` "por si se necesita después". Rechazado por alcance: nada en spec.md lo requiere, y el admin panel actual no tiene una vista de detalle de estrategia donde mostrarlo.

---

## Decisión 7: Las ramas "sin posición cargada" / "posición no reconocida" de FR-005 son salvaguardas de tipo, no caminos de código nuevos

**Decision**: No se agrega validación runtime adicional para "jugador sin posición" o "posición no reconocida": el dominio `Player.position` ya es de tipo `Position` (enum de 4 valores, validado en `parsePosition` al ingresar datos — ver `backend/src/domain/player/enums/position.ts`), por lo que esos dos casos son inalcanzables con el modelo de tipos actual. La selección `strategy.positionWeights[player.position]` cubre de forma natural el único caso realmente alcanzable hoy: "no hay perfil definido para esa posición en la estrategia activa" (fallback a `strategy.weights`).

**Rationale**: Esto ya quedó documentado como Assumption en spec.md ("los casos de 'sin posición cargada' o 'posición no reconocida' ... se tratan como salvaguardas de robustez para datos futuros ... no como un estado alcanzable con los datos actuales"). Agregar un `if (!isValidPosition(player.position)) { ... }` muerto en el dominio solo para satisfacer la letra de FR-005 sería código sin caso de prueba real posible (violaría el Principio IX: "todo comportamiento MUST cubrirse con casos felices y casos borde" — no hay forma de construir ese caso borde con el `Player` tipado actual).

**Alternatives considered**: Tipar `player.position` como `Position | string` en la firma de `calculatePlayerValue` para forzar un chequeo defensivo. Rechazado: ensancha el tipo de entrada de una función de dominio pura más allá de lo que el resto del dominio garantiza, introduciendo un caso imposible de testear de forma realista y contradiciendo la fuente de verdad (`Player.position: Position`).
