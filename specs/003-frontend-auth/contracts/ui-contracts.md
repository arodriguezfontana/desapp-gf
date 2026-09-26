# UI Contracts: Frontend — Autenticación

Este documento describe los contratos de interfaz de usuario: qué rutas existen, qué
componentes las sirven, qué props/estado exponen y qué interacciones producen.

---

## Rutas

| Ruta | Componente de página | Protegida | Redirección si no aplica |
|------|---------------------|-----------|--------------------------|
| `/register` | `RegisterPage` | No | Si hay sesión → `/home` |
| `/login` | `LoginPage` | No | Si hay sesión → `/home` |
| `/home` | `HomePage` | Sí | Sin sesión → `/login` |
| `/account` | `AccountPage` | Sí | Sin sesión → `/login` |
| `/` | — | — | Redirect a `/login` |

---

## Componente: `ProtectedRoute`

**Ubicación**: `frontend/src/components/ProtectedRoute.tsx`

**Propósito**: Envuelve rutas que requieren sesión. Si `useAuth().isAuthenticated` es
`false`, redirige a `/login`. Si es `true`, renderiza los hijos (`<Outlet />`).

```
Props: ninguna (lee useAuth() internamente)
Comportamiento:
  isAuthenticated = true  → <Outlet /> (renderiza la ruta hija)
  isAuthenticated = false → <Navigate to="/login" replace />
```

---

## Componente: `AppLayout`

**Ubicación**: `frontend/src/layout/AppLayout.tsx`

**Propósito**: Layout común para todas las páginas protegidas. Incluye el header con
nombre de la app, navegación a `/home` y `/account`, y botón de logout.

```
Props: ninguna
Slots: <Outlet /> para el contenido de página
Header:
  - Izquierda: nombre "DesApp" → link a /home
  - Derecha: link a /account + botón "Cerrar sesión" (llama useAuth().logout())
Estilo:
  - bg-primary text-white font-black uppercase
  - Header sticky/fixed en la parte superior
```

---

## Pantalla: `/register` — RegisterPage

**Propósito**: Alta de cuenta nueva.

### Formulario

| Campo | Tipo | Validación cliente | Mensaje de error |
|-------|------|-------------------|-----------------|
| `email` | `<input type="email">` | formato de email básico (nativa HTML5) | — |
| `password` | `<input type="password" maxLength={16}>` | 8 a 16 caracteres, 1 mayúscula, 1 minúscula, 1 número, 1 especial (misma política que `001-user-auth` FR-003 / `backend/src/domain/auth/password.ts`) | Mensaje inmediato de feedback (antes de enviar) |

### Estados

| Estado | UI |
|--------|----|
| `isLoading = false`, `error = null` | Formulario activo, botón habilitado |
| `isLoading = true` | Botón deshabilitado con texto "Registrando…" |
| `isLoading = false`, `error != null` | Banner de error con el mensaje exacto del backend |
| Éxito | Redirect a `/login` |

### Interacciones

- **Enviar formulario**: `authService.register(email, password)` → éxito → `navigate('/login')`.
- **Error del backend**: mostrar `error.message` textualmente, sin modificar.
- **Formulario inválido (validación cliente)**: mostrar feedback inmediato bajo el campo;
  el botón sigue habilitado (la validación definitiva es del backend).

---

## Pantalla: `/login` — LoginPage

**Propósito**: Autenticación con credenciales existentes.

### Formulario

| Campo | Tipo |
|-------|------|
| `email` | `<input type="email">` |
| `password` | `<input type="password">` |

### Estados

| Estado | UI |
|--------|----|
| `isLoading = false`, `error = null` | Formulario activo, botón habilitado |
| `isLoading = true` | Botón deshabilitado con texto "Ingresando…" |
| `isLoading = false`, `error != null` | Mensaje genérico: `"Credenciales inválidas."` (siempre igual, independiente del error real del backend) |
| Éxito | `authStorage.setToken(token)` → `setIsAuthenticated(true)` → redirect a `/home` |

### Interacciones

- **Enviar formulario**: `authService.login(email, password)` → éxito → guardar JWT →
  `navigate('/home')`.
- **Error 401**: mostrar mensaje genérico fijo (NO el mensaje del backend).

---

## Pantalla: `/home` — HomePage

**Propósito**: Destino post-login. Placeholder sin funcionalidad propia en esta feature.

### Estados

| Estado | UI |
|--------|----|
| Autenticado | Pantalla con header (AppLayout) y mensaje de bienvenida con título deportivo |

### Notas

- Renderizada dentro de `AppLayout` (hereda header + logout).
- Contenido mínimo: título "Bienvenido" o similar con el estilo visual de la app.
- No hace ninguna petición al backend en esta feature.

---

## Pantalla: `/account` — AccountPage

**Propósito**: Gestión de cuenta — visualización de datos del usuario y generación de ApiKey.

### Sección: Generación de ApiKey

**Máquina de estados de la UI** (ver data-model.md):

```
idle → [pulsa "Generar ApiKey"]
         ↓ (sin clave previa)          ↓ (con clave previa)
      generating                   ConfirmDialog visible (phase: 'confirming')
         ↓                               ↓ cancela → idle
      ApiKeyModal visible               ↓ confirma
      (phase: 'revealed')            generating
         ↓ cierra modal                  ↓
       idle                          ApiKeyModal visible
```

### Componente: `ConfirmDialog`

**Ubicación**: `frontend/src/components/ConfirmDialog.tsx`

```
Props:
  onConfirm: () => void
  onCancel:  () => void

UI:
  - Modal overlay con bg-foreground/50
  - Título: "¿Generar nueva ApiKey?"
  - Cuerpo: aviso de que la ApiKey anterior quedará invalidada
  - Botones: "Cancelar" (outline, secondary) | "Confirmar" (bg-accent text-white)
```

### Componente: `ApiKeyModal`

**Ubicación**: `frontend/src/components/ApiKeyModal.tsx`

```
Props:
  apiKey:    string  (texto plano, visible una sola vez)
  createdAt: string  (ISO-8601)
  onClose:   () => void

UI:
  - Modal overlay
  - Título: "Tu ApiKey" (font-black uppercase)
  - Aviso destacado: "Guardá esta clave ahora. No podrás volver a consultarla."
    (bg-accent/10 border border-accent text-foreground)
  - Input readonly con la clave (font-mono, texto seleccionable)
  - Botón "Copiar" → navigator.clipboard.writeText(apiKey) → feedback visual "¡Copiado!"
  - Botón "Cerrar" → onClose() → estado vuelve a 'idle'

Comportamiento al cerrar:
  - onClose() limpia el estado del componente padre
  - La clave NO se guarda en ningún lugar persistente
```

---

## Componente: `AuthContext` + `useAuth()`

**Ubicación**: `frontend/src/contexts/AuthContext.tsx`, `frontend/src/hooks/useAuth.ts`

```ts
interface AuthContextValue {
  isAuthenticated: boolean;
  login: (token: string) => void;    // setToken + setIsAuthenticated(true)
  logout: () => void;                // clearToken + setIsAuthenticated(false) + navigate('/login')
}
```

- Inicializado al montar: `isAuthenticated = authStorage.getToken() !== null`.
- Suscrito a `httpEvents 'unauthorized'`: limpia token y `setIsAuthenticated(false)`.
- `ProtectedRoute` detecta `isAuthenticated = false` y redirige a `/login`.

