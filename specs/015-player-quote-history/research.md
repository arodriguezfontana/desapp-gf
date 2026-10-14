# Research: Historial de Cotizaciones del Jugador

## Decisión 1: El endpoint delega en `QuotationService`, no en un "PlayerService" para cotizaciones

**Decision**: `PlayerController.quotes(id)` (el nuevo método) delega en `QuotationService.getQuoteHistory(playerId)`, el mismo service que ya resuelve `GET /players/:id/quote` (`QuotationService.getQuoteAtDate`). No se crea ni se usa un "PlayersService" separado para cotizaciones.

**Rationale**: El input de planning menciona "delegando a PlayersService", pero el código real ya resuelve toda la lógica de cotizaciones (snapshot, score, estrategia, perfil de posición) en `QuotationService` (`backend/src/services/quotation/quotation.service.ts`), inyectado directamente en `PlayerController` junto a `PlayerEnrichmentService`. `PlayerService` (`backend/src/services/player/player.service.ts`) solo resuelve el catálogo de jugadores (listado, detalle, `findAllActive`), no cotizaciones. Crear una ruta de delegación nueva a través de un service que no conoce cotizaciones duplicaría responsabilidades ya resueltas y rompería la consistencia con `GET /players/:id/quote`, que usa exactamente el mismo patrón.

**Alternatives considered**: Mover la lógica de cotizaciones de `QuotationService` a `PlayerService` para que el nombre coincida con el input de planning. Rechazado: es un refactor no solicitado por el spec, de alcance mucho mayor que esta feature, y rompería la separación ya establecida entre el dominio de catálogo (`player`) y el de valuación (`quotation`) que tasks.md de 012-valuation-strategies dejó explícita.

---

## Decisión 2: El item del array reutiliza `PlayerQuoteResponseDto`, sin DTO nuevo

**Decision**: La respuesta de `GET /players/:id/quotes` es `PlayerQuoteResponseDto[]` — el mismo DTO que ya usa `GET /quotes/player/:playerId` (`id`, `playerId`, `strategyId`, `score`, `value`, `calculatedAt`, `appliedPosition`).

**Rationale**: El spec (FR-003, Assumptions) exige como mínimo valor, score, referencia a la estrategia (alcanza con el id), timestamp y el indicador de perfil de posición/pesos generales — exactamente los campos que `PlayerQuoteResponseDto` ya expone desde 014-position-weight-profiles. Resolver además el `strategyName` por cada entrada (como hace `PlayerQuoteDetailResponseDto` para una sola cotización) requeriría un lookup de estrategia por cada item del array — potencialmente una estrategia distinta por cada cotización histórica — introduciendo un patrón N+1 que el spec no exige y que no tiene contrapartida de UX clara (el gráfico de líneas solo necesita `calculatedAt` y `value`).

**Alternatives considered**: Crear un `PlayerQuoteHistoryItemDto` idéntico en forma a `PlayerQuoteResponseDto` pero como clase propia. Rechazado por duplicación: ambos expondrían exactamente los mismos campos: reusar la clase ya documentada en Swagger evita mantener dos contratos idénticos en paralelo. Resolver `strategyName` por item vía un mapa precargado de todas las estrategias (una sola query adicional, no N+1). Considerado razonable pero rechazado por alcance: el spec no lo pide y el frontend no lo necesita para el gráfico; se puede agregar después sin romper el contrato (campo opcional aditivo) si surge la necesidad.

---

## Decisión 3: Gráfico de líneas con SVG propio, sin librería de gráficos nueva

**Decision**: El componente `QuoteHistoryChart` se implementa con un `<svg>` inline (polyline + ejes mínimos), sin agregar `recharts`, `chart.js` ni ninguna librería de visualización al `package.json` del frontend.

