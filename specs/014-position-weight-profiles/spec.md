# Feature Specification: Perfiles de Pesos por Posición

**Feature Branch**: `014-position-weight-profiles`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Una estrategia de valuación puede definir, opcionalmente, un perfil de pesos específico por posición del jugador (FW, MF, DF, GK), además de sus pesos generales. Un perfil no necesita cubrir todas las métricas de la estrategia: puede limitarse a un subconjunto relevante para esa posición; las métricas no incluidas en el perfil tienen peso implícito 0 para esa posición. La suma de los pesos que sí incluye cada perfil debe dar exactamente 1.0 (±0.001), la misma validación que ya aplica a los pesos generales. Al calcular la cotización de un jugador, el sistema aplica automáticamente el perfil de su posición declarada si la estrategia activa lo define; si no hay perfil para esa posición, o el jugador no tiene posición cargada, o su posición no es ninguna de las cuatro reconocidas, usa los pesos generales de la estrategia, igual que hoy. No existe ningún flag para habilitar o deshabilitar esto: la aplicación es automática según la posición del jugador. Los perfiles de posición se cargan mediante seed, definidos por el equipo de desarrollo al mismo tiempo que los pesos generales de cada estrategia. El snapshot que ya se guarda en cada PlayerQuote se extiende para incluir si los pesos usados corresponden al perfil de una posición o al conjunto general de la estrategia. En el frontend, la vista de detalle de un jugador debe indicar si su cotización actual se calculó con un perfil de posición o con los pesos generales de la estrategia."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cotizar un jugador con el perfil de su posición (Priority: P1)

Al calcular la cotización de un jugador cuya posición (FW, MF, DF o GK) tiene un perfil de pesos definido en la estrategia activa, el sistema usa automáticamente ese perfil en lugar de los pesos generales.

**Why this priority**: Es el comportamiento central de la feature. Sin esto, los perfiles de posición existirían en el modelo pero nunca afectarían ninguna cotización real.

**Independent Test**: Se puede testear de forma aislada calculando la cotización de un jugador FW con una estrategia que define perfil para FW, y verificando que el score se calculó con los pesos del perfil FW (no con los generales), sin necesidad de base de datos.

**Acceptance Scenarios**:

1. **Given** una estrategia activa con perfil FW definido (goals=0.45, totalShots=0.25, assists=0.15, rating=0.15) y un jugador con posición FW, **When** se calcula su cotización, **Then** el score se calcula únicamente con esas cuatro métricas ponderadas por esos pesos, tratando el resto de métricas de la estrategia (incluidas en los pesos generales pero no en el perfil FW) como peso 0.
2. **Given** el mismo jugador y estrategia, **When** se calcula su cotización, **Then** el PlayerQuote resultante registra que el cálculo usó el perfil de posición FW (no los pesos generales).
3. **Given** una estrategia activa con perfiles definidos para las cuatro posiciones, **When** se calculan las cotizaciones de un jugador por cada una de las cuatro posiciones con métricas idénticas, **Then** cada cálculo usa el perfil correspondiente a su propia posición y los scores resultantes difieren según los pesos de cada perfil.

---

### User Story 2 - Cotizar un jugador sin perfil aplicable usando los pesos generales (Priority: P1)

Cuando la estrategia activa no define perfil para la posición del jugador, el jugador no tiene posición cargada, o su posición no es ninguna de las cuatro reconocidas, el sistema calcula la cotización con los pesos generales de la estrategia, exactamente como lo hace hoy sin esta feature.

**Why this priority**: Es el comportamiento de respaldo (fallback) que garantiza que ningún jugador quede sin poder cotizarse y que el comportamiento preexistente no se rompe. Tiene la misma prioridad que la Historia 1 porque ambas ramas (con y sin perfil) deben funcionar desde el primer incremento para que la feature sea segura de desplegar.

**Independent Test**: Se puede testear calculando la cotización de un jugador cuya posición no tiene perfil definido en la estrategia activa (por ejemplo, una estrategia que solo define perfil FW y un jugador DF) y verificando que el score coincide con el que se obtendría usando los pesos generales.

**Acceptance Scenarios**:

