# Implementation Plan: Cancelación de Órdenes (Order Cancellation)

**Branch**: `023-cancel-order` | **Date**: 2026-10-21 | **Spec**: [spec.md](file:///c:/Users/arodr/OneDrive/Desktop/Archivos/Universidad/Repos/desapp-gf/specs/023-cancel-order/spec.md)

**Input**: Feature specification from `specs/023-cancel-order/spec.md`

---

## Summary

Implementar la capacidad de cancelar órdenes propias en el mercado de tokens mediante el endpoint `DELETE /orders/:id` y su integración en el frontend dentro de la vista "Mis órdenes". 
Como el precio de una orden es inmutable al momento de su creación (determinado por la estrategia de valuación seleccionada del usuario), la cancelación constituye el único mecanismo que tiene un usuario para desistir de una postura abierta o sustituirla por otra a un precio actualizado.

Técnicamente:
- El backend expone `DELETE /orders/:id` en `OrdersController.cancel` invocando `OrdersService.cancelOrder(orderId, requesterId)`.
- La operación verifica propiedad (403 si el usuario no es el dueño), existencia (404 si no existe) y estado cancelable (409 si ya está `COMPLETED` o `CANCELLED`).
- La cancelación se ejecuta bajo transacción con bloqueo pesimista (`pessimistic_write`) para prevenir condiciones de carrera contra ejecuciones concurrentes del motor de matching.
- Se actualiza la entidad de dominio `Order` agregando el estado `CANCELLED` y el método `order.cancel()`.
- Al transicionar a `CANCELLED`, la orden queda excluida de inmediato de futuras operaciones de cruce en el matching engine. Para órdenes de venta (`SELL`), la liberación de tokens reservados es automática al no contarse en `sumPendingSellQuantity`.
- Se agrega `GET /orders` para que el frontend liste las órdenes del usuario con su estado actual y remanente.
- En el frontend, se agrega el componente de "Mis órdenes" en `PortfolioPage.tsx` con un botón "Cancelar" para órdenes en estado `PENDING` o `PARTIALLY_FILLED`.

---

## Technical Context

**Language/Version**: TypeScript 5.9 (Node.js 22+ / 24, NestJS 11 backend), React 19 + TypeScript (Vite frontend).  
**Primary Dependencies**:
* Backend: NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/swagger`, `@nestjs/typeorm`), TypeORM 1.1, `pg` 8.23.
* Frontend: React 19, `react-router-dom` 7, Tailwind CSS 4, `lucide-react` (o SVG puro existente), `vitest` 5, Testing Library.  
**Storage**: PostgreSQL 16 (tabla `orders`). No se requieren nuevas tablas ni migraciones DDL (`status varchar(16)` ya admite `'CANCELLED'`).  
**Testing**:
* Backend: Jest 30 (`pnpm test:unit`, `pnpm test`), `tsarch` (`test/architecture.spec.ts`).
* Frontend: Vitest (`npm run test:unit`).  
**Target Platform**: Servidor Node.js (Docker/Linux/Windows) y navegadores web modernos.  
**Project Type**: Monorepo Web Application (`backend/` y `frontend/`).  
**Performance Goals**: Cancelación procesada en < 500 ms p95 bajo carga local.  
**Constraints**:
* No se admite endpoint `PATCH` ni edición de precio/cantidad de órdenes (Principio V y spec).
* Control de concurrencia pesimista en base de datos para no colisionar con el matching engine (Principio VI).
* Arquitectura en capas estricta verificada por `tsarch` (Principio I).  
**Scale/Scope**: Módulo `orders` en backend y componentes de `portfolio` / `orders` en frontend.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Requisito de la Constitución | Estado | Justificación / Diseño |
|---|---|---|---|
| **I. Arquitectura en capas** | Dependencias unidireccionales (Controller → Service → {Dominio, Repository}). DTOs no cruzan al Service. | ✅ Cumple | `OrdersController` solo habla con `OrdersService`. `Order` de dominio no tiene decoradores TypeORM. `TypeOrmOrderRepository` encapsula `OrderEntity` y `OrderMapper`. |
| **II. Modelo de dominio rico** | Lógica de negocio en entidades de dominio; métodos explícitos (`cancel()`, `isCancellable`); excepciones de dominio tipadas. | ✅ Cumple | `order.cancel()` valida el estado y transiciona la orden; se crean `OrderNotFoundError`, `OrderForbiddenError`, `OrderNotCancellableError`. |
| **IV. Autenticación** | Endpoints de usuario protegidos por `JwtAuthGuard` con extracción de `userId` vía `@CurrentUser()`. | ✅ Cumple | `DELETE /orders/:id` y `GET /orders` requieren JWT y usan `@CurrentUser()`. |
| **V. Convenciones HTTP** | Mapeo canónico de errores (400, 401, 403, 404, 409). No crear endpoints híbridos ni edición no permitida. | ✅ Cumple | `DELETE /orders/:id` responde 200/204, 403 (ajena), 404 (inexistente), 409 (estado terminal). |
| **VI. Integridad transaccional** | Operaciones con riesgo de concurrencia deben ejecutarse bajo transacción atómica y lock. | ✅ Cumple | Se utiliza `TransactionManager.run()` adquiriendo `pessimistic_write` sobre la fila de la orden para evitar colisiones con matching. |
| **IX. Testing** | Tests unitarios directos para dominio, servicio, controlador, hooks y componentes. Sin saltear gates. | ✅ Cumple | Suites unitarias exhaustivas en backend y frontend para cada componente nuevo o modificado. |

---

## Project Structure

### Documentation (this feature)

```text
specs/023-cancel-order/
├── spec.md              # Especificación funcional de requisitos
├── checklists/
│   └── requirements.md  # Checklist de validación de calidad de requisitos
├── plan.md              # Este plan de implementación
├── research.md          # Investigación técnica y decisiones (D1-D5)
├── data-model.md        # Modelo de datos, estados e invariantes de Order
├── quickstart.md        # Guía de verificación paso a paso
└── contracts/
    └── orders-api.md    # Contrato HTTP para DELETE /orders/:id y GET /orders
```

### Source Code

```text
backend/
├── src/
│   ├── domain/orders/
│   │   ├── order-status.ts              # Se agrega CANCELLED
│   │   ├── order.ts                     # Se agrega cancel(), isCancellable
│   │   ├── order.spec.ts                # Tests unitarios de dominio
│   │   └── errors/
│   │       ├── order-not-found.error.ts        # Error 404
│   │       ├── order-forbidden.error.ts        # Error 403
│   │       └── order-not-cancellable.error.ts  # Error 409
│   ├── repositories/orders/
│   │   ├── order.repository.ts          # findByIdWithLock, findByUserId
│   │   ├── typeorm-order.repository.ts  # Implementación TypeORM con lock
│   │   └── mappers/order.mapper.ts      # Mapeo de status CANCELLED
│   ├── services/orders/
│   │   ├── orders.service.ts            # cancelOrder(orderId, requesterId), getUserOrders
│   │   └── orders.service.spec.ts       # Tests unitarios del servicio
│   └── controllers/orders/
│       ├── orders.controller.ts         # DELETE /orders/:id, GET /orders
│       ├── orders.controller.spec.ts    # Tests unitarios del controlador
│       └── dto/
│           └── order-response.dto.ts    # Soporte para status CANCELLED
└── test/
    └── architecture.spec.ts             # Verificación de reglas arquitectónicas tsarch

frontend/
├── src/
│   ├── types/
│   │   └── orders.types.ts              # OrderStatus incluye 'CANCELLED'
│   ├── service/
│   │   ├── ordersService.ts             # cancelOrder(orderId), getUserOrders()
│   │   └── ordersService.spec.ts        # Tests unitarios del servicio
│   ├── hooks/
│   │   ├── useUserOrders.ts             # Hook para listar y cancelar órdenes
│   │   └── useUserOrders.spec.ts        # Tests del hook
│   ├── components/
│   │   ├── MyOrders.tsx                 # Lista de órdenes con botón Cancelar
│   │   └── MyOrders.spec.tsx            # Tests del componente
│   └── pages/
│       ├── PortfolioPage.tsx            # Integra componente MyOrders
│       └── PortfolioPage.spec.tsx       # Actualización de tests de página
```

---

## Plan Phases

### Phase 0: Research & Design Decisions (Completado)
* [x] Investigación sobre verbos REST y decisión de `DELETE /orders/:id` ([research.md](file:///c:/Users/arodr/OneDrive/Desktop/Archivos/Universidad/Repos/desapp-gf/specs/023-cancel-order/research.md)).
* [x] Definición del mecanismo de bloqueo pesimista contra el motor de matching.
* [x] Mecanismo de liberación automática de tokens para órdenes `SELL`.
* [x] Identificación del endpoint de consulta `GET /orders` para alimentar la UI.

### Phase 1: Contracts & Data Model (Completado)
* [x] Definición del modelo de datos de `Order`, estados y errores de dominio ([data-model.md](file:///c:/Users/arodr/OneDrive/Desktop/Archivos/Universidad/Repos/desapp-gf/specs/023-cancel-order/data-model.md)).
* [x] Contratos OpenAPI / REST para `DELETE /orders/:id` y `GET /orders` ([contracts/orders-api.md](file:///c:/Users/arodr/OneDrive/Desktop/Archivos/Universidad/Repos/desapp-gf/specs/023-cancel-order/contracts/orders-api.md)).
* [x] Guía de validación end-to-end ([quickstart.md](file:///c:/Users/arodr/OneDrive/Desktop/Archivos/Universidad/Repos/desapp-gf/specs/023-cancel-order/quickstart.md)).

### Phase 2: Tasks & Implementation (Siguiente paso: `/speckit-tasks`)
* Generar desglose de tareas ordenadas por dependencias en `tasks.md`.
* Tareas Backend: Dominio → Errores → Repositorio → Servicio → Controlador → Tests.
* Tareas Frontend: Types → Service → Hook → Componente `MyOrders` → Integración en `PortfolioPage` → Tests.
