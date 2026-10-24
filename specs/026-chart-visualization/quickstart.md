# Quickstart: Visualización gráfica de datos clave

Guía de validación manual end-to-end, una vez implementada la feature. No requiere nuevos endpoints ni
variables de entorno.

## Prerrequisitos

- Backend y frontend corriendo localmente (`docker-compose` para PostgreSQL + `nest start` + `vite dev`),
  igual que para cualquier otra feature de frontend.
- `recharts` instalado en `frontend/` (`npm install` tras el merge de esta feature).
- Un usuario de prueba con:
  - Al menos una estrategia de valuación propia, con pesos generales configurados y marcada como activa
    (`isSelected: true`).
  - Al menos una compra de tokens de un jugador con historial de cotizaciones (para ver la evolución de
    cotización con más de un punto).
  - Al menos una orden de compra y una de venta activas (de otro usuario o propia) sobre el mismo jugador,
    en niveles de precio distintos (para ver profundidad con ambos lados poblad; ver
    [contracts/order-book-api.md](../024-player-order-book/contracts/order-book-api.md) para cómo crear
    órdenes vía API si hace falta poblar datos).
  - Al menos dos posiciones distintas en el portfolio (para ver más de una porción en la distribución).

## Escenario 1 — Evolución de cotización (reemplazo)

1. Loguearse y entrar a la ficha de un jugador con historial de cotizaciones
   (`/catalog/:playerId`).
2. Verificar que el gráfico de evolución de cotización se ve como un gráfico de línea (Recharts), no como
   el SVG manual anterior.
3. Comparar los valores mostrados (fecha, valor) contra el historial devuelto por
   `GET /players/:id/quotes` (o el endpoint equivalente que ya consume `catalogService`): deben coincidir
   punto a punto con lo que mostraba la versión anterior.

**Resultado esperado**: mismos datos, nueva implementación visual.

## Escenario 2 — Evolución de capital de portfolio (reemplazo)

1. Entrar al portfolio del usuario de prueba.
2. Verificar que el gráfico de evolución de capital se ve como un gráfico de área (Recharts).
3. Comparar el capital neto final y los puntos intermedios contra el historial de transacciones del
   usuario: deben coincidir con lo que mostraba la versión anterior.

**Resultado esperado**: mismos datos, nueva implementación visual.

## Escenario 3 — Composición de la estrategia activa (nuevo)

1. Entrar a la sección de estrategias del usuario de prueba.
2. Expandir o visualizar la estrategia marcada como activa.
3. Verificar que aparece un gráfico de barras con un factor por barra, proporcional a su peso configurado.
4. Si algún factor tiene peso `0`, verificar que aparece en el gráfico con barra nula, no que se omite.

**Resultado esperado**: el gráfico refleja exactamente los pesos ya configurados para la estrategia activa.

## Escenario 4 — Profundidad del libro de órdenes (nuevo)

1. Entrar a la ficha de un jugador con órdenes de compra y venta activas en niveles de precio distintos.
2. Verificar que, junto a (o debajo de) las columnas de Compras/Ventas ya existentes, aparece un gráfico
   de profundidad que agrupa el volumen por nivel de precio, distinguiendo compra de venta por color.
3. Entrar a la ficha de un jugador sin órdenes activas y verificar que el gráfico muestra un estado vacío
   equivalente al de la vista tabular.

**Resultado esperado**: el gráfico agrupa correctamente ambos lados del libro por nivel de precio.

## Escenario 5 — Distribución del portfolio (nuevo)

1. Entrar al portfolio del usuario de prueba con múltiples posiciones.
2. Verificar que, junto a la tabla de posiciones existente, aparece un gráfico de torta/dona con una
   porción por jugador, proporcional a `tokenQuantity * currentPrice`.
3. Entrar con un portfolio sin posiciones y verificar el estado vacío equivalente al de la tabla.

**Resultado esperado**: las proporciones del gráfico son consistentes con los valores de la tabla de
posiciones.

## Validación automatizada

- `npm run test` (o `vitest run`) en `frontend/` — deben pasar, sin modificar tests existentes salvo para
  adaptarlos a los nuevos selectores de Recharts (mismas aserciones de datos).
- `npm run build` (`vite build`) en `frontend/` — debe compilar sin errores con la nueva dependencia.
- Tests unitarios puros de `frontend/src/utils/orderBookDepth.spec.ts` — deben cubrir: libro vacío, un solo
  nivel, niveles solo de un lado, niveles mixtos en varios precios.
