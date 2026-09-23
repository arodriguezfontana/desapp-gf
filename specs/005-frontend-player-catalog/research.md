# Phase 0: Research — Frontend Catálogo de Jugadores

**Feature**: `005-frontend-player-catalog` | **Date**: 2026-09-20
**Spec**: [spec.md](./spec.md)

---

## Technical Decisions

### R-001: Soporte Dual JWT / ApiKey en `httpClient.ts` y almacenamiento en `apiKeyStorage.ts`

- **Decision**: Expandir `httpClient.ts` y crear `src/service/apiKeyStorage.ts` (con clave `api_key` en `localStorage`) para soportar peticiones autenticadas por `ApiKey` via header `X-Api-Key` además de las autenticadas por JWT (`Authorization: Bearer <token>`).
- **Rationale**: El backend de catálogo (`GET /players` y `GET /players/:id`) exige `X-Api-Key` y no acepta JWT (devuelve 401 ante JWT). Separar el almacenamiento de la ApiKey del token JWT permite que un usuario pueda consultar el catálogo sin sesión iniciada (siempre que tenga una ApiKey guardada previamente) y que la invalidación de una ApiKey (ante un 401 en `X-Api-Key`) no destruya la sesión JWT activa del usuario.
- **Alternatives Considered**:
  - *Usar un único storage para JWT y ApiKey*: Rechazado. Un 401 en el catálogo desloguearía al usuario de la aplicación.
  - *Pasar la ApiKey como parámetro en cada llamada*: Rechazado por Constitución v1.7.0 §Technology Stack (toda llamada HTTP al backend MUST pasar por un cliente de API propio que centraliza base URL, headers y manejo de errores).

---

### R-002: Manejo de Filtros y Debounce en `CatalogPage`

- **Decision**: Crear un custom hook `useDebounce` en `src/hooks/useDebounce.ts` para aplicar un retardo de 400ms al input de texto libre de `equipo`. Los selectores de `liga` (5 opciones fijas: Premier League, Bundesliga, La Liga, Serie A, Ligue 1) y `posicion` (4 opciones fijas: GK, DF, MF, FW) se aplican de forma inmediata al cambiar. Cualquier modificación en los filtros resetea la página actual a `1`.
- **Rationale**: Evita llamadas innecesarias al backend por cada tecla presionada en el filtro de equipo. El reseteo a la página 1 al cambiar cualquier filtro garantiza que el usuario nunca quede parado en una página inexistente de un subconjunto filtrado.
- **Alternatives Considered**:
  - *Librería externa como lodash.debounce*: Rechazada para mantener el bundle ligero y alineado con la regla de inputs controlados nativos.

---

### R-003: Comportamiento de Vistas ante Respuestas de API y ApiKey Faltante/Inválida

- **Decision**:
  1. **Sin ApiKey guardada** (o tras recibir un 401): No se realiza petición HTTP al backend. Se presenta un aviso de alerta con el texto exacto `"Necesitás generar una ApiKey para ver el catálogo."` y un enlace `<Link to="/account">` a la pantalla de cuenta.
  2. **401 Unauthorized**: Se llama inmediatamente a `apiKeyStorage.clearApiKey()`, no se reintenta la petición y se muestra el mismo mensaje de aviso con el enlace a `/account`.
  3. **200 OK con `[]`**: Se muestra la grilla vacía con la frase informativa `"No se encontraron jugadores con estos filtros."` en tipografía clara de banner informativo (no de error).
  4. **404 Not Found en `PlayerDetailPage`**: Se captura el `message` original del cuerpo de respuesta del backend y se renderiza en pantalla tal cual, sin redirecciones forzadas ni alteración de texto.
- **Rationale**: Satisface palabra por palabra los requisitos de spec.md y precondiciones de plan.md sin asumir o modificar mensajes de negocio.
- **Alternatives Considered**:
  - *Generar la ApiKey automáticamente en segundo plano si falta*: Rechazado explícitamente por los requisitos del usuario.

---

### R-004: Configuración de Rutas y Redirección Post-Login

- **Decision**:
  - Registrar dos rutas públicas a nivel de router en `src/routes/router.tsx`: `/catalog` (listado) y `/catalog/:id` (detalle).
  - Actualizar `src/pages/LoginPage.tsx` para que, tras un login exitoso, la navegación redirija a `/catalog` en lugar de `/home`.
  - `/catalog` se establece como ruta por defecto desde `/` en `router.tsx`.
- **Rationale**: Permite que cualquier usuario acceda a `/catalog` sin necesidad de un guard de sesión JWT, dejando el control de acceso en la presencia de la ApiKey guardada.
- **Alternatives Considered**:
  - *Envolver `/catalog` en `ProtectedRoute`*: Rechazado. El requerimiento establece explícitamente que el catálogo no requiere sesión iniciada, solo ApiKey válida.

---

### R-005: Estrategia de Testing de Integración contra Backend Real (Testcontainers)

- **Decision**: Escribir `frontend/test/catalog.spec.ts` utilizando Vitest + Testcontainers (PostgreSQL efímero + servidor NestJS real), cubriendo exactamente los 9 escenarios requeridos:
  1. Consulta sin ApiKey guardada → muestra aviso sin llamar a API.
  2. Consulta sin sesión JWT iniciada pero con ApiKey válida guardada → obtiene listado 200 OK.
  3. Listado completo sin filtros → retorna 20 jugadores paginados.
  4. Filtrado por cada una de las 5 ligas y 4 posiciones.
  5. Filtro combinado sin resultados → 200 OK con lista vacía y mensaje informativo.
  6. Navegación por páginas (página 1 vs página 2).
  7. Detalle de jugador existente → muestra datos completos.
  8. Detalle de jugador inexistente → 404 con mensaje original del backend.
  9. Consulta con ApiKey invalidad o revocada → 401 borra ApiKey y muestra mensaje con link.
- **Rationale**: Garantiza cumplimiento estricto del Principio IX de la Constitución v1.8.0.

