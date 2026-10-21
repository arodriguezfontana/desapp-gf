# Implementation Plan: Libro de Órdenes por Jugador (Order Book)

**Branch**: `024-player-order-book` | **Date**: 2026-10-21 | **Spec**: [spec.md](file:///c:/Users/arodr/OneDrive/Desktop/Archivos/Universidad/Repos/desapp-gf/specs/024-player-order-book/spec.md)

**Input**: Feature specification from `specs/024-player-order-book/spec.md`

---

## Summary

Implementar la consulta del libro de órdenes por jugador mediante el endpoint `GET /players/:id/order-book` y su visualización de profundidad de mercado en el frontend dentro de la página de detalle del jugador (`PlayerDetailPage.tsx`).
El endpoint consolida las posturas de compra (`bids`) y venta (`asks`) activas (`PENDING` y `PARTIALLY_FILLED`) para el jugador solicitado, agrupándolas por nivel de precio unitario y sumando las cantidades remanentes. Se garantiza el anonimato total del mercado sin exponer quién colocó cada postura ni identificadores de órdenes individuales.

Técnicamente:
- En backend, `PlayerController.getOrderBook` atiende la ruta `GET /players/:id/order-book` y delega en `OrdersService.getOrderBook(playerId)`.
- `OrdersService` valida la existencia del jugador en `PlayerRepository` (arrojando `PlayerNotFoundError` / 404 si no existe) e invoca `OrderRepository.getOrderBook(playerId)`.
- `TypeOrmOrderRepository` ejecuta la agregación en base de datos (`GROUP BY side, price` con `SUM(remaining_quantity)` y filtro `status IN (PENDING, PARTIALLY_FILLED)`), devolviendo una instancia del agregado de dominio `OrderBook` con `bids` ordenados DESC y `asks` ordenados ASC.
- En frontend, se crea el servicio `getOrderBook(playerId)` en `catalogService`, el custom hook `useOrderBook(playerId)` y el componente visual `OrderBookView` integrado en `PlayerDetailPage.tsx`.

---

## Technical Context

**Language/Version**: TypeScript 5.9 (Node.js 22+ / 24, NestJS 11 backend), React 19 + TypeScript (Vite frontend).  
**Primary Dependencies**:
* Backend: NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/swagger`, `@nestjs/typeorm`), TypeORM 1.1, `pg` 8.23.
* Frontend: React 19, `react-router-dom` 7, Tailwind CSS 4, `vitest` 5, Testing Library.  
**Storage**: PostgreSQL 16 (tabla `orders` indexada por `idx_orders_matching`). No requiere migraciones DDL ni tablas nuevas.  
**Testing**:
* Backend: Jest 30 (`pnpm test:unit`, `pnpm test`), `tsarch` (`test/architecture.spec.ts`).
* Frontend: Vitest (`npm run test:unit`).  
**Target Platform**: Servidor Node.js (Docker/Linux/Windows) y navegadores web modernos.  
**Project Type**: Monorepo Web Application (`backend/` y `frontend/`).  
**Performance Goals**: Respuesta de `GET /players/:id/order-book` en < 300 ms p95 bajo carga local.  
**Constraints**:
* Información agregada anónima de mercado (sin campos de usuario ni ID de órdenes).
* Arquitectura en capas estricta verificada por `tsarch` (Principio I).
* Snapshot bajo demanda (sin WebSockets ni polling en background).

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Requisito de la Constitución | Estado | Justificación / Diseño |
|---|---|---|---|
| **I. Arquitectura en capas** | Sentido único de dependencias (Controller → Service → {Dominio, Repository}). DTOs no cruzan al Service. | ✅ Cumple | `PlayerController` delega en `OrdersService` (Service). `OrdersService` delega en `OrderRepository` y `PlayerRepository`. Las entidades de dominio no conocen TypeORM. |
| **II. Modelo de dominio rico** | Lógica de negocio y ordenamiento de libro en el dominio (`OrderBook`, `PriceLevel`). | ✅ Cumple | `OrderBook` encapsula la clasificación y validación de niveles y volumen total. |
| **III. Cada validación en su nivel** | DTO valida UUID con `ParseUUIDPipe`; Service valida existencia del jugador (404); excepciones tipadas. | ✅ Cumple | `ParseUUIDPipe` valida formato; `PlayerNotFoundError` se arroja si el jugador no existe y se traduce a 404. |
| **IV. Autenticación** | Todo endpoint ligado a la operatoria de mercado exige JWT válido (`JwtAuthGuard`). | ✅ Cumple | `GET /players/:id/order-book` está protegido bajo el guard JWT global. |
| **V. Convenciones HTTP** | Mapeo canónico de errores (400, 401, 404). | ✅ Cumple | Retorna 200 OK con libro (o arrays vacíos si no hay posturas), 400 por UUID inválido, 401 sin JWT, 404 si jugador no existe. |
| **IX. Testing** | Tests unitarios directos para dominio, servicio, controlador, hooks y componentes. | ✅ Cumple | Cobertura unitaria exhaustiva en backend y frontend para cada componente nuevo o modificado. |

---

## Project Structure

### Documentation (this feature)

```text
specs/024-player-order-book/
├── spec.md              # Especificación funcional de requerimientos
├── checklists/
│   └── requirements.md  # Checklist de validación de calidad de requerimientos
├── plan.md              # Este plan de implementación
├── research.md          # Investigación técnica y decisiones (D1-D6)
├── data-model.md        # Modelo de datos y entidades de OrderBook
├── quickstart.md        # Guía de verificación paso a paso
└── contracts/
    └── order-book-api.md # Contrato HTTP OpenAPI para GET /players/:id/order-book
```

### Source Code

```text
backend/
├── src/
│   ├── domain/orders/
│   │   ├── order-book.ts                # Entidad de dominio OrderBook y PriceLevel
│   │   └── order-book.spec.ts           # Tests unitarios del modelo de dominio
│   ├── repositories/orders/
│   │   ├── order.repository.ts          # Declaración getOrderBook(playerId)
│   │   └── typeorm-order.repository.ts  # Implementación con SQL agregado GROUP BY
│   ├── services/orders/
│   │   ├── orders.service.ts            # getOrderBook(playerId)
│   │   └── orders.service.spec.ts       # Tests unitarios del servicio
│   ├── controllers/player/
│   │   ├── player.controller.ts         # GET /players/:id/order-book
│   │   ├── player.controller.spec.ts    # Tests unitarios del endpoint
│   │   └── dto/
│   │       └── order-book-response.dto.ts # DTO de respuesta con bids y asks
│   └── modules/
│       ├── orders/orders.module.ts      # Exporta OrdersService
│       └── player/player.module.ts      # Importa OrdersModule
└── test/
    └── architecture.spec.ts             # Validación tsarch

frontend/
├── src/
│   ├── types/
│   │   └── orders.types.ts              # Tipos PriceLevelDto y OrderBookResponseDto
│   ├── service/
│   │   ├── catalogService.ts            # getOrderBook(playerId)
│   │   └── catalogService.spec.ts       # Tests unitarios del servicio
│   ├── hooks/
│   │   ├── useOrderBook.ts              # Custom hook para profundidad de mercado
│   │   └── useOrderBook.spec.ts         # Tests unitarios del hook
│   ├── components/
│   │   ├── OrderBookView.tsx            # Componente de profundidad visual (bids & asks)
│   │   └── OrderBookView.spec.tsx       # Tests unitarios del componente
│   └── pages/
│       ├── PlayerDetailPage.tsx        # Integración de OrderBookView en detalle
│       └── PlayerDetailPage.spec.tsx   # Actualización de tests de página
```

---

## Plan Phases

### Phase 0: Research & Technical Decisions (Completado)
* [x] Investigación de la regla de capas entre `PlayerController` y `OrdersService` ([research.md](file:///c:/Users/arodr/OneDrive/Desktop/Archivos/Universidad/Repos/desapp-gf/specs/024-player-order-book/research.md)).
* [x] Definición de la consulta SQL de agregación por `side` y `price` con `SUM(remaining_quantity)`.
* [x] Definición del ordenamiento canónico (bids DESC, asks ASC).
* [x] Decisión de diseño sobre anonimato y confidencialidad de mercado.

### Phase 1: Design & Contracts (Completado)
* [x] Modelo de datos de `OrderBook` y `PriceLevel` ([data-model.md](file:///c:/Users/arodr/OneDrive/Desktop/Archivos/Universidad/Repos/desapp-gf/specs/024-player-order-book/data-model.md)).
* [x] Contrato OpenAPI para `GET /players/:id/order-book` ([contracts/order-book-api.md](file:///c:/Users/arodr/OneDrive/Desktop/Archivos/Universidad/Repos/desapp-gf/specs/024-player-order-book/contracts/order-book-api.md)).
* [x] Guía de validación paso a paso ([quickstart.md](file:///c:/Users/arodr/OneDrive/Desktop/Archivos/Universidad/Repos/desapp-gf/specs/024-player-order-book/quickstart.md)).

### Phase 2: Tasks & Implementation Breakdown (Siguiente paso: `/speckit-tasks`)
* Desglose ordenado de tareas en `tasks.md`:
  - Backend: Dominio `OrderBook` → Repositorio `getOrderBook` → Servicio `OrdersService` → Controlador `PlayerController` → DTO y Swagger → Tests.
  - Frontend: Tipos `OrderBookResponseDto` → Servicio `catalogService` → Hook `useOrderBook` → Componente `OrderBookView` → Integración en `PlayerDetailPage` → Tests.
