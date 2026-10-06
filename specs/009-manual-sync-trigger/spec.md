# Feature Specification: Disparo manual de sincronización (WhoScored y Football-Data)

**Feature Branch**: `[sin rama asignada]`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Se agregan dos endpoints, uno por feature: POST /sync/whoscored en el controller de whoscored, POST /sync/football-data en el controller de football-data. Cada uno llama al mismo service de sincronización que ya usa su @Cron respectivo. El @Cron no se saca, el endpoint lo complementa. Los dos endpoints exigen ApiKey, no JWT. La respuesta tiene que ser un resumen de lo sincronizado (equipos y jugadores actualizados, y si matching ya corrió, cuántos quedaron sin resolver), nunca un 200 vacío. Ninguno de los dos tiene pantalla de frontend."

## Clarifications

### Session 2026-10-05

- Q: ¿Qué debe hacer la respuesta de `POST /sync/whoscored` respecto del conteo de matching, dado que no existe ningún paso de matching en el sistema? → A: Quitar el conteo de matching de esta feature; la respuesta incluye solo equipos, jugadores, clasificaciones y partidos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Disparar la sincronización de WhoScored a demanda (Priority: P1)

Quien opera la plataforma quiere actualizar el catálogo de jugadores (equipos y planteles) sin esperar a la corrida semanal. Hace un POST al endpoint de WhoScored con una ApiKey válida y recibe de inmediato un `runId`. El sistema ejecuta en background el mismo proceso que ya corre semanalmente; consultando `GET /sync/whoscored/{runId}` se obtiene el resumen de lo actualizado una vez que termina.

**Why this priority**: Es el caso de uso que motiva la feature. Sin el disparo manual, cualquier corrección de datos depende del calendario semanal.

**Independent Test**: Con una ApiKey válida, hacer POST a `/sync/whoscored` y verificar que la respuesta es `202` con un `runId`; consultar `GET /sync/whoscored/{runId}` hasta que el estado sea `completed` y verificar que el resumen (cantidad de equipos y jugadores actualizados) coincide con los cambios reflejados en el catálogo.

**Acceptance Scenarios**:

1. **Given** una ApiKey válida, **When** se hace POST a `/sync/whoscored`, **Then** el sistema responde `202` con un `runId` y arranca la sincronización en background; **When** se consulta `GET /sync/whoscored/{runId}` tras completarse, **Then** el resumen incluye equipos y jugadores actualizados.
2. **Given** una sincronización que ya actualizó datos, **When** se dispara de nuevo, **Then** la respuesta refleja los conteos de esa corrida, no los acumulados.
3. **Given** que la corrida semanal (`@Cron`) sigue programada, **When** se usa el endpoint, **Then** la programación semanal no cambia.

---

### User Story 2 - Disparar la sincronización de Football-Data a demanda (Priority: P1)

Mismo caso de uso que US1, para el proceso de Football-Data (clasificaciones y partidos de las ligas soportadas). Se hace POST a `/sync/football-data` con una ApiKey válida y se recibe el resumen de lo sincronizado.

**Why this priority**: Igual que US1: sin el disparo manual, los datos de clasificación y partidos dependen del calendario semanal.

**Independent Test**: Con una ApiKey válida, hacer POST a `/sync/football-data` y verificar que la respuesta contiene el resumen por liga y que las clasificaciones y partidos reflejan esos cambios.

**Acceptance Scenarios**:

1. **Given** una ApiKey válida, **When** se hace POST a `/sync/football-data`, **Then** el sistema ejecuta la sincronización de todas las ligas y responde con un resumen por liga.
2. **Given** que una liga falla en la sincronización, **When** se completa la corrida, **Then** el resumen indica esa liga como fallida y las demás aparecen con sus conteos.

---

### User Story 3 - Los endpoints rechazan requests sin ApiKey válida (Priority: P2)

Cualquier request a los endpoints de sincronización sin una ApiKey válida se rechaza antes de ejecutar nada.

**Why this priority**: Evita que un cliente anónimo dispare procesos que consultan proveedores externos.

