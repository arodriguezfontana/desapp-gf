# Feature Specification: Método de valuación intercambiable y piso de valor

**Feature Branch**: `refactor/orders-logic`

**Created**: 2026-10-26

**Status**: Implemented

**Input**: User description: "Corregir dos puntos débiles del cálculo de cotizaciones. (1) Un jugador no puede valer menos de 1: hoy los pesos negativos pueden producir precios negativos. (2) La constitución (Principio II) exige Strategy pattern para la valuación, con una interfaz común e implementaciones intercambiables y configurables en runtime; hoy hay una sola función de cálculo. Agregar una interfaz de valuación, una segunda implementación que mida las métricas acumuladas por partido jugado, y que cada estrategia de usuario pueda elegir su método."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un jugador nunca vale menos de 1 (Priority: P1)

El valor de un jugador no puede ser negativo ni menor que 1, aunque los pesos negativos de métricas disciplinarias (tarjetas) lleven el score por debajo de 0.

**Why this priority**: un precio negativo o cero no tiene sentido en un mercado donde se compran y venden tokens; `Order.create` no valida el precio, así que el piso se garantiza en el cálculo.

**Independent Test**: calcular la cotización de un jugador con tarjetas al máximo y una estrategia con pesos negativos dominantes: el score es negativo y el valor es exactamente 1.

**Acceptance Scenarios**:

1. **Given** una estrategia con pesos negativos dominantes y un jugador con las tarjetas en su bound máximo, **When** se calcula la cotización, **Then** el score es negativo y el valor es 1.
2. **Given** un jugador cuyo `1 + score × factorEscala` supera 1, **When** se calcula la cotización, **Then** el valor no se modifica.

### User Story 2 - Elegir el método de cálculo de mi estrategia (Priority: P1)

Un usuario puede elegir, por cada una de sus dos estrategias, con qué método se calcula el valor: `WEIGHTED` (el original: cada métrica contra su techo de temporada) o `PER_MATCH` (las métricas acumuladas se dividen por los partidos jugados, de modo que quien jugó menos partidos no queda penalizado).

**Why this priority**: es lo que convierte la valuación en un Strategy pattern real (interfaz común, implementaciones intercambiables, configurables en runtime), como exige la constitución.

**Independent Test**: dos jugadores con 10 goles, uno en 10 partidos y otro en 30: con `WEIGHTED` valen igual; con `PER_MATCH` el de 10 partidos vale más.

**Acceptance Scenarios**:

1. **Given** una estrategia propia, **When** el usuario hace `PATCH /users/me/strategies/:id/method` con `PER_MATCH`, **Then** la estrategia queda con ese método y la otra estrategia no cambia.
2. **Given** un método que no es `WEIGHTED` ni `PER_MATCH`, **When** se intenta cambiar, **Then** la respuesta es 400 y la estrategia no cambia.
3. **Given** la estrategia de otro usuario, **When** se intenta cambiar su método, **Then** la respuesta es 403.
4. **Given** una estrategia con `PER_MATCH` y un jugador sin `matchesPlayed`, **When** se calcula la cotización, **Then** se normaliza por temporada (no hay forma de repartir por partido).

### User Story 3 - Las cotizaciones registran su método (Priority: P2)

Cada cotización guardada registra el método con el que se produjo, como parte del snapshot de reproducibilidad (junto con los pesos y el factor de escala).

**Independent Test**: recalcular con una estrategia `PER_MATCH` y verificar que las cotizaciones persistidas guardan `PER_MATCH`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El valor de un jugador MUST ser `max(1, 1 + score × factorEscala)`. El score puede ser negativo; el valor nunca baja de 1. (Reemplaza 012 FR-010.)
- **FR-002**: El sistema MUST definir una interfaz común `PlayerValuator` con al menos dos implementaciones intercambiables: `WeightedMetricsValuator` (`WEIGHTED`) y `PerMatchValuator` (`PER_MATCH`).
- **FR-003**: Toda `ValuationStrategy` MUST tener un `method`; por defecto `WEIGHTED`, de modo que ningún precio ya calculado cambia.
- **FR-004**: `PerMatchValuator` MUST dividir las métricas acumuladas de temporada (`goals`, `assists`, `keyPasses`, `dribbles`, `totalTackles`, `yellowCards`, `redCards`) por `matchesPlayed` y compararlas con su bound de temporada repartido en 38 partidos. Las métricas que ya son promedios por partido no se modifican.
- **FR-005**: Si `matchesPlayed` es `null` o 0, `PerMatchValuator` MUST usar la normalización de temporada.
- **FR-006**: El usuario MUST poder cambiar el método de una estrategia propia con `PATCH /users/me/strategies/:id/method` (JWT; 400 método inválido, 403 estrategia ajena, 404 inexistente).
- **FR-007**: La respuesta de las estrategias MUST incluir `method`.
- **FR-008**: Cada `PlayerQuote` MUST guardar el `valuationMethod` con el que se produjo.
- **FR-009**: La documentación Swagger y la colección de Postman MUST reflejar el nuevo endpoint (constitución, Principio X).

### Key Entities

- **ValuationMethod**: enum `WEIGHTED | PER_MATCH`.
- **PlayerValuator**: interfaz del Strategy pattern; `valuate(player, strategy)` devuelve `{ score, value, appliedPosition, weightsUsed }`.
- **ValuationStrategy**: gana el atributo `method`.
- **PlayerQuote**: gana el atributo `valuationMethod` (snapshot).

## Decisions

### DD-001: Piso de valor en 1 (reemplaza el riesgo aceptado de 012 FR-010)

La spec 012 aceptaba valores negativos como riesgo conocido. Se descarta: el valor es el precio al que se operan los tokens y un precio menor a 1 no es operable. El piso coincide con el mínimo natural de la fórmula (`score = 0`). El score se sigue guardando sin recortar.

### DD-002: Strategy pattern con selección por estrategia de usuario

La constitución pide "una interfaz común, implementaciones intercambiables y configurables en runtime". Se resuelve con `PlayerValuator` más un registro (`getPlayerValuator`) que elige la implementación según `strategy.method`. El método es un atributo de la estrategia del usuario, así que se configura en runtime por usuario y no por variable de entorno. Las dos implementaciones comparten el mismo algoritmo y difieren solo en cómo normalizan una métrica (`MetricNormalizer`).

### DD-003: El bound por partido se deriva del bound de temporada

No se inventan límites nuevos: el techo por partido de una métrica acumulada es `bound / 38`. Así `PER_MATCH` no agrega constantes sin respaldo, y un jugador con el rendimiento máximo sostenido por partido llega a 1.

### DD-004: Migración con valor por defecto

La columna `valuation_method` se agrega con `DEFAULT 'WEIGHTED'` a `valuation_strategies` y `player_quotes`. Las filas existentes conservan su comportamiento.

## Assumptions

- Una temporada de liga tiene 38 partidos (constante `SEASON_MATCHES`).
- Fuera de alcance: exponer el método en el frontend y calcular los bounds a partir de los datos reales.

## Success Criteria

- **SC-001**: Ningún valor calculado es menor que 1.
- **SC-002**: Con el método por defecto, los valores son idénticos a los de antes (salvo los que eran menores a 1).
- **SC-003**: Todos los tests existentes siguen en verde, salvo el de pesos negativos de `calculate-player-value.spec.ts`, actualizado con permiso explícito para reflejar FR-001.
