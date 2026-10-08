# Feature Specification: Estrategias de Valuación de Jugadores

**Feature Branch**: `feat/strategies`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Una ValuationStrategy define los pesos de las métricas del jugador y un factorEscala. Los pesos son decimales; su suma debe ser exactamente 1.0 con tolerancia ±0.001 por redondeo flotante. Se admiten pesos negativos para métricas disciplinarias. El factorEscala es un decimal positivo propio de cada estrategia. Solo puede haber una estrategia activa a la vez; activar una desactiva cualquier otra automáticamente. ..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Calcular cotización con estrategia activa (Priority: P1)

El sistema debe poder calcular el valor de un jugador aplicando la estrategia de valuación activa: normaliza las métricas del jugador, pondera cada una según los pesos configurados y aplica el factor de escala para obtener un precio en créditos.

**Why this priority**: Es el núcleo funcional de toda la plataforma. Sin un cálculo correcto de cotizaciones, ninguna operación de compra/venta tiene sentido.

**Independent Test**: Se puede testear de forma completamente aislada instanciando la lógica de cálculo con métricas conocidas y verificando que el valor resultante sea el esperado, sin necesidad de base de datos ni red.

**Acceptance Scenarios**:

1. **Given** un jugador con métricas conocidas y una estrategia activa con pesos que suman 1.0 y factorEscala=99, **When** se calcula la cotización, **Then** el valor resultante es `1 + (score × 99)` donde score es la suma ponderada de métricas normalizadas.
2. **Given** un jugador con alguna métrica null, **When** se calcula la cotización, **Then** la métrica null se trata como 0 y el cálculo continúa sin error.
3. **Given** una estrategia con pesos negativos en métricas disciplinarias y un jugador con alto conteo de tarjetas, **When** se calcula la cotización, **Then** el score es más bajo que sin tarjetas, pudiendo incluso ser negativo, y el valor resultante se persiste tal cual (sin clamp).
4. **Given** un jugador con una métrica que supera el bound fijo del sistema, **When** se normaliza esa métrica, **Then** el valor normalizado es 1.0 (no supera el rango [0,1]).

---

### User Story 2 - Disparar recálculo masivo de cotizaciones (Priority: P2)

Un operador del sistema puede solicitar el recálculo de las cotizaciones de todos los jugadores en cualquier momento usando la estrategia activa, o esperar a que el job semanal lo ejecute automáticamente.

**Why this priority**: Garantiza que las cotizaciones reflejen las métricas actuales. Sin recálculo manual, un administrador no puede refrescar precios ante cambios de estrategia o nuevos datos sincronizados.

**Independent Test**: Se puede testear invocando el endpoint de recálculo con la API key correcta y verificando que se generan registros de cotización para cada jugador existente.

**Acceptance Scenarios**:

1. **Given** una API key de administrador válida y jugadores en el sistema, **When** se hace POST /quotes/recalculate, **Then** se calcula una cotización para cada jugador usando la estrategia activa y el sistema devuelve un resumen con jugadores procesados, errores y duración.
2. **Given** un recálculo ya en curso, **When** se hace otro POST /quotes/recalculate, **Then** el sistema devuelve 409 Conflict sin iniciar un segundo recálculo.
3. **Given** una request sin API key o con API key inválida, **When** se hace POST /quotes/recalculate, **Then** el sistema devuelve 401 sin ejecutar ningún recálculo.
4. **Given** que la hora del job semanal llega, **When** el job se dispara automáticamente, **Then** el sistema recalcula las cotizaciones de todos los jugadores igual que si se hubiera invocado el endpoint manual.

---

### User Story 3 - Activar una estrategia de valuación (Priority: P3)

Un administrador puede activar una de las estrategias de valuación disponibles. Al activarla, cualquier otra que estuviera activa se desactiva automáticamente, garantizando que solo haya una estrategia activa en todo momento.