**Independent Test**: Hacer POST a cada endpoint sin header, con una clave inexistente y con una clave revocada; verificar 401 y que ninguna sincronización arranca.

**Acceptance Scenarios**:

1. **Given** una request sin header `x-api-key`, **When** se hace POST a cualquiera de los dos endpoints, **Then** la respuesta es 401 y no se ejecuta ninguna sincronización.
2. **Given** una ApiKey revocada, **When** se usa en uno de los endpoints, **Then** la respuesta es 401.
3. **Given** un JWT válido sin ApiKey, **When** se hace POST a un endpoint de sincronización, **Then** la respuesta es 401: un JWT no alcanza.

---

### User Story 4 - El resumen nunca es una respuesta vacía (Priority: P2)

La respuesta final de cada corrida —el POST en football-data, el GET de estado en whoscored una vez que termina— siempre describe lo que pasó, incluso cuando algo falló. Un cuerpo vacío no sirve para confirmar que la corrida funcionó.

**Why this priority**: Sin resumen, quien dispara no puede distinguir entre una corrida exitosa y una que no hizo nada.

**Independent Test**: Disparar la sincronización con el proveedor caído (o simulado) y verificar que la respuesta final —directa en football-data, vía GET de estado en whoscored— indica las unidades fallidas en lugar de un cuerpo vacío.

**Acceptance Scenarios**:

1. **Given** una corrida exitosa, **When** termina, **Then** la respuesta incluye el resumen con conteos.
2. **Given** una corrida parcial (algunas ligas o equipos fallaron), **When** termina, **Then** la respuesta incluye los conteos de lo que sí se sincronizó y la lista de lo que falló.
3. **Given** una corrida en la que nada se actualizó, **When** termina, **Then** la respuesta incluye los conteos en cero, no un cuerpo vacío.

---

### Edge Cases

