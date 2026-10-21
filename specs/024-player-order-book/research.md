# Technical Research & Decisions: Libro de Órdenes por Jugador (Order Book)

**Feature**: `024-player-order-book`  
**Date**: 2026-10-21  

---

## Decision 1: Ubicación del Endpoint y Sentido de Dependencias (Principio I)

* **Contexto**: El enunciado especifica `GET /players/:id/order-book` para consultar las órdenes activas de un jugador. En el backend, las rutas `/players` residen en `PlayerController` (`player.module.ts`), mientras que la persistencia de órdenes reside en `OrdersModule` (`TypeOrmOrderRepository`).
* **Decisión**:
  1. Declarar el método `@Get(':id/order-book') getOrderBook` en `PlayerController`.
  2. `PlayerController` delega en `OrdersService.getOrderBook(playerId)`.
  3. `PlayerModule` importa `forwardRef(() => OrdersModule)` y `OrdersModule` exporta `OrdersService`.
* **Rationale**: Cumple rigurosamente el Principio I de la Constitución verificado por `tsarch`:
  - `PlayerController` (Controller) solo interactúa con un Service (`OrdersService`). No toca repositorios directamente.
  - La lógica de agregación y el acceso a la tabla de órdenes queda encapsulado dentro del dominio de órdenes (`OrdersService` y `OrderRepository`).
* **Alternativas consideradas**:
  - *Colocar el endpoint en `OrdersController` (`GET /orders/book/:playerId`)*: Descartado porque la especificación del usuario exige explícitamente `GET /players/:id/order-book`.
  - *Inyectar `OrderRepository` en `PlayerController`*: Descartado porque violaría de inmediato la regla de capas de la Constitución y rompería `backend/test/architecture.spec.ts`.

---

## Decision 2: Mecanismo de Agregación y Eficiencia en Base de Datos

* **Contexto**: Un jugador puede tener decenas o cientos de órdenes activas individuales, muchas de ellas al mismo precio. El cliente necesita ver la profundidad agregada (precio y cantidad total remanente), no cada orden individual.
* **Decisión**:
  Ejecutar una consulta agregada con `GROUP BY side, price` y `SUM(remaining_quantity)` en PostgreSQL a través de `TypeOrmOrderRepository.getOrderBook(playerId)`:
  ```sql
  SELECT
    side,
    price,
    COALESCE(SUM(remaining_quantity), 0)::integer AS "totalQuantity"
  FROM orders
  WHERE player_id = :playerId
    AND status IN ('PENDING', 'PARTIALLY_FILLED')
  GROUP BY side, price
  ```
* **Rationale**:
  - Realizar la agregación en el motor de base de datos aprovecha el índice existente `idx_orders_matching` (`['playerId', 'side', 'price', 'status', 'createdAt']`), transfiriendo únicamente las filas consolidadas hacia Node.js en < 5 ms.
  - Excluye automáticamente órdenes `COMPLETED` y `CANCELLED`.
* **Alternativas consideradas**:
  - *Cargar todas las entidades `Order` a memoria y agrupar con un Map en JavaScript*: Descartado por ineficiencia de memoria y transferencia de red ante alta concurrencia de órdenes.

---

## Decision 3: Ordenamiento Canónico de Mercado (Bids y Asks)

* **Contexto**: En un Order Book financiero estándar (Level 2):
  - **Bids (Compras)**: Los compradores que pagan más tienen prioridad; se ordenan de forma **descendente** por precio (`price DESC`).
  - **Asks (Ventas)**: Los vendedores que cobran menos tienen prioridad; se ordenan de forma **ascendente** por precio (`price ASC`).
* **Decisión**:
  En `OrdersService` / `OrderRepository`:
  - Separar los resultados en dos arreglos: `bids` y `asks`.
  - Ordenar `bids`: `b.price - a.price` (descendente).
  - Ordenar `asks`: `a.price - b.price` (ascendente).
  - Formatear `price` como string monetario estándar de 2 decimales (`Number(price).toFixed(2)`).
* **Rationale**: Permite que el inversor vea en la parte superior el mejor precio disponible para comprar de inmediato (el menor ask) y el mejor precio para vender de inmediato (el mayor bid).

---

## Decision 4: Anonimato y Privacidad del Libro de Órdenes

* **Contexto**: Se debe documentar la decisión de diseño de que el libro de órdenes no expone al comprador ni al vendedor.
* **Decisión**:
  El DTO de respuesta `OrderBookResponseDto` y cada `PriceLevelDto` contienen exclusivamente:
  ```typescript
  export class PriceLevelDto {
    price: string;
    totalQuantity: number;
  }
  export class OrderBookResponseDto {
    playerId: string;
    bids: PriceLevelDto[];
    asks: PriceLevelDto[];
  }
  ```
  Ningún identificador de usuario (`userId`), nombre, avatar ni identificador individual de orden (`id`) es consultado ni expuesto en el DTO.
* **Rationale**: Protege la privacidad de las carteras y evita prácticas predatorias o manipulación de contrapartes individuales en el mercado.

---

## Decision 5: Carácter Snapshot (Bajo Demanda) sin WebSockets

* **Contexto**: El usuario definió: *"Queda fuera de alcance, aceptado como riesgo: no se actualiza en tiempo real (vía websocket o polling automático), el usuario tiene que volver a consultar el endpoint para ver cambios."*
* **Decisión**:
  El endpoint opera como un snapshot HTTP REST clásico. En el frontend se ofrece un botón de recarga o se consulta al montar la vista de detalle del jugador, sin abrir conexiones persistentes de WebSockets ni timers de polling en segundo plano.
* **Rationale**: Minimiza la complejidad arquitectónica y consumo de recursos, satisfaciendo plenamente los requerimientos planteados para esta versión.

---

## Decision 6: Integración en Frontend

* **Contexto**: Dónde y cómo mostrar la profundidad de mercado.
* **Decisión**:
  1. Cliente `catalogService.getOrderBook(playerId)` o `ordersService.getOrderBook(playerId)` en `frontend/src/service/`.
  2. Custom hook `useOrderBook(playerId)` en `frontend/src/hooks/useOrderBook.ts`.
  3. Componente de presentación `OrderBookView` en `frontend/src/components/OrderBookView.tsx` renderizando dos columnas (Bids y Asks) con barras visuales de profundidad relativas al volumen máximo del libro.
  4. Integración en `PlayerDetailPage.tsx` junto al bloque de cotización y estadísticas.
* **Rationale**: Centraliza las llamadas en la capa de servicios y hooks, manteniendo la interfaz intuitiva y desacoplada según la Constitución.

