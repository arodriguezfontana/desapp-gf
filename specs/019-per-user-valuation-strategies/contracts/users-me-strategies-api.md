# API Contract: Estrategias y Cotizaciones por Usuario

Todos los endpoints de esta tabla requieren JWT válido (`JwtAuthGuard`), salvo que se
indique lo contrario. Formato de error uniforme vía `AllExceptionsFilter` existente.

## GET /users/me/strategies

Lista las dos estrategias propias del usuario autenticado.

- **200**: `{ strategies: [ { id, name, weights, positionWeights, isSelected }, { ... } ] }` — siempre exactamente 2 elementos, exactamente uno con `isSelected: true`.

## PATCH /users/me/strategies/:id/select

Marca la estrategia `:id` como seleccionada; desmarca atómicamente la otra estrategia
propia del mismo usuario.

- **200**: estrategia actualizada (mismo shape que el ítem de la lista anterior).
- **403**: `:id` no pertenece al usuario autenticado.
- **404**: `:id` no existe.
- Idempotente: repetir sobre la ya seleccionada devuelve 200 sin cambios de estado.

## PATCH /users/me/strategies/:id/weights

Body: `{ weights: Record<string, number> }` — reemplazo completo de los pesos generales.

- **200**: estrategia actualizada con los nuevos pesos.
- **400**: suma de `weights` fuera de `1.0 ± 0.001`, o claves de métrica inválidas. No persiste cambios parciales.
- **403**: `:id` no pertenece al usuario autenticado.
- **404**: `:id` no existe.

## PATCH /users/me/strategies/:id/position-weights/:position

`:position` ∈ `{FW, MF, DF, GK}`. Body: `{ weights: Record<string, number> }` —
reemplazo completo del perfil de esa posición únicamente.

- **200**: estrategia actualizada con el nuevo perfil de esa posición; el resto de los perfiles y los pesos generales quedan intactos.
- **400**: `:position` inválida, o suma del perfil fuera de `1.0 ± 0.001`. No persiste cambios parciales.
- **403**: `:id` no pertenece al usuario autenticado.
- **404**: `:id` no existe.

## GET /players/:id/valuation?strategyId=&lt;uuid&gt;

Calcula al vuelo el valor del jugador `:id`. Sin `strategyId`, usa la estrategia
seleccionada del usuario autenticado; con `strategyId`, usa esa estrategia puntual (debe
ser una de las dos propias del usuario).

- **200**: `{ playerId, strategyId, score, value, appliedPosition }`. No persiste nada.
- **400**: `strategyId` indicado no pertenece al usuario autenticado (mismo criterio que 403 de edición, pero expresado como rechazo de la consulta — ver spec.md Edge Cases).
- **404**: jugador inexistente.

## POST /quotes/recalculate

Protegido por `AdminApiKeyGuard` (`X-Api-Key` header). Sin body. Ejecuta **síncronamente**
el recálculo de todos los usuarios × todos los jugadores activos; la respuesta HTTP no se
emite hasta terminar todo el cálculo.

- **200**: `{ recalculated: [{ userId, playerId, value, score }], skipped: [{ userId, playerId, reason }] }`. Las combinaciones que fallen individualmente se incluyen en `skipped` y no interrumpen el resto.
- **401**: API key ausente o inválida.
- **403**: la API key no pertenece a un usuario con rol `admin`.
- **409**: ya hay un recálculo global en curso (lock a nivel sistema).

## GET /players/:id/quotes

Historial de cotizaciones del jugador `:id` generadas por recálculos del usuario
autenticado, nunca de otro usuario. Sin paginación (ver spec.md Clarifications).

- **200**: `{ quotes: [ { value, calculatedAt, strategyId, appliedPosition }, ... ] }`, ordenado de más antigua a más reciente; `[]` si el usuario nunca recalculó este jugador.
- **404**: jugador inexistente en el catálogo.

## Endpoints eliminados por esta feature

- `GET quotes/strategies` (`AdminApiKeyGuard`) — ya no existe una lista global de estrategias que un admin pueda consultar.
- `PATCH quotes/strategies/:id/activate` (`AdminApiKeyGuard`) — ya no existe el concepto de activar una estrategia para todo el sistema.
- `POST /users/me/quotes/recalculate` (JWT, user-scoped) — reemplazado por `POST /quotes/recalculate` (`AdminApiKeyGuard`, system-wide).
