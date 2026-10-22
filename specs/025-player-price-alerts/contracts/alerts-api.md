# Contract: Alerts API

Todos los endpoints requieren JWT (`JwtAuthGuard` global, ya aplicado por default salvo
`@Public()`) e identifican al usuario vía `@CurrentUser()`. `ApiTags('alerts')`.

## `POST /alerts`

Crea una alerta de precio sobre un jugador para el usuario autenticado (spec FR-001,
FR-002, FR-003, FR-004).

**Request body** (`CreatePriceAlertRequestDto`):

```json
{
  "playerId": "uuid",
  "condition": "PRICE_ABOVE | PRICE_BELOW",
  "targetValue": 12.5
}
```

Validación DTO (class-validator): `playerId` UUID requerido; `condition` debe ser uno
de los valores del enum `AlertCondition`; `targetValue` número positivo (`@IsNumber()`,
`@IsPositive()`).

**Response 201** (`PriceAlertResponseDto`):

```json
{
  "id": "uuid",
  "playerId": "uuid",
  "condition": "PRICE_ABOVE",
  "targetValue": 12.5,
  "status": "ACTIVE",
  "createdAt": "2026-10-22T00:00:00.000Z"
}
```

**Errores**:
- `400` — DTO inválido (umbral no positivo, condición fuera de enum, `playerId` no UUID).
- `401` — JWT ausente o inválido.
- `404` — el jugador indicado no existe (`PlayerNotFoundError`).

## `GET /alerts`

Lista las alertas propias del usuario autenticado, todas (activas y canceladas), para
que el usuario pueda ver su historial (spec FR-005). El frontend filtra por estado si
necesita mostrar solo activas.

**Response 200**: `PriceAlertResponseDto[]`.

**Errores**: `401`.

## `DELETE /alerts/:id`

Cancela una alerta propia (spec FR-006, FR-007, FR-008).

**Response 204**: sin body.

**Errores**:
- `401` — JWT ausente o inválido.
- `404` — la alerta no existe o no pertenece al usuario autenticado (`AlertNotFoundError`
  — se devuelve 404 y no 403 para no revelar la existencia de alertas ajenas, mismo
  criterio usado para recursos owner-only en el resto del proyecto, p. ej. estrategias de
  valuación).

## Notas de integración (no expuestas como endpoint)

- `QuotationService.recalculateAll()` emite `quote.recalculated` por cada `PlayerQuote`
  nueva persistida (no por las salteadas en `skipped`). El módulo `alerts` escucha ese
  evento y, por cada alerta `ACTIVE` del usuario+jugador cuya `matches(value)` sea
  `true`, emite `alert.triggered`. Esto no es parte del contrato HTTP; se documenta aquí
  porque es el disparador funcional de todo el flujo de alertas.
