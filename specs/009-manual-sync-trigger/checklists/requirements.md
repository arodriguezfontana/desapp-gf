# Specification Quality Checklist: Disparo manual de sincronización (WhoScored y Football-Data)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-05
**Feature**: [spec.md](../spec.md)

## Content Quality

- [ ] No implementation details (languages, frameworks, APIs) — **FALLA**: el pedido original nombra endpoints, header `x-api-key` y `@Cron`; la spec los conserva en FR-001, FR-005 y FR-004. Se pueden pasar a lenguaje de negocio, pero el pedido fue técnico y no se reescribió sin preguntar.
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders — parcial: la sección de decisiones y los riesgos mencionan tablas y campos internos porque el pedido los exige justificar.
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — resuelto en la sesión 2026-10-05 (Q1: quitar el conteo de matching).
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
- [ ] No implementation details leak into specification — mismo caso que Content Quality.

## Notes

- Primera validación: 4 ítems fallaban (12/16 pasan).
- Re-validación tras Q1 (sesión 2026-10-05): 14/16 pasan. Quedan 2 ítems de "implementation details", ligados al lenguaje técnico del pedido original (endpoints, `x-api-key`, `@Cron`), que no se reescribió sin preguntar.
- Decisiones tomadas sin preguntar (ver Assumptions): el tipo de retorno de los services cambia para devolver conteos; los controllers se crean porque no existen; cualquier ApiKey válida dispara la sincronización.
- Re-validación tras el rediseño (WhoScored asincrónico con 202 + `runId`, lock en memoria con 409): 14/16, sin cambios de casillas. El riesgo de solapamiento dejó de ser "aceptado" y pasó a mitigarse con un lock (FR-015); por eso salió de Riesgos aceptados.
- Los 2 ítems de implementation details ahora pesan más: la spec incluye códigos 202/409, `runId` y rutas. Siguen sin reescribirse.
- Resueltas: SC-004 vs FR-015 (el `@Cron` se salta y se loguea si hay una manual en curso), FR-004 vs lock (el horario no cambia, la implementación sí) y SC-005 (WhoScored se lee por el GET de estado). Casillas sin cambios: 14/16.
- Resueltas en la revisión siguiente: el GET de estado ahora exige ApiKey (FR-005, FR-006, FR-011, SC-001); "Fuera de alcance" y Assumptions distinguen qué se sincroniza (no cambia) de retorno de conteos y lock (sí cambian); FR-010 define `completed` (con unidades fallidas) frente a `failed` (corrida abortada).
- Pendientes para `/speckit-plan`: qué devuelve el GET para un `runId` inexistente o perdido tras un reinicio, si el `@Cron` genera `runId`, cuánto se guarda el estado de corridas terminadas, y que en Football-Data un segundo POST recibe 409 y no espera.
- Riesgo corregido frente al pedido: la spec 006 documenta corrupción silenciosa por solapamiento, no solo llamadas duplicadas (ver Decisiones de diseño).
- Q1 resuelta: ya no bloquea `/speckit-plan`. Los 2 ítems de implementation details siguen abiertos, a decidir por vos.
