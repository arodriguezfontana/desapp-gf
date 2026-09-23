# UI Contracts & Route Specs — Frontend Catálogo de Jugadores

**Feature**: `005-frontend-player-catalog` | **Date**: 2026-09-20
**Spec**: [spec.md](../spec.md) | **Data Model**: [data-model.md](../data-model.md)

---

## 1. Rutas de Navegación (`src/routes/router.tsx`)

| Ruta | Componente | Acceso / Guard | Descripción |
| --- | --- | --- | --- |
| `/` | Redirect to `/catalog` | Público | Redirección por defecto |
| `/catalog` | `CatalogPage` | Requiere ApiKey guardada en UI | Listado paginado de jugadores con filtros |
| `/catalog/:id` | `PlayerDetailPage` | Requiere ApiKey guardada en UI | Vista de detalle de jugador puntual |
| `/account` | `AccountPage` | ProtectedRoute (JWT) | Gestión de cuenta y emisión de ApiKey |

---

## 2. Servicios Frontend (`src/service/`)

### `apiKeyStorage.ts`
- `getApiKey(): string | null`
- `setApiKey(key: string): void`
- `clearApiKey(): void`

### `httpClient.ts` (Modo Dual JWT / ApiKey)
- `get<T>(url: string, options?: { useApiKey?: boolean }): Promise<T>`
  - Si `useApiKey: true`: incluye header `X-Api-Key: <key>` de `apiKeyStorage.getApiKey()`.
  - Si la respuesta es 401 en modo ApiKey: llama a `apiKeyStorage.clearApiKey()` y emite `httpEvents.dispatchEvent(new Event('apiKeyUnauthorized'))`.
- `post<T>(url: string, body: unknown, options?: { useApiKey?: boolean }): Promise<T>`

### `catalogService.ts`
- `getPlayers(params: { page?: number; league?: string; team?: string; position?: string }): Promise<PlayerListResponseDto>`
  - Ejecuta `httpClient.get<PlayerListResponseDto>('/players?...', { useApiKey: true })`.
- `getPlayerById(id: string): Promise<Player>`
  - Ejecuta `httpClient.get<Player>(`/players/${id}`, { useApiKey: true })`.

---

## 3. Contratos de Componentes UI

### `src/pages/CatalogPage.tsx`
- **Renderizado**:
  - Si `!apiKeyStorage.getApiKey()`: Banner de aviso con texto `"Necesitás generar una ApiKey para ver el catálogo."` y link a `/account`.
  - Si `hasApiKey`: Barra de filtros (Select Liga, Input Equipo con debounce 400ms, Select Posición), Grilla/Lista de Jugadores, Paginación (Botones Anterior / Siguiente, Rango visible y Total).
  - Si respuesta vacía 200 OK: Muestra texto `"No se encontraron jugadores con estos filtros."`.

### `src/pages/PlayerDetailPage.tsx`
- **Renderizado**:
  - Si `!apiKeyStorage.getApiKey()`: Mismo banner de aviso con link a `/account`.
  - Si 404 del backend: Muestra el mensaje del backend en el cuerpo de la página tal cual llegó.
  - Si exitoso: Ficha deportiva con nombre, liga, equipo y posición. Botón "Volver al catálogo".