- **Corrida manual que coincide con la corrida semanal del `@Cron`**: un lock en memoria por feature evita que corran concurrentemente. Si la manual llega segunda, se rechaza con `409 Conflict`. Si es el `@Cron` el que intenta disparar mientras la manual sigue en curso, se salta esa ejecución y queda logueada — no hay respuesta HTTP que devolver en ese caso.
- **Matching**: no existe ningún paso de matching en el sistema; la respuesta no incluye ningún conteo de matching (ver Clarifications).
- **Proveedor externo caído**: la corrida no se aborta por completo; la respuesta lista las unidades fallidas (criterio ya establecido en 006 y 007).
- **Disparo manual mientras una corrida anterior sigue en curso (manual o del `@Cron`)**: se rechaza con `409 Conflict` de inmediato, sin encolarse.
- **Request con body**: el body no tiene campos esperados; cualquier campo adicional se rechaza por la validación global de DTO, igual que en el resto de la API.
- **ApiKey de un usuario con rol `user`**: el endpoint la acepta. El control de acceso por rol queda fuera de alcance (ver Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST exponer `POST /sync/whoscored` que dispara la misma sincronización que la corrida semanal de WhoScored.
- **FR-002**: El sistema MUST exponer `POST /sync/football-data` que dispara la misma sincronización que la corrida semanal de Football-Data.
- **FR-003**: Ambos endpoints MUST ejecutar el service de sincronización ya existente de su feature; no MUST contener lógica de sincronización propia.
- **FR-004**: El horario y la frecuencia del `@Cron` de cada feature MUST seguir sin cambios — no se desactiva ni se reprograma. Su implementación sí se modifica para respetar el lock de FR-015 (saltarse la ejecución si ya hay una corrida en curso), sin alterar cuándo se dispara.
- **FR-005**: Los tres endpoints (`POST /sync/whoscored`, `GET /sync/whoscored/:runId` y `POST /sync/football-data`) MUST exigir una ApiKey válida en el header `x-api-key`, y MUST NOT aceptar JWT como alternativa.
- **FR-006**: Una request sin ApiKey válida (ausente, inexistente o revocada) a cualquiera de los tres endpoints MUST responder 401; en los dos POST, MUST NOT iniciar ninguna sincronización, y en el GET, MUST NOT revelar el estado de ninguna corrida.
- **FR-007**: `POST /sync/whoscored` MUST responder `202 Accepted` de inmediato, con un `runId` que identifica la corrida — sin el resumen final en esa respuesta.
- **FR-008**: La respuesta de `POST /sync/football-data` MUST incluir un resumen por liga con: cantidad de clasificaciones actualizadas, cantidad de partidos actualizados, y las ligas que fallaron.
- **FR-009**: Una respuesta exitosa o parcial MUST NOT ser un cuerpo vacío. No aplica al `202` inicial de whoscored, que no es una respuesta de corrida completa sino un acuse de recibo (`runId`, `status`).
- **FR-010**: Si la sincronización termina con unidades fallidas, la respuesta MUST listar esas unidades y MUST devolver el resto de los conteos. En WhoScored, una corrida que llega al final con unidades fallidas queda en estado `completed` (con esas unidades listadas); el estado `failed` se reserva para una corrida que no pudo terminar por un error que la abortó por completo.
- **FR-011**: Ninguno de los tres endpoints MUST tener pantalla en el frontend.
- **FR-012**: Los endpoints MUST quedar documentados en Swagger y en la colección de Postman del proyecto.
- **FR-013**: El resumen de `POST /sync/whoscored` NO MUST incluir conteos de matching: el matching no existe en el sistema (ver Clarifications, sesión 2026-10-05). Si se define en una feature futura, esa feature agrega el campo.
- **FR-014**: El sistema MUST exponer `GET /sync/whoscored/:runId`, que devuelve el estado de la corrida (`running`, `completed` o `failed`) y, cuando el estado es `completed` o `failed`, el resumen con los conteos y las unidades fallidas.
- **FR-015**: Si ya hay una sincronización en curso de la misma feature (disparada manualmente o por el `@Cron`), ningún otro intento MUST iniciar una nueva corrida mientras esa siga en curso. Un intento manual que llega en ese momento MUST responder `409 Conflict` con un mensaje explícito indicando que ya hay una corrida en curso; en whoscored, ese cuerpo MUST incluir también el `runId` de la corrida en curso, para que quien lo disparó pueda consultar `GET /sync/whoscored/{runId}` en vez de quedarse sin ninguna referencia. Si es el `@Cron` el que intenta disparar mientras hay una corrida manual en curso, esa ejecución programada MUST saltarse y quedar registrada en el log como advertencia, sin reintentar antes del próximo horario programado.

### Key Entities *(include if feature involves data)*

- **Resumen de sincronización WhoScored**: conteos de equipos y jugadores actualizados, más la lista de unidades (liga o equipo) fallidas. Es una respuesta, no se persiste.
- **Resumen de sincronización Football-Data**: por liga, conteos de clasificaciones y partidos actualizados, más la lista de ligas fallidas. Es una respuesta, no se persiste.
- **Estado de corrida de WhoScored**: `runId`, `status` (`running` / `completed` / `failed`), conteos y unidades fallidas cuando termina. Vive en memoria del proceso, no se persiste — se pierde si el servidor reinicia a mitad de una corrida (ver Decisiones de diseño).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las requests a los endpoints de sincronización (incluido el GET de estado) sin ApiKey válida se rechazan con 401 sin que se inicie ninguna sincronización ni se revele el estado de una corrida.
- **SC-002**: El 100% de las respuestas que informan un resultado final —la del POST en football-data, la del GET de estado en whoscored una vez completada— incluyen un resumen con conteos; ninguna responde con cuerpo vacío. No aplica al 202 inicial de whoscored, que es solo un acuse de recibo.
- **SC-003**: Tras un disparo manual exitoso, los datos del catálogo reflejan los cambios que el resumen informa.
- **SC-004**: La programación semanal existente se mantiene: el `@Cron` sigue registrado y disparando en su horario en el 100% de los casos. Si al dispararse ya hay una corrida manual en curso, esa ejecución se salta y queda logueada — eso no cuenta como una falla de la programación.
- **SC-005**: Quien dispara puede distinguir si una corrida fue completa, parcial o sin cambios: leyendo la respuesta del POST en football-data, o la respuesta del GET de estado una vez que la corrida de whoscored termina.

## Assumptions

- Las features `006-whoscored-catalog-sync` y `007-football-data-integration` están implementadas, y sus services de sincronización son la única fuente de la lógica que se dispara.
- **Método nuevo, no cambio de tipo de retorno**: el método que ya usa el `@Cron` (`sync()` en whoscored, el equivalente en football-data) conserva su firma `Promise<void>` sin cambios, porque tests existentes dependen de ella (ver plan.md, decisión D1). Se agrega un método nuevo (`startManualRun()` en whoscored; el equivalente síncrono en football-data) que ejecuta la misma lógica interna y sí devuelve el resumen. La lógica de sincronización en sí no cambia (ver Fuera de alcance).
- Los controllers de WhoScored y Football-Data no existen hoy: se crean en esta feature, uno por proveedor, cada uno con su endpoint de sincronización.
- El volumen estimado por corrida es el documentado en `006` (2500 a 3000 páginas de estadísticas de jugadores, más planteles y listas de equipos). Se usa esa cifra como referencia, no la de la descripción de la feature.
- **Control de acceso**: el pedido exige ApiKey, no JWT, y deja fuera cualquier control más fino. Por eso cualquier usuario con una ApiKey válida puede disparar la sincronización, sin importar su rol. Esto es una decisión de alcance, no un descuido: consume cuota de los proveedores externos y queda registrada como consecuencia (ver Riesgos aceptados).
- WhoScored es asincrónico (202 + runId + GET de estado); football-data sigue sincrónico — decidido en base al volumen real de cada corrida (ver Decisiones de diseño), no queda pendiente para `/speckit-plan`.
- Ninguna pantalla de frontend se agrega ni se modifica.

## Decisiones de diseño

### Por qué ApiKey y no JWT

Son operaciones administrativas que no dependen de qué usuario las dispara. Una ApiKey identifica una credencial de acceso programático, que es el mismo mecanismo que ya usan las integraciones del sistema. No hace falta identificar a una persona para ejecutar la sincronización, y por el mismo motivo estas operaciones no tienen pantalla: se usan desde Swagger o Postman, no desde la app de usuario final. Usar JWT obligaría a iniciar sesión en un flujo pensado para operaciones de integración.

### Por qué 202 para whoscored y sincrónico para football-data

Una corrida de football-data son 10 requests (2 por liga × 5 ligas) con 7 segundos de espera entre cada una por el límite de 10 req/min del plan free — unos 70 segundos en total, razonable para una respuesta HTTP. Una corrida de whoscored son 2500 a 3000 páginas scrapeadas una por una, contra un sitio con rate-limiting por IP y protección de Cloudflare que ya bloqueó requests antes — puede tardar varios minutos, demasiado para sostener una conexión abierta.

### Por qué un lock en memoria en vez de aceptar la superposición

La spec 006 (research §6) documentó que dos corridas de whoscored solapadas corrompen datos en silencio (estado de instancia pisado entre corridas, métricas en `null` sin ningún error visible). Del lado de football-data, una superposición rompe el espaciado de 7s entre requests y puede generar 429 — ya observado en corridas semanales. Un lock por feature, con bandera en memoria liberada en un `finally`, evita los dos casos sin necesitar infraestructura nueva.

## Riesgos aceptados

- **Cualquier ApiKey válida dispara la sincronización**: como consecuencia de no agregar control de acceso por rol, una ApiKey de un usuario `user` puede consumir la cuota de WhoScored y Football-Data. Se acepta por alcance; si cambia, la corrección es usar el guard de admin ya existente (spec 008) en estos dos endpoints.

## Fuera de alcance

- Cualquier cambio a qué datos se sincronizan o a cómo se obtienen y actualizan en WhoScored y Football-Data (consultas al proveedor, reglas de actualización). Quedan fuera solo los cambios de esa lógica; sí entran el retorno de conteos y el lock de FR-015 (ver Assumptions).
- Un endpoint unificado para ambas sincronizaciones: cada feature conserva su propio endpoint, su adapter y su service.
- Control de acceso por rol en los endpoints (ver Assumptions).
- Pantallas de frontend para disparar o consultar la sincronización.
</content>
