# Quickstart: Extensión de Métricas de Jugador (WhoScored)

Guía de verificación rápida para probar los cambios introducidos por la feature 011.

## 1. Verificación de Backend

### Tests Unitarios
Ejecutar los tests unitarios del dominio, mappers y adapter de scraping:
```bash
cd backend
pnpm test src/domain/player/player.spec.ts
pnpm test src/adapters/player-sync/http-whoscored-adapter.spec.ts
pnpm test src/repositories/player/mappers/player.mapper.spec.ts
```

### Tests de Integración
Ejecutar los tests con Testcontainers (PostgreSQL efímero) para validar persistencia y upserts:
```bash
cd backend
pnpm test src/repositories/player/typeorm-player.repository.integration.spec.ts
pnpm test src/services/player-sync/player-sync.service.integration.spec.ts
```

### Tests E2E y Arquitectura
Verificar que la API responde con los campos extendidos y que no hay violaciones de capas:
```bash
cd backend
pnpm test:e2e test/player-catalog.e2e-spec.ts
pnpm test:e2e test/architecture.spec.ts
```

## 2. Verificación de Frontend

### Tests Unitarios de Componentes
Ejecutar los tests de Vitest para comprobar que las cards y la página de detalle renderizan las nuevas métricas:
```bash
cd frontend
pnpm test src/components/PlayerCard.spec.tsx
pnpm test src/pages/PlayerDetailPage.spec.tsx
```

### Build Check
```bash
cd frontend
pnpm build
```

## 3. Verificación Manual Local
1. Levantar backend y frontend (`docker compose up -d`, `pnpm start:dev` en backend, `pnpm dev` en frontend).
2. Generar/usar una ApiKey válida.
3. Navegar a `/catalog` y comprobar que las tarjetas de jugador muestran los nuevos indicadores (`goals`, `assists`, `yellowCards`).
4. Hacer clic en "Ver detalle" y confirmar que se despliega la grilla completa con las 11 estadísticas de rendimiento.

