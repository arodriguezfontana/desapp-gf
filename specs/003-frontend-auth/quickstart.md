# Quickstart: Frontend — Autenticación

Guía de validación manual para verificar que la feature funciona de extremo a extremo.

## Prerrequisitos

- Docker corriendo (para Testcontainers en tests y para la base de datos local de desarrollo)
- Backend (feature 001 + 002) mergeado y compilable
- Node 20 y pnpm instalados
- Variables de entorno configuradas en `frontend/.env`:
  ```
  VITE_API_BASE_URL=http://localhost:3000
  ```

## Setup

```bash
# Desde la raíz del monorepo
cd backend && pnpm build           # compilar el backend (necesario para los tests de integración)
cd ../frontend && pnpm install     # instalar dependencias del frontend (incluye react-router-dom, vitest, RTL)
```

## Validación 1: Desarrollo local (manual)

```bash
# Terminal 1: levantar la base y el backend
cd backend && pnpm start:dev

# Terminal 2: levantar el frontend
cd frontend && pnpm dev
```

Abrir `http://localhost:5173` y verificar:

| Escenario | Pasos | Resultado esperado |
|-----------|-------|--------------------|
| Registro exitoso | Ir a `/register` → ingresar email nuevo + contraseña válida → enviar | Redirect a `/login` |
| Registro email duplicado | Repetir el mismo email → enviar | Banner con mensaje exacto del backend |
| Login exitoso | Ir a `/login` → credenciales válidas → enviar | Redirect a `/home` |
| Login inválido | Credenciales incorrectas → enviar | Mensaje genérico `"Credenciales inválidas."` |
| Ruta protegida sin sesión | Ir a `/home` sin estar logueado | Redirect a `/login` |
| 401 en vuelo | Manipular localStorage para dejar un JWT inválido → navegar a `/home` y esperar la primera request | Redirect automático a `/login` |
| Logout | Estar logueado → clic en "Cerrar sesión" | Token borrado, redirect a `/login` |
| Generar ApiKey (primera vez) | Logueado → ir a `/account` → clic "Generar ApiKey" | Modal con clave en texto plano + aviso |
| Generar ApiKey (segunda vez) | En `/account` → clic "Generar ApiKey" de nuevo | Diálogo de confirmación → confirmar → modal con nueva clave |
| Clave no persiste | Cerrar modal de ApiKey → recargar página → ir a `/account` | No aparece ninguna clave mostrada |
| Build de producción | `pnpm build` | Termina sin errores |

## Validación 2: Tests de componentes sin backend (co-located)

```bash
cd frontend && pnpm test:unit
```

Verifica:
- `RegisterPage` renderiza el formulario y muestra errores del servidor
- `LoginPage` renderiza el formulario y muestra mensaje genérico en 401
- `ProtectedRoute` redirige a `/login` cuando `isAuthenticated = false`
- `ApiKeyModal` muestra la clave y el botón de copiar
- `ConfirmDialog` muestra la advertencia y emite los eventos correctos
- `authStorage` lee/escribe/borra correctamente de localStorage

## Validación 3: Tests contra backend real (Testcontainers)

```bash
cd frontend && pnpm test:integration
```

Levanta automáticamente:
1. PostgreSQL efímero con Testcontainers
2. Backend NestJS compilado apuntando a esa base
3. Ejecuta los tests que llaman a `authService` contra el backend real

Verifica:
- `authService.register()` persiste el usuario y devuelve 201
- `authService.login()` con credenciales válidas devuelve el JWT
- `authService.login()` con credenciales inválidas devuelve 401
- `authService.generateApiKey()` con JWT válido devuelve la clave
- `authService.generateApiKey()` sin JWT devuelve 401
- Un segundo `generateApiKey()` invalida la primera clave

## Validación 4: Build de producción

```bash
cd frontend && pnpm build
```

Debe terminar sin errores de TypeScript ni de Vite. El directorio `dist/` generado
contiene los assets estáticos listos para servir.

## Variables de entorno

| Variable | Ámbito | Descripción |
|----------|--------|-------------|
| `VITE_API_BASE_URL` | Dev + build | URL base del backend (`http://localhost:3000`) |
| `VITE_TEST_API_URL` | Tests de integración | URL del backend NestJS efímero, inyectada por el `globalSetup` de Vitest |

## Estructura de archivos creada por esta feature

```
frontend/
├── .env.example                     ← VITE_API_BASE_URL añadida
├── tailwind.config.js               ← simplificado (tokens de color pasan a index.css @theme)
├── eslint.config.js                 ← override no-restricted-imports/globals añadido
├── vitest.config.ts                 ← nuevo: config de Vitest + entorno jsdom
├── test/                            ← nuevo directorio
│   ├── setup.ts                     ← importa @testing-library/jest-dom
│   └── setup/
│       ├── global-setup.ts          ← levanta Postgres + NestJS (Testcontainers)
│       └── global-teardown.ts       ← para el backend y destruye contenedor
└── src/
    ├── index.css                    ← @import "tailwindcss" + @theme con los 5 colores
    ├── main.tsx                     ← envuelve App con AuthProvider + RouterProvider
    ├── App.tsx                      ← createBrowserRouter con rutas y ProtectedRoute
    ├── service/                     ← (renombrado de services/ + api/)
    │   ├── authStorage.ts
    │   ├── httpClient.ts            ← fetch nativo + httpEvents EventTarget
    │   └── authService.ts
    ├── contexts/                    ← (renombrado de context/)
    │   └── AuthContext.tsx
    ├── hooks/
    │   └── useAuth.ts
    ├── components/
    │   ├── ProtectedRoute.tsx
    │   ├── ConfirmDialog.tsx
    │   └── ApiKeyModal.tsx
    ├── layout/                      ← (renombrado de layouts/)
    │   └── AppLayout.tsx
    └── pages/
        ├── RegisterPage.tsx
        ├── LoginPage.tsx
        ├── HomePage.tsx
        └── AccountPage.tsx
```