**Why this priority**: Permite al sistema alternarse entre estrategias (por ejemplo, cambiar de "Performance general" a "Impacto táctico") de forma controlada. Depende de que las estrategias existan (seeded).

**Independent Test**: Se puede testear activando la Estrategia 2 cuando la Estrategia 1 está activa y verificando que la Estrategia 1 queda inactiva y la Estrategia 2 queda activa.

**Acceptance Scenarios**:

1. **Given** la Estrategia 1 está activa y la Estrategia 2 está inactiva, **When** se activa la Estrategia 2, **Then** la Estrategia 2 queda activa y la Estrategia 1 queda inactiva automáticamente.
2. **Given** la Estrategia 1 está activa, **When** se activa la Estrategia 1 (ya estaba activa), **Then** el estado no cambia y la Estrategia 1 sigue siendo la única activa.

---

### User Story 4 - Consultar historial de cotizaciones de un jugador (Priority: P4)

El sistema registra cada cotización calculada incluyendo un snapshot completo de la estrategia usada en ese momento. Esto permite auditar históricamente qué valor tenía un jugador y con qué criterios se calculó, aunque la estrategia haya cambiado después.

**Why this priority**: Es fundamental para la reproducibilidad y auditoría del sistema. Sin el snapshot, no se puede saber por qué un jugador tenía determinado precio en una fecha anterior.

**Independent Test**: Se puede testear calculando cotizaciones con una estrategia, cambiando la estrategia, calculando de nuevo y verificando que las cotizaciones históricas conservan los pesos originales en su snapshot.

**Acceptance Scenarios**:

1. **Given** cotizaciones calculadas con la Estrategia 1, **When** se consulta el historial de cotizaciones de un jugador, **Then** cada registro incluye el snapshot de pesos y factorEscala usados en ese cálculo y el timestamp correspondiente.
2. **Given** cotizaciones calculadas con la Estrategia 1, **When** se activa la Estrategia 2 y se recalcula, **Then** las cotizaciones antiguas conservan el snapshot de la Estrategia 1 y las nuevas reflejan la Estrategia 2.

---

### Edge Cases

