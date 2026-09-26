# Research: Frontend — Autenticación

## R-001 Tailwind CSS v4 — Configuración de tokens de color

**Decision**: Los tokens de color (`background`, `foreground`, `primary`, `secondary`, `accent`)
se declaran en `frontend/src/index.css` usando la directiva `@theme` de Tailwind v4, NO
en `tailwind.config.js`. En Tailwind v4, el archivo `.js` de config queda solo para
`content` y plugins; la customización de tokens va íntegramente en CSS.

```css
/* frontend/src/index.css */
@import "tailwindcss";

@theme {
  --color-background: #f5fbef;
  --color-foreground: #443545;
  --color-primary:    #2a6041;
  --color-secondary:  #6ab547;
  --color-accent:     #fb8b23;
}
```

Esto genera automáticamente clases como `bg-primary`, `text-foreground`, `border-secondary`, etc.

**Rationale**: La API de `@theme` es la forma canónica de extender tokens en v4. Usar
`tailwind.config.js` para colores en v4 requiere activar el modo de compatibilidad
(`@config`) y es un antipatrón que el equipo de Tailwind desaconseja explícitamente
a partir de v4.

**Alternatives considered**:
- Mantener `tailwind.config.js` con `theme.extend.colors` + `@config` en el CSS:
  funciona, pero añade una capa de compatibilidad innecesaria y genera confusión sobre
  cuál es la fuente de verdad de los tokens.

**Note**: El `tailwind.config.js` existente se simplifica a solo `content` + `plugins`,
o se elimina si no hay plugins, porque en v4 con el plugin de Vite la detección de
archivos también puede configurarse con `@source` en el CSS.

---

## R-002 React Router — Versión y modo

**Decision**: `react-router-dom` v7 (compatible con React 19). Se usa el modo
`createBrowserRouter` + `RouterProvider` (la API moderna basada en objetos, no `<BrowserRouter>`),
que facilita loaders y es la recomendación oficial para apps nuevas.

**Rationale**: v7 es la versión estable para React 19. La API de objetos permite
definir la jerarquía de rutas una sola vez en `App.tsx` o en un archivo dedicado
en `routes/`, aislando la lógica de protección en `components/ProtectedRoute.tsx`
sin necesidad de wrappers en cada página.

**Alternatives considered**:
- v6 con `<BrowserRouter>`: funciona pero no recibe nuevas features; v7 es el sucesor directo.

---

## R-003 Emisor de eventos para 401 — Desacoplamiento service ↔ contexts

**Decision**: `service/httpClient.ts` crea un `EventTarget` singleton exportado como
`httpEvents` y despacha un evento `'unauthorized'` cuando detecta un 401 en la
respuesta. `AuthContext` se suscribe a `httpEvents` en un `useEffect` y actualiza su
estado (limpia el token y marca `isAuthenticated = false`). El redirect a `/login` lo
hace `ProtectedRoute` al detectar que `isAuthenticated` es `false`, no el emisor.

```ts
// service/httpClient.ts  (simplificado)
export const httpEvents = new EventTarget();

// en el interceptor de respuesta:
if (status === 401) {
  authStorage.clearToken();
  httpEvents.dispatchEvent(new Event('unauthorized'));
}
```

```ts
// contexts/AuthContext.tsx  (simplificado)
useEffect(() => {
  const handler = () => setIsAuthenticated(false);
  httpEvents.addEventListener('unauthorized', handler);
  return () => httpEvents.removeEventListener('unauthorized', handler);
}, []);
```

**Rationale**: `EventTarget` es nativo del browser, sin dependencias adicionales.
El flujo de dependencias se mantiene limpio: `service/` nunca importa `contexts/`;
`contexts/` importa solo el emisor (`httpEvents`), no el httpClient completo ni los
servicios de negocio.

**Alternatives considered**:
- Callback inyectado en httpClient al inicializar la app: funciona pero acopla
  el punto de entrada (main.tsx) a la lógica de autenticación.
- Estado global (Zustand, Jotai): innecesario para un booleano de sesión; añade
  una dependencia de estado compleja para un problema simple.

---

## R-004 Vitest + React Testing Library — Setup para tests de componentes

