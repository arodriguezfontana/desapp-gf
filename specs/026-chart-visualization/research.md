# Research: Visualización gráfica de datos clave

## 1. Librería de gráficos

**Decision**: Recharts.

**Rationale**: Ya es una decisión de diseño explícita del usuario, a documentar (no a re-evaluar). Recharts
es una librería de gráficos declarativa basada en componentes React y SVG, sin dependencias nativas, que
cubre los cinco tipos de gráfico requeridos (línea, barras, profundidad/área, torta/dona) con una única
API consistente, y se integra naturalmente con Tailwind vía `className`/estilos inline, igual que los
componentes SVG hechos a mano que reemplaza.

**Alternatives considered**: Ninguna — la decisión ya fue tomada por el usuario en el pre-requerimiento del
plan. No corresponde evaluar Victory, Nivo, Chart.js ni D3 directo para esta feature.

## 2. Qué tipo de gráfico de Recharts usar por caso

**Decision**:
- Evolución de cotización de jugador → `LineChart` (una serie, igual que el polyline actual).
- Evolución de capital de portfolio → `AreaChart` (preserva el área bajo la curva y la línea de cero que
  ya tiene la versión hecha a mano).
- Composición de la estrategia activa → `BarChart` horizontal o vertical de un factor por barra, con el
  peso como valor.
- Profundidad del libro de órdenes → `BarChart` o `AreaChart` de dos series (compra/venta) por nivel de
  precio, con colores que preserven la convención ya usada (verde esmeralda para bids, rojo/rosa para
  asks).
- Distribución del portfolio → `PieChart` (modo dona), una porción por jugador en tenencia.

**Rationale**: Cada elección preserva la forma visual que ya tenía el dato (línea para serie temporal,
área para capital acumulado) o es el mapeo estándar para el tipo de comparación (barras para pesos/niveles
discretos, torta/dona para proporción de un total). No se introduce un tipo de gráfico no pedido por la
spec.

**Alternatives considered**: Gráfico de velas para cotización (descartado: la spec exige preservar
exactamente los mismos datos que el gráfico de línea actual, no agregar OHLC que no existe hoy). Treemap
para distribución de portfolio (descartado: una torta/dona es más legible para la cantidad esperada de
posiciones de un usuario y es el estándar de la industria para "proporción del total").

## 3. Cómo preservar exactamente los mismos datos en los reemplazos

**Decision**: Los nuevos `QuoteHistoryChart` y `PortfolioEvolutionChart` reciben las mismas props que la
versión actual (`quotes: PlayerQuote[]` y `transactions: TokenTransactionDto[]` respectivamente) y
reutilizan la misma lógica de transformación ya existente (deduplicación por día, cálculo de capital
acumulado) antes de pasar los puntos resultantes a Recharts. Los tests de componente existentes
(`QuoteHistoryChart.spec.tsx`, `PortfolioEvolutionChart.spec.tsx`) se adaptan a los selectores de Recharts
pero conservan las mismas aserciones sobre los valores mostrados.

**Rationale**: FR-002 y FR-003 exigen que el reemplazo no cambie los datos mostrados; mantener la misma
interfaz de props y la misma lógica de transformación (solo cambia el renderizado SVG manual por
componentes de Recharts) es la forma más directa de garantizarlo y de que los tests existentes seborren
mínimamente.

**Alternatives considered**: Reescribir también la transformación de datos "aprovechando" el cambio
(descartado explícitamente por la spec: "cambia únicamente la implementación, no el contenido").

## 4. Agrupamiento del libro de órdenes por nivel de precio

**Decision**: Función pura `buildOrderBookDepth(bids, asks)` en `frontend/src/utils/orderBookDepth.ts`,
que toma los niveles ya agregados por precio que expone `OrderBookResponseDto` (bids y asks, cada uno ya
con `price` y `totalQuantity` por nivel — el backend ya agrupa por nivel de precio) y los combina en una
única lista ordenada por precio, con una entrada por nivel que indica cantidad de compra y cantidad de
venta en ese nivel (0 si no hay órdenes de ese lado), lista para alimentar un `BarChart`/`AreaChart` de dos
series.

**Rationale**: El pre-requerimiento pide una función utilitaria pura y testeable sin red que agrupe
"un listado de órdenes por nivel de precio, separando compra y venta". Como el backend (`024-player-order-book`)
ya entrega bids/asks agregados por nivel, la función no repite ese agrupamiento de negocio: combina los dos
arrays ya agregados en la forma tabular que un gráfico de profundidad necesita (un registro por nivel de
precio con ambas series), que es exactamente la transformación de presentación que le corresponde al
frontend (Principio I: lógica de negocio en el dominio del backend; el frontend solo adapta datos ya
resueltos a la forma que su UI necesita).

**Alternatives considered**: Agrupar órdenes individuales (no agregadas) en el frontend (descartado: el
backend ya expone el nivel agregado vía `OrderBookResponseDto`; re-agrupar órdenes crudas en el cliente
duplicaría lógica de negocio que ya vive en el backend, violando el Principio I).

## 5. Dependencia nueva y su impacto en configuración

**Decision**: Agregar `recharts` a `frontend/package.json` (`dependencies`), sin variables de entorno
nuevas. Verificar que no quede nada suelto en `.gitignore` del frontend (no aplica: Recharts no genera
artefactos de build adicionales ni archivos de configuración propios).

**Rationale**: Es una librería de UI pura sin necesidad de configuración de entorno ni de build adicional
más allá de la resolución estándar de `npm`/`vite`.

**Alternatives considered**: Ninguna — confirmado en el pre-requerimiento del plan que no se agregan
variables de entorno.