- ¿Qué sucede si todos los jugadores tienen una métrica nula? → Se trata como 0 y el score queda determinado únicamente por los pesos de las demás métricas.
- ¿Qué sucede si el recálculo falla a mitad por un error inesperado? → Los jugadores procesados hasta ese punto conservan sus cotizaciones; el resumen de respuesta incluye el conteo de errores.
- ¿Qué sucede si el valor resultante es negativo? → Se persiste tal cual, sin clamp; el sistema acepta valores negativos como riesgo conocido.
- ¿Qué sucede si se intenta crear una estrategia con pesos que no suman 1.0 (fuera de tolerancia ±0.001)? → El sistema rechaza la operación con un error de validación.
- ¿Qué sucede si se intenta crear una estrategia con factorEscala ≤ 0? → El sistema rechaza la operación con un error de validación.
- ¿Qué sucede si no hay ninguna estrategia activa al momento del recálculo? → El sistema no puede calcular cotizaciones y el recálculo termina con error o no procesa ningún jugador.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST almacenar estrategias de valuación, cada una con un nombre descriptivo, un conjunto de pesos por métrica (decimales, admite negativos para disciplinarias) y un factorEscala decimal positivo.
- **FR-002**: El sistema MUST validar que la suma de los pesos de una estrategia sea exactamente 1.0 con tolerancia ±0.001; rechazar la estrategia si no cumple esta condición.
- **FR-003**: El sistema MUST validar que el factorEscala sea un valor decimal estrictamente positivo.
- **FR-004**: El sistema MUST garantizar que solo una estrategia esté activa en cualquier momento; activar una estrategia MUST desactivar automáticamente cualquier otra activa.
- **FR-005**: El sistema MUST normalizar cada métrica de jugador al rango [0,1] usando bounds fijos definidos como constantes: goals=40, assists=25, keyPasses=150, dribbles=200, totalTackles=150, totalShots=200, accuratePasses=2500, interceptions=100, rating=10, yellowCards=15, redCards=5. Una métrica null se trata como 0; una métrica que supera el bound se normaliza a 1.0.
- **FR-006**: El sistema MUST calcular el score de un jugador como la suma ponderada de sus métricas normalizadas: score = Σ(peso_i × métrica_i_normalizada).
- **FR-007**: El sistema MUST calcular el valor de un jugador como: valor = 1 + (score × factorEscala), donde 1 representa el precio base fijo del token en créditos.
- **FR-008**: El cálculo de normalización, score y valor MUST implementarse como lógica de dominio pura, sin acceso a base de datos ni dependencias del framework.
- **FR-009**: El sistema MUST registrar cada cotización calculada (PlayerQuote) con: referencia al jugador, referencia a la estrategia, snapshot completo de los pesos y factorEscala usados, score calculado, valor resultante y timestamp del cálculo.
- **FR-010**: Los valores negativos de cotización MUST persistirse sin ningún ajuste ni clamp.
- **FR-011**: El sistema MUST exponer un endpoint POST /quotes/recalculate protegido con ApiKeyGuard que dispare el recálculo de cotizaciones de todos los jugadores usando la estrategia activa.
- **FR-012**: Si un recálculo ya está en curso cuando se invoca POST /quotes/recalculate, el sistema MUST responder 409 Conflict sin iniciar un nuevo recálculo, usando un mecanismo de lock en memoria (mismo patrón que sync-trigger).
- **FR-013**: La respuesta del recálculo MUST incluir: número de jugadores procesados, número de errores y duración total.
- **FR-014**: El sistema MUST ejecutar el recálculo de cotizaciones automáticamente según un schedule semanal.
- **FR-015**: El sistema MUST persistir en seed dos estrategias predefinidas: "Performance general" (activa por defecto) con goals=0.25, assists=0.15, totalShots=0.10, keyPasses=0.10, dribbles=0.10, totalTackles=0.10, rating=0.20, factorEscala=99; y "Impacto táctico" con totalTackles=0.25, interceptions=0.20, accuratePasses=0.20, assists=0.20, keyPasses=0.15, rating=0.20, yellowCards=-0.05, redCards=-0.15, factorEscala=99.

### Key Entities

- **ValuationStrategy**: Estrategia de valuación con nombre, mapa de pesos por métrica (métrica → peso decimal, admite negativos), factorEscala decimal positivo y flag de activa/inactiva. Restricción de unicidad: solo una puede estar activa.
- **PlayerQuote**: Cotización calculada de un jugador en un momento dado. Referencia al jugador y a la estrategia. Snapshot de los pesos y factorEscala usados (desacoplado de la estrategia para reproducibilidad histórica). Score calculado, valor resultante y timestamp.
- **NormalizationBounds**: Constantes del sistema que definen los valores máximos de referencia para normalizar cada métrica al rango [0,1]. No es una entidad persistida; es parte de la lógica de dominio.

## Design Decisions *(mandatory)*

### DD-001: Snapshot de pesos en PlayerQuote para reproducibilidad histórica

Cada PlayerQuote registra una copia completa de los pesos y factorEscala de la estrategia usada en el momento del cálculo, en lugar de solo guardar una referencia a la estrategia.

**Justificación**: La referencia a la estrategia apunta al estado actual de la misma, no al estado que tenía cuando se calculó la cotización. Si los pesos de la estrategia cambian o la estrategia se desactiva, las cotizaciones históricas dejarían de ser reproducibles. El snapshot garantiza que cualquier cotización pasada puede reconstruirse exactamente con los mismos valores que la generaron, lo cual es esencial para auditoría de transacciones y para resolver disputas sobre el valor que tenía un jugador en una fecha concreta.

### DD-002: Bounds fijos de normalización como constantes del sistema