**Decision**: Vitest como runner, `@testing-library/react` + `@testing-library/user-event`
para tests de componentes. Entorno JSDOM (`environment: 'jsdom'` en `vitest.config.ts`).
`@testing-library/jest-dom` para matchers adicionales (toBeInTheDocument, etc.),
importado globalmente en `frontend/test/setup.ts`.

Tests de componentes **sin** cliente de API: co-located junto al archivo (`*.spec.tsx`).
Tests de componentes **con** cliente de API real: en `frontend/test/` con
`globalSetup`/`globalTeardown` de Vitest que levantan la DB efímera y el backend NestJS.

**Rationale**: Vitest es el runner nativo del ecosistema Vite; no requiere transpilación
adicional. El entorno JSDOM simula el DOM sin browser real, suficiente para tests de
componentes. La separación co-located / `frontend/test/` sigue la Constitución v1.7.0.

**Packages to add**:
```
vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event
@testing-library/jest-dom jsdom @types/node
```

---

## R-005 globalSetup de Vitest — Arrancar el backend NestJS real

**Decision**: El `globalSetup` de Vitest (`frontend/test/setup/global-setup.ts`) hace:
1. Levanta una instancia PostgreSQL efímera con Testcontainers (`@testcontainers/postgresql`).
2. Arranca el proceso del backend NestJS (`node dist/main`) apuntando a esa base.
3. Espera el health-check del backend (`GET /health`) hasta que responde 200.
4. Escribe la URL del backend en una variable de entorno de proceso (`VITE_API_BASE_URL`)
   para que los tests la lean.
5. `globalTeardown` para el proceso y destruye el contenedor.

**Variable de entorno en tests**: `VITE_TEST_API_URL` (distinta de `VITE_API_BASE_URL`
de desarrollo). Los tests la leen directamente; el httpClient la inyecta como
`import.meta.env.VITE_API_BASE_URL` solo en producción/dev; en tests se pasa al
inicializar el cliente.

**Packages needed in frontend**: `@testcontainers/postgresql` (ya disponible en el
workspace de pnpm del monorepo).

**Rationale**: Mismo patrón que el backend (Testcontainers + globalSetup), consistente
con la Constitución v1.7.0. Arrancar el backend NestJS compilado (dist/) evita
depender de ts-node en los tests.

---

## R-006 Estructura de directorios — Limpieza del scaffold existente

El frontend ya tiene directorios creados que difieren de la nomenclatura de la
Constitución v1.7.0. Mapa de renombrado:

| Existente | Constitución v1.7.0 | Acción |
|-----------|-------------------|--------|
| `src/api/` | eliminado (`api/` no existe en la constitución) | Eliminar; el cliente pasa a `src/service/` |
| `src/services/` | `src/service/` | Renombrar a `service/` |
| `src/layouts/` | `src/layout/` | Renombrar a `layout/` |
| `src/context/` | `src/contexts/` | Renombrar a `contexts/` |
| `src/routes/` | no es una capa propia — lógica de rutas va en `App.tsx` | Eliminar; `ProtectedRoute` va en `components/` |
| `src/hooks/` | `src/hooks/` | ✅ ya correcto |
| `src/pages/` | `src/pages/` | ✅ ya correcto |
| `src/types/` | `src/types/` | ✅ ya correcto |
| `src/utils/` | `src/utils/` | ✅ ya correcto |
| `src/assets/` | `src/assets/` | ✅ ya correcto |
| `src/components/` | `src/components/` | ✅ ya correcto |
| `src/config/` | no es una capa propia | Contenido migrar a `service/` o `types/` según el caso |

**Rationale**: Mantener la estructura de la Constitución desde el inicio evita deuda
técnica acumulada y hace que el test de arquitectura no tenga excepciones que perdonar
retroactivamente.

**Actualización (2026-09-25)**: el test de arquitectura mencionado como "futuro" ya no lo
es — ver `frontend/src/architecture.spec.ts` (mismo espíritu que `tsarch` en el backend),
agregado al refactorizar las 5 páginas que todavía llamaban `service/*` directo
(`AccountPage`, `CatalogPage`, `LoginPage`, `PlayerDetailPage`, `RegisterPage`) para que
pasen a hacerlo a través de un hook (`useAuthActions`, `useCatalog`, `useApiKey`). El
enforcement de "hooks/ y contexts/ — únicas capas que MUST invocar service/" ya no depende
sólo de la revisión manual de código: ese test corre en `pnpm test:unit` / CI y falla si
`components/`, `pages/` o `layout/` vuelven a importar `service/` directamente.