1. **Given** una estrategia activa que define perfil solo para FW y un jugador con posición DF, **When** se calcula su cotización, **Then** el sistema usa los pesos generales de la estrategia y el PlayerQuote registra que se usaron los pesos generales.
2. **Given** una estrategia activa sin ningún perfil de posición definido, **When** se calcula la cotización de cualquier jugador, **Then** el sistema usa los pesos generales, igual que antes de esta feature.
3. **Given** una estrategia activa con perfiles definidos para las cuatro posiciones, **When** se calcula la cotización de un jugador cuyo campo de posición no corresponde a ninguna de las cuatro posiciones reconocidas, **Then** el sistema usa los pesos generales sin error.

---

### User Story 3 - Seedear los perfiles de posición de las estrategias existentes (Priority: P2)

El equipo de desarrollo carga, junto con los pesos generales de "Performance general" y "Impacto táctico", los perfiles de posición definidos para cada una de las cuatro posiciones en ambas estrategias.

**Why this priority**: Sin datos seedeados, las Historias 1 y 2 no tienen perfiles reales que probar end-to-end en un entorno limpio; depende de que el modelo y la validación (Historia 1) ya existan.

**Independent Test**: Se puede testear levantando un entorno limpio y verificando en base de datos que ambas estrategias tienen los cuatro perfiles de posición con los pesos exactos especificados.

**Acceptance Scenarios**:

1. **Given** un entorno limpio recién seedeado, **When** se consulta la estrategia "Performance general", **Then** tiene perfiles para FW, MF, DF y GK con los pesos especificados (por ejemplo FW: goals=0.45, totalShots=0.25, assists=0.15, rating=0.15) y cada perfil suma 1.0 (±0.001).
2. **Given** un entorno limpio recién seedeado, **When** se consulta la estrategia "Impacto táctico", **Then** tiene perfiles para FW, MF, DF y GK con los pesos especificados (por ejemplo GK: rating=0.50, accuratePasses=0.35, interceptions=0.15) y cada perfil suma 1.0 (±0.001).

---

### User Story 4 - Ver en el detalle del jugador si se usó perfil o pesos generales (Priority: P3)

En la vista de detalle de un jugador, además del valor de la cotización actual, se muestra si ese valor se calculó con el perfil de la posición del jugador o con los pesos generales de la estrategia.

**Why this priority**: Es una mejora de transparencia para el usuario que depende de que el dato ya exista en el PlayerQuote (Historias 1 y 2); no bloquea el cálculo correcto de cotizaciones, por lo que puede entregarse después.

**Independent Test**: Se puede testear abriendo la ficha de un jugador cuya última cotización se calculó con un perfil de posición y verificando que la vista indica "perfil de posición", y luego abriendo la ficha de otro jugador cuya cotización usó pesos generales y verificando que la vista indica "pesos generales".

**Acceptance Scenarios**:

1. **Given** un jugador cuya cotización vigente se calculó usando el perfil de su posición, **When** se abre su vista de detalle, **Then** se indica que la cotización actual usó el perfil de posición correspondiente.
2. **Given** un jugador cuya cotización vigente se calculó usando los pesos generales (por no existir perfil aplicable), **When** se abre su vista de detalle, **Then** se indica que la cotización actual usó los pesos generales de la estrategia.

---

### Edge Cases