Los bounds de normalización (goals=40, assists=25, etc.) se definen como constantes inmutables en la lógica de dominio, no como parámetros configurables ni como datos en base de datos.

**Justificación**: Los bounds representan los máximos realistas que un jugador de élite puede alcanzar en una temporada completa (por ejemplo, 40 goles o 25 asistencias en liga son récords históricos excepcionales; 10 de rating es el máximo de la escala de WhoScored). Usar bounds fijos garantiza comparabilidad entre jugadores y entre temporadas: si los bounds fueran configurables, un cambio en ellos alteraría retroactivamente el significado de todos los scores ya calculados. Al ser constantes del sistema, el cálculo es reproducible e independiente de configuración externa.

### DD-003: Pesos negativos en estrategias y cumplimiento de suma = 1.0

La Estrategia 2 ("Impacto táctico") incluye pesos negativos para yellowCards (-0.05) y redCards (-0.15) con el fin de penalizar la indisciplina. La restricción suma = 1.0 se mantiene porque la suma algebraica de todos los pesos (positivos y negativos) da exactamente 1.0: 0.25 + 0.20 + 0.20 + 0.20 + 0.15 + 0.20 − 0.05 − 0.15 = 1.00.

**Justificación**: Los pesos negativos permiten modelar métricas que reducen el valor de un jugador (tarjetas, expulsiones) sin necesidad de invertir la métrica. La restricción suma = 1.0 sigue siendo semánticamente válida con pesos negativos: garantiza que un jugador hipotético con todas las métricas en su valor máximo normalizado (1.0) reciba un score de exactamente 1.0, preservando la interpretabilidad del rango. La tolerancia ±0.001 acomoda el redondeo flotante que ocurre al representar valores como 0.05 o 0.15 en IEEE 754.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El cálculo de cotización de un jugador (normalización + score + valor) produce el resultado correcto para cualquier combinación de métricas, incluyendo métricas null, valores en el límite del bound y pesos negativos, verificable mediante tests unitarios de dominio puro sin base de datos.
- **SC-002**: Solo una estrategia puede estar activa en cualquier momento; activar una nueva desactiva la anterior en la misma operación, verificable en base de datos tras la activación.
- **SC-003**: El endpoint POST /quotes/recalculate responde en menos de 30 segundos para un catálogo de hasta 1.000 jugadores.
- **SC-004**: El sistema rechaza una solicitud concurrente de recálculo con 409 antes de que el primero termine, sin lanzar un segundo proceso paralelo.
- **SC-005**: Cada PlayerQuote almacenada contiene el snapshot de pesos y factorEscala que produjo su score, y ese score es reproducible aplicando la fórmula con el snapshot y las métricas del jugador.
- **SC-006**: Las dos estrategias de seed están presentes en la base de datos en un entorno limpio con "Performance general" activa por defecto.
- **SC-007**: La Estrategia "Impacto táctico" calcula scores más bajos para jugadores con tarjetas amarillas o rojas que para jugadores con métricas idénticas pero sin tarjetas, verificable con un test unitario.

## Assumptions

- El recálculo usa siempre la estrategia marcada como activa en el momento de ejecución; si no hay ninguna activa, el job o el endpoint abortan sin procesar jugadores.
- La activación de estrategias es una operación administrativa que no se expone como endpoint público en esta feature; el cambio de estrategia activa se gestiona directamente en base de datos o mediante un endpoint futuro protegido.
- Las métricas de los jugadores ya están disponibles en el sistema (persistidas por la feature 011-whoscored-player-metrics); el recálculo de cotizaciones no sincroniza datos externos.
- El lock de concurrencia del endpoint POST /quotes/recalculate es en memoria (no distribuido); en un entorno con múltiples instancias del backend esto no es suficiente, pero se acepta para el alcance actual del proyecto académico.
- Un jugador sin métricas registradas se puede cotizar: todas sus métricas se tratan como null → 0, resultando en score = 0 y valor = 1 (el precio base).
