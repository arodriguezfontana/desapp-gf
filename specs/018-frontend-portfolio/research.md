# Research & Technical Decisions: Frontend — Portfolio personal

Este documento consolida las decisiones técnicas, patrones y justificaciones para la implementación de la vista de **Portfolio personal**, en estricto cumplimiento con la Constitución del proyecto y los requerimientos del usuario.

---

## 1. Organización por capas en Frontend

### Decisión
Estructurar el código frontend respetando estrictamente las capas exigidas por la Constitución y el requerimiento:
- `types/portfolio.ts`: Interfaces de datos (`Holding`, `PortfolioSummary`, `PortfolioResponse`).
- `service/portfolioService.ts`: Módulo de red que utiliza exclusivamente `httpClient` para comunicarse con `GET /users/:id/portfolio`.
- `hooks/usePortfolio.ts`: Custom hook que administra el ciclo de vida de la petición (estado `isLoading`, `error`, `data`, reintento `refetch`).
- `pages/PortfolioPage.tsx`: Vista de nivel de ruta que orquesta el layout y los estados (cargando, error, vacío, con datos).
- `components/PortfolioSummary.tsx` y `components/HoldingList.tsx`: Componentes de presentación desacoplados sin acceso a red.

### Justificación
- La Constitución (Technology Stack & Constraints y Principio IX) prohíbe llamadas HTTP desde componentes o vistas.
- Aislar el cliente de red en `service/` permite testear la capa de presentación y hooks con dobles en unit tests, a la vez que centraliza la URL y el manejo de headers de autorización.

### Alternativas consideradas
- *Invocar `httpClient` directamente desde `PortfolioPage`*: Rechazado por violar la regla de capas de la Constitución.
- *Manejar todo el estado en un Context global*: Rechazado porque los datos del portfolio son específicos de la vista `/portfolio` y no requieren ser compartidos con otros componentes distantes en el árbol.

---

## 2. Consumo de datos y patrón de consulta (Snapshot sin Polling)

### Decisión
La vista consulta `GET /users/:id/portfolio` una única vez al montarse (snapshot). No se implementará ningún mecanismo de polling (como `setInterval`, web workers o WebSockets) en segundo plano. Se provee un botón interactivo de "Reintentar" únicamente en caso de error de red.

### Justificación
- Las cotizaciones de los futbolistas se actualizan mediante jobs programados periódicos (semanales o manuales) en el backend.
- Eliminar el polling ahorra ancho de banda, consumo de CPU en el cliente y carga concurrente sobre la base de datos y la API.

### Alternativas consideradas
- *SWR o TanStack Query con auto-refetch cada 10s*: Rechazado explícitamente en la especificación y en el requerimiento del usuario (DD-001).

---

## 3. Autenticación, protección de rutas y manejo de 401

### Decisión
1. Proteger la ruta `/portfolio` envolviéndola en el componente `ProtectedRoute` existente dentro de `router.tsx`.
2. Incluir enlace al Portfolio en la barra de navegación de `AppLayout.tsx`, visible únicamente para usuarios autenticados (`isAuthenticated === true`).
3. El `httpClient` existente ya cuenta con un despachador de eventos `httpEvents.dispatchEvent(new Event('unauthorized'))` ante respuestas `401`. `AuthContext` escucha este evento, limpia el almacenamiento y el estado de sesión, provocando la redirección inmediata a `/login`.
4. Para errores no autorizados diferentes de 401 (ej. 500, problemas de red), `usePortfolio` captura el error y `PortfolioPage` renderiza un mensaje amigable con estilo de alerta estándar de Tailwind y opción de reintento.

### Justificación
- Reutiliza la infraestructura de seguridad existente sin duplicar lógica de tokens ni redirecciones manuales.

---

## 4. Estética, maquetación y paleta de colores

### Decisión
1. Reutilizar el layout general `AppLayout.tsx`.
2. Seguir la paleta base del sistema:
   - Background: `--color-background` (`#0b3332` / `#072221`).
   - Surfaces/Cards: `#104443` / `#0e3b3a` con bordes `#1a6866` o `#b79753`/30.
   - Textos principales: Blanco (`text-white`) con títulos de sección en tipografía pesada en mayúsculas (`font-black`, `uppercase`, `tracking-wider`).
3. Indicadores financieros de ganancia/pérdida:
   - Rendimiento positivo: Color secondary / positive (`#6ab547` o `#2dd4bf`), con signo `+` explícito.
   - Rendimiento negativo: Color de error/pérdida estándar de Tailwind (`text-red-500` / `#f43f5e`), con signo `-`.
   - Rendimiento neutro: Texto neutral/muted (`text-gray-400`).
4. Bordes: Definidos y angulares (`rounded-md` o `rounded-xl`), manteniendo el estilo sobrio y de alto contraste de la plataforma.

### Justificación
- Coherencia visual con el resto de las vistas de la aplicación (`HomePage`, `CatalogPage`, `PlayerDetailPage`).

---

## 5. Estrategia de Testing (Aislados vs. Real Backend)

### Decisión
1. **Tests unitarios directos (Vitest)**:
   - `service/portfolioService.spec.ts`: Testea el servicio HTTP mockeando `fetch` (exigencia estricta de la Constitución Principio IX).
   - `hooks/usePortfolio.spec.ts`: Testea el ciclo de vida del hook mockeando `portfolioService`.
2. **Tests de componentes aislados**:
   - `components/PortfolioSummary.spec.tsx` (co-located): Testea renderizado de totales, colores de ganancia y pérdida.
   - `components/HoldingList.spec.tsx` (co-located): Testea renderizado de grilla/filas de posiciones y formato monetario.
3. **Test de integración real contra backend (Vitest + Testcontainers)**:
   - `frontend/test/portfolio.spec.ts` (fuera de `src/`): Ejecuta el flujo contra la instancia real de NestJS y PostgreSQL efímero levantado con Testcontainers (usando el `globalSetup.ts` existente de frontend/test). Registra/autentica un usuario, consulta su portfolio vía el cliente HTTP y verifica las respuestas reales sin mocks.

### Justificación
- Cumple integralmente los mandatos del Principio IX de la Constitución y las precondiciones definidas para la entrega.