- ¿Qué sucede si una estrategia define perfil para una posición pero con pesos que no suman 1.0 (fuera de tolerancia ±0.001)? → El sistema rechaza la definición de esa estrategia/perfil con un error de validación, igual que ocurre hoy con los pesos generales.
- ¿Qué sucede si un perfil de posición incluye una métrica que no existe en los pesos generales de la estrategia? → Fuera de alcance de los datos de seed especificados; se asume que un perfil solo referencia métricas válidas del dominio (ver Assumptions).
- ¿Qué sucede si se cambia la estrategia activa después de calcular una cotización? → La cotización histórica conserva su snapshot original (pesos y el indicador de perfil/general usados en ese momento), sin verse afectada por el cambio, igual que el comportamiento histórico ya existente de PlayerQuote.
- ¿Qué sucede si un perfil de posición define un peso negativo para una métrica disciplinaria (como yellowCards)? → Se admite igual que en los pesos generales; la suma algebraica (incluyendo negativos) debe dar 1.0 (±0.001).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir que una estrategia de valuación defina, opcionalmente, hasta cuatro perfiles de pesos adicionales, uno por cada posición reconocida (FW, MF, DF, GK), independientes de sus pesos generales.
- **FR-002**: Un perfil de posición MUST poder incluir solo un subconjunto de las métricas de la estrategia; toda métrica de la estrategia no incluida explícitamente en el perfil MUST tratarse como peso 0 para ese perfil.
- **FR-003**: El sistema MUST validar que la suma de los pesos incluidos en cada perfil de posición sea exactamente 1.0 con tolerancia ±0.001, rechazando la definición si no cumple esta condición, con la misma regla de validación que ya aplica a los pesos generales de la estrategia.
- **FR-004**: Al calcular la cotización de un jugador, el sistema MUST usar el perfil de pesos correspondiente a la posición declarada del jugador si la estrategia activa define un perfil para esa posición.
- **FR-005**: Al calcular la cotización de un jugador, el sistema MUST usar los pesos generales de la estrategia activa (comportamiento preexistente) cuando ocurra cualquiera de estos casos: la estrategia activa no define perfil para la posición del jugador, el jugador no tiene posición cargada, o la posición del jugador no es ninguna de las cuatro reconocidas.
- **FR-006**: La selección entre perfil de posición y pesos generales MUST ser automática según la posición del jugador y la estrategia activa; el sistema MUST NOT exponer ningún flag o configuración para habilitar, deshabilitar o forzar manualmente este comportamiento.
- **FR-007**: El sistema MUST persistir en seed los perfiles de posición de "Performance general" (FW: goals=0.45, totalShots=0.25, assists=0.15, rating=0.15; MF: assists=0.30, keyPasses=0.30, dribbles=0.15, rating=0.25; DF: totalTackles=0.40, interceptions=0.25, rating=0.25, accuratePasses=0.10; GK: rating=0.50, accuratePasses=0.30, interceptions=0.20) y de "Impacto táctico" (FW: goals=0.45, totalShots=0.25, assists=0.15, rating=0.20, yellowCards=-0.05; MF: assists=0.25, keyPasses=0.25, accuratePasses=0.20, rating=0.20, totalTackles=0.10; DF: totalTackles=0.40, interceptions=0.35, rating=0.25; GK: rating=0.50, accuratePasses=0.35, interceptions=0.15), junto con los pesos generales ya existentes de cada estrategia.
- **FR-008**: Los perfiles de posición MUST cargarse exclusivamente mediante seed, definidos por el equipo de desarrollo al mismo tiempo que los pesos generales; el sistema MUST NOT ofrecer ninguna operación en runtime (administrativa o de otro tipo) para crear, editar o eliminar perfiles de posición.
- **FR-009**: El snapshot que el sistema registra en cada PlayerQuote MUST extenderse para incluir un indicador de si los pesos usados en ese cálculo corresponden al perfil de una posición (y cuál) o al conjunto general de la estrategia, preservando la reproducibilidad histórica ya garantizada para el snapshot de pesos.
- **FR-010**: La vista de detalle de un jugador en el frontend MUST indicar si la cotización vigente del jugador se calculó usando un perfil de posición o los pesos generales de la estrategia.

### Key Entities

- **PositionWeightProfile**: Perfil de pesos asociado a una ValuationStrategy y a una posición específica (FW, MF, DF o GK). Contiene un subconjunto de métricas con sus pesos decimales (admite negativos); las métricas de la estrategia no listadas en el perfil tienen peso implícito 0 para esa posición. La suma de los pesos que incluye debe ser exactamente 1.0 (±0.001). Una estrategia puede tener como máximo un perfil por posición, y los perfiles son opcionales (una estrategia puede no definir ninguno, o solo algunos).
- **PlayerQuote** *(extiende entidad existente)*: Además de los campos ya existentes (jugador, estrategia, snapshot de pesos y factorEscala, score, valor, timestamp), su snapshot ahora también indica si los pesos usados provienen de un perfil de posición (y de cuál posición) o de los pesos generales de la estrategia.

## Design Decisions *(mandatory)*

### DD-001: El perfil de posición admite un subconjunto de métricas en lugar de exigir el set completo

Un perfil de posición puede definir pesos solo para las métricas relevantes de esa posición, dejando el resto en peso implícito 0, en vez de requerir que cubra todas las métricas de la estrategia.

