# Data Model: Visualización gráfica de datos clave

No se crean ni modifican entidades de dominio, tablas ni DTOs de backend: esta feature es puramente de
presentación en el frontend y consume estructuras ya existentes. Este documento describe esas estructuras
ya existentes (tal como las usa esta feature) y la única forma de datos nueva: el resultado de la función
utilitaria de agrupamiento del order book.

## Estructuras existentes consumidas (sin cambios)

### `PlayerQuote` (frontend/src/types/catalog.types.ts)

Usada por el gráfico de evolución de cotización (reemplazado).

- `id: string`
- `calculatedAt: string` (ISO date)
- `value: number`
- `score: number`

### `TokenTransactionDto` (frontend/src/types/orders.types.ts)

Usada por el gráfico de evolución de capital de portfolio (reemplazado).

- `id: string`
- `createdAt: string` (ISO date)
- `type: 'CREDIT' | 'DEBIT'`
- `price: string | number`
- `quantity: number`
- `playerName: string`

### `UserStrategyResponseDto` (frontend/src/types/userStrategy.types.ts)

Usada por el gráfico nuevo de composición de la estrategia activa. Se grafica `weights`, el conjunto de
pesos generales de la estrategia con `isSelected === true`.

- `weights: Record<string, number>` — clave = nombre del factor, valor = peso configurado.

### `OrderBookResponseDto` (frontend/src/types/orders.types.ts)

Usada como entrada de la función de agrupamiento para el gráfico nuevo de profundidad del libro de
órdenes.

- `bids: OrderBookLevel[]` — niveles de compra, ya agregados por precio por el backend.
- `asks: OrderBookLevel[]` — niveles de venta, ya agregados por precio por el backend.

Donde `OrderBookLevel` ya expone (sin cambios):

- `price: number`
- `totalQuantity: number`

### `Holding` (frontend/src/types/portfolio.ts)

Usada por el gráfico nuevo de distribución del portfolio. El valor de cada posición para el gráfico es
`tokenQuantity * currentPrice` (mismo cálculo ya usado para mostrar "Cotización Actual" × "Tokens" en la
tabla de posiciones existente; no se introduce un cálculo nuevo).

- `playerId: string`
- `playerName: string`
- `tokenQuantity: number`
- `currentPrice: number`

## Forma de datos nueva (solo de presentación)

### `OrderBookDepthPoint` (frontend/src/utils/orderBookDepth.ts)

Salida de la función pura `buildOrderBookDepth(bids, asks)`. Una entrada por cada nivel de precio presente
en `bids` y/o `asks`, ordenadas de menor a mayor precio:

- `price: number`
- `bidQuantity: number` — `totalQuantity` del nivel de compra a ese precio, o `0` si no hay compra a ese
  precio.
- `askQuantity: number` — `totalQuantity` del nivel de venta a ese precio, o `0` si no hay venta a ese
  precio.

**Reglas de construcción**:

- Si un precio aparece solo en `bids`, `askQuantity` del punto es `0` (y viceversa).
- Si `bids` y `asks` están ambos vacíos, el resultado es un arreglo vacío (el componente de gráfico
  muestra el mismo estado vacío que ya tiene la vista tabular, por FR-008).
- No hay paginación ni límite de cantidad de niveles (FR-009, riesgo aceptado en la spec).

No es una entidad persistida ni expuesta por ningún endpoint: vive y se calcula enteramente en el cliente,
a partir de una respuesta ya recibida del backend.