**Rationale**: El frontend no tiene ninguna dependencia de charting hoy (`package.json` no lista ninguna). El spec pide un único gráfico de líneas, de solo lectura, sin interactividad exigida (tooltips, zoom, exportación no están en el alcance) — un polyline SVG con los puntos `(calculatedAt, value)` normalizados al viewBox cubre el requisito completo (FR-008) sin el costo de bundle, superficie de API nueva y curva de aprendizaje de una librería para un solo gráfico simple. Es coherente con el resto de `components/` del proyecto, que ya usa SVG inline para las siluetas de posición y las "RatingBar" hechas a mano en `PlayerDetailPage`.

**Alternatives considered**: `recharts` (la opción más común en proyectos React). Rechazada para este alcance: agrega ~100KB+ a la build por un solo gráfico de líneas sin requerimientos de interactividad; se puede reconsiderar si una futura feature pide más de un tipo de gráfico o interacciones ricas (hover con tooltip detallado, selección de rango).

---

## Decisión 4: Nombre del archivo e2e distinto de "historical" para no confundir con 013

**Decision**: El test e2e nuevo se llama `test/quotation/player-quote-history.e2e-spec.ts` (singular "history" = listado completo), no "historical".

**Rationale**: Ya existe `test/quotation/player-quote-historical.e2e-spec.ts`, que cubre el parámetro `?at=` de `GET /players/:id/quote` (013-player-quote-endpoint, US2: "cotización histórica puntual"). Usar un nombre parecido para el endpoint de listado completo de esta feature generaría confusión entre "cotización histórica a una fecha" (013) y "historial completo" (015) — son capacidades distintas y complementarias, no la misma.

**Alternatives considered**: Ninguna — es puramente una convención de nombres para evitar ambigüedad entre specs.

---

## Decisión 5: `findAllByPlayerId` reutiliza el índice ya existente `(player_id, calculated_at DESC)`

**Decision**: El nuevo método `PlayerQuoteRepository.findAllByPlayerId(playerId): Promise<PlayerQuote[]>` ejecuta `WHERE player_id = :playerId ORDER BY calculated_at ASC` sin agregar ningún índice ni migration nueva.

**Rationale**: El índice `(player_id, calculated_at DESC)` ya creado en 012-valuation-strategies (`CreateQuotationTables`, data-model.md) sirve igual de bien para un `ORDER BY calculated_at ASC` filtrado por `player_id`: Postgres puede recorrer un índice B-tree en cualquier dirección sin costo adicional. No hace falta un índice `ASC` separado.

**Alternatives considered**: Crear un índice adicional `(player_id, calculated_at ASC)`. Rechazado: redundante — un índice B-tree ya ordenado DESC se recorre en reversa con el mismo costo que uno ASC; agregar un segundo índice solo duplicaría el espacio en disco y el costo de escritura en cada `INSERT`/`saveMany` sin ninguna ganancia de lectura.

---

## Decisión 6: Validación de existencia del jugador reutiliza el patrón de `getQuoteAtDate`

**Decision**: `QuotationService.getQuoteHistory(playerId)` llama primero a `playerRepository.findById(playerId)` y lanza `PlayerNotFoundError` si es `null`, exactamente como ya hace `getQuoteAtDate` (`backend/src/services/quotation/quotation.service.ts`). `PlayerNotFoundError` ya está registrado en `AllExceptionsFilter` con status 404.

**Rationale**: Es el mismo chequeo, el mismo error de dominio y el mismo mapeo HTTP que el endpoint hermano `GET /players/:id/quote` ya usa — no hay razón para introducir una validación distinta para una feature que es conceptualmente "lo mismo pero en plural". Como `PlayerRepository.findById` ya filtra `removedAt IS NULL` (ver `typeorm-player.repository.ts`), un jugador dado de baja produce el mismo 404 automáticamente, sin lógica adicional (spec Edge Cases, primer punto).

**Alternatives considered**: Ninguna — divergir del patrón ya usado por el endpoint hermano no tendría ninguna ventaja y rompería la consistencia entre los dos endpoints de cotización de un jugador.