---

## R-007 ESLint — Override no-restricted-imports / no-restricted-globals

**Decision**: Añadir una sección `overrides` al `eslint.config.js` existente que aplica
`no-restricted-imports` (axios) y `no-restricted-globals` (fetch) solo a los archivos
en `components/**`, `pages/**` y `layout/**`. Las capas `service/`, `hooks/` y
`contexts/` quedan excluidas de esa restricción.

```js
// eslint.config.js — configuración adicional
{
  files: ['src/components/**/*.{ts,tsx}', 'src/pages/**/*.{ts,tsx}', 'src/layout/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', { paths: [{ name: 'axios', message: 'Usar el cliente httpClient de service/' }] }],
    'no-restricted-globals': ['error', { name: 'fetch', message: 'Usar el cliente httpClient de service/' }],
  },
},
```

**Rationale**: ESLint como guardia estático de la regla arquitectural de la Constitución.
Falla en CI si un componente intenta llamar directamente a la red (`axios`/`fetch`), sin
esperar a una revisión de código.

**Actualización (2026-09-25)**: este override de ESLint sólo cubre `axios`/`fetch` crudos;
no detectaba que una página importara un módulo de `service/` (p. ej. `authService`,
`catalogService`) y lo llamara directo, sin pasar por un hook — que es exactamente lo que
pedía la letra de "hooks/ y contexts/ — únicas capas que MUST invocar service/". Ese hueco
quedaba explícitamente delegado a "el test de arquitectura (futuro)" (ver R-006). Ya no es
futuro: `frontend/src/architecture.spec.ts` audita `components/`, `pages/` y `layout/` y
falla si alguno importa `service/` (relativo o vía alias `@/service/`) directamente. Las 5
páginas que lo hacían (`AccountPage`, `CatalogPage`, `LoginPage`, `PlayerDetailPage`,
`RegisterPage`) se refactorizaron para usar `useAuthActions`, `useCatalog` y `useApiKey` en
su lugar. El override de ESLint de arriba se mantiene igual, como defensa adicional contra
`axios`/`fetch` crudos.

---

## R-008 Diseño visual — Inspiración Boca Juniors adaptada a la paleta propia

**Decision**: El diseño sigue la estructura de maquetación de bocajuniors.com.ar:
- **Header** sólido con `bg-primary` (verde oscuro #2a6041), tipografía `font-black uppercase`
  en blanco, logo/nombre de la app a la izquierda, acciones (logout) a la derecha.
- **Contenedores** con bordes bien definidos, `rounded-none` o `rounded-md`, alto
  contraste entre fondo (`bg-background` #f5fbef) y texto (`text-foreground` #443545).
- **Títulos de sección** contundentes: `text-2xl font-black uppercase tracking-wide`.
- **CTAs principales** (botón Generar ApiKey): `bg-accent text-white` (#fb8b23).
- **Acciones primarias** (Iniciar sesión, Registrarse): `bg-primary text-white`.
- **Estados de éxito** (clave generada): `text-secondary` (#6ab547).
- **Errores**: rojo por defecto de Tailwind (`text-red-600`), fuera de la paleta de 5.
- **Responsive**: breakpoints de Tailwind (`sm:`, `md:`, `lg:`), sin detección custom de pantalla.

**Rationale**: La identidad visual deportiva de alta densidad encaja con el dominio
(valuación de jugadores); la paleta propia diferencia el proyecto del original sin
copiar su marca.

---

## R-009 React 19 — Metadatos de página sin react-helmet

**Decision**: Usar el soporte nativo de React 19 para `<title>` y `<meta>` renderizados
directamente en los componentes de página. React 19 eleva automáticamente estos tags al
`<head>` del documento.

```tsx
// Ejemplo en LoginPage.tsx
export function LoginPage() {
  return (
    <>
      <title>Iniciar sesión — DesApp</title>
      <meta name="description" content="Accedé a tu cuenta de valuación de jugadores." />
      {/* ... resto del JSX */}
    </>
  );
}
```

**Rationale**: Elimina la dependencia de `react-helmet-async`; es la solución oficial
de React 19 para SSR-compatible metadata.

