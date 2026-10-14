# Data Model: Frontend — Portfolio personal

Este documento define las entidades de datos, interfaces TypeScript y reglas de transformación asociadas a la visualización del portfolio del usuario.

---

## 1. Interfaces TypeScript (`frontend/src/types/portfolio.ts`)

### `Holding`
Representa una posición individual de tokens sobre un futbolista.

```typescript
export interface Holding {
  /** Identificador único del jugador */
  playerId: string;
  /** Nombre completo o de fantasía del futbolista */
  playerName: string;
  /** Cantidad de tokens en posesión del usuario */
  tokenQuantity: number;
  /** Precio promedio ponderado de compra por token (en moneda estándar) */
  averageBuyPrice: number;
  /** Cotización actual oficial vigente por token */
  currentPrice: number;
  /** Ganancia o pérdida neta acumulada de la posición ((currentPrice - averageBuyPrice) * tokenQuantity) */
  totalProfitLoss: number;
}
```

### `PortfolioSummary`
Métricas consolidadas de la totalidad de las posiciones en cartera.

```typescript
export interface PortfolioSummary {
  /** Capital total invertido por el usuario en base al precio promedio de compra */
  totalInvested: number;
  /** Valor de mercado actual total del portfolio según cotizaciones vigentes */
  totalCurrentValue: number;
  /** Ganancia o pérdida neta global acumulada (totalCurrentValue - totalInvested) */
  netProfitLoss: number;
}
```

### `PortfolioResponse`
Estructura de respuesta suministrada por el endpoint del backend `GET /users/:id/portfolio`.

```typescript
export interface PortfolioResponse {
  /** Listado de posiciones individuales del usuario */
  holdings: Holding[];
  /** Resumen consolidado del portfolio calculado por el backend o calculado a partir de holdings */
  summary?: PortfolioSummary;
}
```

---

## 2. Reglas de Negocio y Transformación

1. **Cálculo de métricas si el backend devuelve únicamente la lista de posiciones**:
   En caso de que el backend retorne únicamente la lista `holdings: Holding[]`, el cliente o hook calcula el resumen consolidado de forma transparente:
   - $\text{totalInvested} = \sum (\text{tokenQuantity} \times \text{averageBuyPrice})$
   - $\text{totalCurrentValue} = \sum (\text{tokenQuantity} \times \text{currentPrice})$
   - $\text{netProfitLoss} = \text{totalCurrentValue} - \text{totalInvested}$

2. **Posición individual**:
   - Si no viene pre-calculado `totalProfitLoss`, se deriva como:
     $(\text{currentPrice} - \text{averageBuyPrice}) \times \text{tokenQuantity}$

3. **Formato monetario**:
   - Todos los precios, valores totales y ganancias se muestran con 2 decimales y prefijo monetario (por ejemplo, `$1,250.00`).
   - Los porcentajes opcionales de rendimiento se muestran como `+12.50%` o `-3.20%`.

4. **Estado de cartera vacía**:
   - `holdings.length === 0`: La vista omite la sección de Holdings y los cuadros numéricos irrelevantes, desplegando el banner o tarjeta de bienvenida amigable con botón al catálogo.

