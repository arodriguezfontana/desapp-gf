# Specification Quality Checklist: Métricas técnicas (latencia y tasa de error) y SLA por endpoint

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-10
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Validación en la primera iteración: todos los ítems pasan.
- Prometheus y `prom-client` sólo aparecen en el campo **Input** (registro literal del pedido) y en FR-001/Assumptions como el formato exigido del endpoint; los requisitos y criterios describen comportamiento. El "middleware" y el "Interceptor" aparecen sólo en la sección "Decisión de diseño", que el pedido exige documentar.
- **Hueco del pedido (decisión tomada, a confirmar)**: el pedido remite a "la tabla de la Sección 4 del documento de visión", que **no está en el repositorio**. La tabla "SLA por endpoint" se armó con todos los endpoints realmente publicados por el backend (más `/`, `/health`, `/metrics`) y los umbrales son una propuesta por clase de operación. Quedó como decisión explícita en Assumptions (Principio XII). Si el documento de visión define un subconjunto, rutas o umbrales distintos, hay que ajustar la tabla antes de `/speckit-plan`.
- **Decisiones agregadas respecto del pedido** (todas derivan de su propio argumento de cardinalidad y de honestidad de la tasa de error):
  - La etiqueta de ruta es el **patrón** de la ruta (`/players/:id`), no sólo "un valor genérico para el 404": sin eso, un identificador distinto por request también generaría series sin límite (FR-006, historia 3).
  - El método HTTP se acota a un conjunto estándar con un valor genérico para el resto (FR-008): un método inventado generaría series sin límite.
  - El stream de notificaciones en vivo se cuenta pero no entra a la medida de latencia (FR-011): su duración es la de la conexión y distorsionaría el p95.
  - Las requests rechazadas antes de resolverse la ruta (cuerpo ilegible, `OPTIONS` de CORS) caen bajo la ruta genérica; el 503 del health check por base caída cuenta como 5xx.
  - Los límites de los intervalos de duración deben incluir cada umbral de latencia declarado (FR-016): sin eso el p95 sólo se puede estimar por interpolación y el SLA no es verificable con exactitud.
  - Una verificación automática falla si hay un endpoint sin SLA o un SLA sin endpoint (FR-017), para que la tabla no se desincronice del código.
- **Punto para la planificación**: la captura debe compartir el punto del middleware previo al body parser de la feature 028 (si no, los 400 por JSON ilegible quedan sin medir), y la etiqueta de ruta sólo se conoce una vez resuelta la ruta, es decir, al finalizar la respuesta. El plan debe verificar también que el total contado coincida con las entradas del log (FR-005).
