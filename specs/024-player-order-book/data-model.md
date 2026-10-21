# Data Model: Libro de Órdenes por Jugador (Order Book)

**Feature**: `024-player-order-book`  
**Date**: 2026-10-21  

---

## 1. Modelo de Dominio

### 1.1 `PriceLevel` (Objeto de Valor)

Representa un nivel consolidado de oferta o demanda en el mercado para un precio específico.

```typescript
export interface PriceLevel {
  readonly price: number;
  readonly totalQuantity: number;
}
```

* **`price`**: Precio unitario de la postura monetaria (`number` positivo, precisión a 2 decimales).
* **`totalQuantity`**: Cantidad total acumulada de tokens disponibles en este nivel de precio (`integer` mayor a 0). Corresponde a la sumatoria de `remainingQuantity` de todas las órdenes activas en ese precio.

---

### 1.2 `OrderBook` (Agregado de Dominio)

Representa la instantánea del libro de órdenes de un jugador en un momento determinado.

```typescript
export class OrderBook {
  constructor(
    private readonly _playerId: string,
    private readonly _bids: readonly PriceLevel[],
    private readonly _asks: readonly PriceLevel[],
  ) {}

  static empty(playerId: string): OrderBook {
    return new OrderBook(playerId, [], []);
  }

  static create(playerId: string, bids: PriceLevel[], asks: PriceLevel[]): OrderBook {
    // Garantiza orden canónico:
    // Bids: DESC (mayor precio primero)
    // Asks: ASC (menor precio primero)
    const sortedBids = [...bids].sort((a, b) => b.price - a.price);
    const sortedAsks = [...asks].sort((a, b) => a.price - b.price);
    return new OrderBook(playerId, Object.freeze(sortedBids), Object.freeze(sortedAsks));
  }

  get playerId(): string {
    return this._playerId;
  }

  get bids(): readonly PriceLevel[] {
    return this._bids;
  }

  get asks(): readonly PriceLevel[] {
    return this._asks;
  }

  get totalBidVolume(): number {
    return this._bids.reduce((acc, level) => acc + level.totalQuantity, 0);
  }

  get totalAskVolume(): number {
    return this._asks.reduce((acc, level) => acc + level.totalQuantity, 0);
  }
}
```

#### Invariantes y Reglas del Modelo:
1. **Unicidad de Nivel**: En una misma lista (`bids` o `asks`), no pueden existir dos elementos con el mismo `price`.
2. **Volumen Positivo**: Todo `PriceLevel` en el libro debe tener `totalQuantity > 0`.
3. **Exclusión de Terminales**: Órdenes en estado `COMPLETED` o `CANCELLED` tienen `remainingQuantity = 0` o están expresamente filtradas, por lo que nunca aportan volumen al libro.
4. **Anonimato Estricto**: `OrderBook` y `PriceLevel` no poseen ninguna referencia a `userId` ni `orderId`.

---

## 2. Consulta y Persistencia (Mapeo Relacional)

La información del libro de órdenes se construye a partir de la tabla existente `orders`. No se requiere ninguna tabla nueva ni modificación de esquema DDL.

### Consulta Agregada en Base de Datos:

```sql
SELECT
  side,
  price,
  COALESCE(SUM(remaining_quantity), 0)::integer AS "totalQuantity"
FROM orders
WHERE player_id = :playerId
  AND status IN ('PENDING', 'PARTIALLY_FILLED')
GROUP BY side, price;
```

### Índices Utilizados:
* `idx_orders_matching` (`['playerId', 'side', 'price', 'status', 'createdAt']`): Permite resolver el filtro por `player_id` y `status` sin escaneo secuencial de la tabla.

