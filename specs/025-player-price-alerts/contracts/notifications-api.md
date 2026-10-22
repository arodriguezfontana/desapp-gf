# Contract: Notifications API

Todos los endpoints requieren JWT e identifican al usuario vía `@CurrentUser()`.
`ApiTags('notifications')`.

## `GET /notifications`

Lista las notificaciones propias del usuario autenticado, más recientes primero (spec
FR-005 análogo, FR-014, FR-015).

**Query params opcionales**: `unreadOnly?: boolean` (default `false`) — para que el
frontend pueda pedir solo las no leídas si lo necesita, aunque la campanita por defecto
carga todas y calcula el contador client-side; se incluye por conveniencia, no es
obligatorio para el MVP.

**Response 200** (`NotificationResponseDto[]`), orden descendente por `createdAt`:

```json
[
  {
    "id": "uuid",
    "alertId": "uuid",
    "playerId": "uuid",
    "condition": "PRICE_BELOW",
    "triggeredValue": 9.8,
    "createdAt": "2026-10-22T00:00:00.000Z",
    "read": false
  }
]
```

**Errores**: `401`.

## `PATCH /notifications/:id/read`

Marca una notificación propia como leída (spec FR-016).

**Response 204**: sin body.

**Errores**:
- `401`.
- `404` — no existe o no pertenece al usuario autenticado.

## `PATCH /notifications/read-all`

Marca todas las notificaciones propias no leídas como leídas, para el caso de uso de
"vaciar" la bandeja de un solo click (conveniencia de UX sobre FR-016; no bloquea el
MVP si se prioriza tasks, ver tasks.md).

**Response 204**: sin body.

**Errores**: `401`.

## `GET /notifications/stream` (Server-Sent Events)

Actualiza la bandeja en vivo mientras el usuario está conectado (spec FR-018).

- Protocolo: SSE (`Content-Type: text/event-stream`), implementado con el decorator
  `@Sse()` de NestJS sobre un `Observable<MessageEvent>`.
- Autenticación: dado que el `EventSource` nativo del browser no permite headers
  custom, el JWT se pasa como query param (`?token=...`); el guard de este endpoint
  valida el JWT desde query param en lugar del header `Authorization` estándar (única
  excepción documentada al mecanismo JWT habitual, acotada a este endpoint por
  limitación del protocolo SSE/EventSource).
- Cada evento emitido tiene el mismo shape que un elemento de `GET /notifications`
  (`NotificationResponseDto`), permitiendo que el frontend lo anteponga directamente a
  la lista ya cargada sin pedirla de nuevo.
- No hay reintento de entrega si la conexión no está abierta en el momento del disparo
  (riesgo aceptado en la spec); al reconectar, `GET /notifications` ya refleja lo
  generado mientras tanto.

**Errores**: `401` (JWT ausente o inválido en el query param) — la conexión SSE no se
abre.
