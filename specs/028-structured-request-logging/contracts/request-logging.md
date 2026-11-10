# Contract: Request logging y Correlation ID

Esta feature no agrega ni modifica endpoints. Su contrato son (1) un header HTTP presente en **todas** las
respuestas y (2) el formato de las líneas de log que consume quien opera el sistema.

## 1. Header `X-Correlation-Id`

| | Request | Response |
|---|---------|----------|
| Header | `X-Correlation-Id` (opcional) | `X-Correlation-Id` (siempre) |
| Valor | String de 1–64 caracteres `[A-Za-z0-9._:-]` | El mismo valor si la request traía uno válido; un UUID v4 generado en caso contrario |

Reglas:
- Se devuelve en **toda** respuesta: 2xx, 4xx (incluidos 401, 404 y 400 por cuerpo inválido) y 5xx.
- Un valor entrante vacío, de más de 64 caracteres o con caracteres fuera del conjunto permitido se descarta; no se rechaza la request, se genera uno propio.
- El valor entrante se reutiliza tal cual: varias requests con el mismo id (reintentos) comparten traza.
- El header no concede acceso ni altera el comportamiento de ningún endpoint.
- CORS: el header está en `Access-Control-Expose-Headers`, de modo que el frontend puede leerlo con `response.headers.get('X-Correlation-Id')`.

Ejemplo:

```http
POST /orders HTTP/1.1
X-Correlation-Id: retry-7f3a-001
```

```http
HTTP/1.1 201 Created
X-Correlation-Id: retry-7f3a-001
```

## 2. Línea de log de request (JSON, una por request, en stdout)

```json
{"level":30,"time":1794280600758,"correlationId":"retry-7f3a-001","req":{"method":"POST","url":"/orders"},"res":{"statusCode":201},"responseTime":4,"route":"/orders","params":{},"query":{},"userId":"3b1f2c60-...","body":{"playerId":"...","side":"BUY","quantity":2},"msg":"request completed"}
```

Rechazada por autenticación (usuario anónimo, secretos redactados):

```json
{"level":40,"time":1794280600751,"correlationId":"9142bbe8-354b-4d40-bf1c-042fc104e84a","req":{"method":"POST","url":"/orders"},"res":{"statusCode":401},"responseTime":1,"route":"/orders","params":{},"query":{},"userId":"anónimo","body":{"password":"[REDACTED]"},"msg":"request completed"}
```

Token en la URL del stream de notificaciones:

```json
{"level":30,"correlationId":"...","req":{"method":"GET","url":"/notifications/stream?token=[REDACTED]"},"res":{"statusCode":200},"userId":"3b1f2c60-...","msg":"request completed"}
```

Definición de campos: ver [data-model.md](../data-model.md).

## 3. Otras líneas de log del backend

Todas JSON. Las emitidas mientras se procesa una request llevan el mismo `correlationId`.

Un 4xx deja **una sola** línea (la de cierre, nivel `warn`): `AllExceptionsFilter` no la repite. Un 5xx deja dos: la de cierre
(nivel `error`, sin `err`) y la del filtro, que es la que trae el stack real:

```json
{"level":50,"time":1794280600750,"correlationId":"9142bbe8-...","req":{"method":"GET","url":"/auth/me"},"res":{"statusCode":500},"responseTime":154,"userId":"anónimo","msg":"request errored"}
{"level":50,"time":1794280600749,"correlationId":"9142bbe8-...","context":"AllExceptionsFilter","err":{"type":"Error","message":"GET /auth/me -> 500","stack":"Error: ..."},"msg":"GET /auth/me -> 500"}
```

Las de arranque y tareas programadas no llevan `correlationId`.

## 4. Cómo reconstruir una operación

Filtrar por un solo valor: `jq 'select(.correlationId == "retry-7f3a-001")'` (o el filtro equivalente de la herramienta de logs).

## 5. Garantías de seguridad

- Nunca aparecen en logs: contraseñas, JWT, API keys, headers de autorización, email, nombre de usuario, ni cuerpos de respuesta.
- Los valores sensibles se reemplazan por `[REDACTED]` en cuerpo, query, params y URL.

## 6. Impacto en documentación (Principios VIII y X)

- **Swagger**: sin endpoints nuevos. La descripción global del documento OpenAPI agrega que toda respuesta incluye `X-Correlation-Id` y que el cliente puede enviarlo.
- **Postman**: nota en la descripción de la colección y un test a nivel colección: `pm.response.headers.has('X-Correlation-Id')`.