**Justificación**: Exigir el set completo de métricas obligaría a asignar pesos artificiales de 0 a métricas que no tienen sentido para una posición (por ejemplo, un arquero no necesita un peso para `goals`, ni un delantero para `interceptions`). Esos pesos en 0 no aportarían información y solo añadirían ruido a la definición del perfil, dificultando su lectura y mantenimiento por el equipo de desarrollo. Permitir subconjuntos hace que cada perfil declare únicamente lo que realmente importa para esa posición, manteniendo la misma garantía de interpretabilidad que los pesos generales (suma = 1.0 ±0.001) sin forzar completitud artificial.

### DD-002: Snapshot extendido con el origen de los pesos (perfil de posición vs. generales)

El snapshot de PlayerQuote ya almacena una copia de los pesos usados en el cálculo (ver DD-001 de la feature 012-valuation-strategies); esta feature añade un indicador explícito de si esos pesos provienen del perfil de una posición (y cuál) o del conjunto general de la estrategia.

**Justificación**: El snapshot de pesos por sí solo permite reproducir el cálculo numérico, pero no distingue si esos valores correspondían a un perfil de posición o a los generales; dos estrategias distintas podrían, en teoría, tener pesos numéricamente parecidos. Registrar explícitamente el origen preserva la auditoría histórica completa: permite responder no solo "qué pesos se usaron" sino "por qué se usaron esos pesos" (la posición del jugador en ese momento vs. la ausencia de perfil aplicable), sin tener que inferirlo indirectamente comparando el snapshot contra la definición actual de la estrategia (que además pudo haber cambiado desde entonces).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Para cualquier jugador con posición reconocida (FW, MF, DF o GK) y una estrategia activa que define perfil para esa posición, el score calculado coincide exactamente con el que resulta de aplicar los pesos del perfil (y peso 0 a las métricas no incluidas), verificable mediante tests de dominio puro sin base de datos.
- **SC-002**: Para cualquier jugador sin perfil aplicable (sin perfil definido para su posición, sin posición cargada, o con posición no reconocida), el score calculado coincide exactamente con el que resulta de aplicar los pesos generales de la estrategia, sin ninguna diferencia respecto al comportamiento anterior a esta feature.
- **SC-003**: En un entorno limpio recién seedeado, las estrategias "Performance general" e "Impacto táctico" tienen definidos los cuatro perfiles de posición especificados, cada uno con suma de pesos 1.0 (±0.001).
- **SC-004**: El 100% de las cotizaciones calculadas después de esta feature registran, en su snapshot, si usaron un perfil de posición (y cuál) o los pesos generales, de forma reconstruible independientemente de cambios posteriores en la estrategia.
- **SC-005**: Un usuario que abre la ficha de un jugador puede identificar, sin pasos adicionales, si la cotización mostrada se calculó con un perfil de posición o con los pesos generales de la estrategia.

## Assumptions

- Las cuatro posiciones reconocidas (FW, MF, DF, GK) y su representación en el dominio del jugador son las ya existentes en el catálogo de jugadores (feature 011-whoscored-player-metrics); esta feature no introduce nuevas posiciones ni cambia el modelo de posición del jugador.
- Un perfil de posición solo referencia métricas que también existen en los pesos generales de la misma estrategia; no se contempla que un perfil introduzca una métrica ajena al conjunto de métricas soportado por el dominio de cotización.
- No existe validación cruzada que impida que, en teoría, un perfil de posición y los pesos generales de la misma estrategia definan conjuntos de métricas completamente distintos (salvo las restricciones propias de cada uno: subconjunto válido del dominio y suma = 1.0); se confía en que el equipo de desarrollo, al definir el seed, mantenga perfiles coherentes con el propósito de la estrategia.
- Dado que la posición del jugador (`Position`) es hoy un campo validado y no nulo en el dominio de jugador, los casos de "sin posición cargada" o "posición no reconocida" descritos en la especificación se tratan como salvaguardas de robustez para datos futuros o fuentes externas, no como un estado alcanzable con los datos actuales del catálogo.
- La gestión de perfiles de posición sigue el mismo criterio ya establecido para la definición y activación de estrategias (feature 012-valuation-strategies): es responsabilidad del equipo de desarrollo vía seed, sin interfaz administrativa de edición en runtime.
