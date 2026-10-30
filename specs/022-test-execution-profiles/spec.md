# Feature Specification: Perfiles de ejecución de tests separados por costo

**Feature Branch**: `022-test-execution-profiles`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Los tests del proyecto se separan en perfiles según su costo de ejecución: unitarios (rápidos, sin dependencias externas) por un lado, y de integración/e2e (más lentos, requieren testcontainers levantando una base real) por otro. En cada push a cualquier branch corre solo el perfil unitario, dando feedback rápido sin pagar el costo de levantar containers. En cada PR contra main corren además los perfiles de integración y e2e, antes de permitir el merge. La separación se hace por convención de nombre de archivo..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Push a rama recibe feedback rápido (Priority: P1)

Un desarrollador hace push a cualquier rama (incluyendo ramas feature, hotfix, etc.). El pipeline de CI corre únicamente los tests unitarios, sin levantar ningún contenedor ni base de datos. El resultado llega en segundos/pocos minutos, dando señal verde o roja sobre el estado del código sin esperar recursos costosos.

**Why this priority**: Es el cambio de experiencia más inmediato y el que impacta el ciclo corto de desarrollo diario. Sin esta historia, el costo de cada push es el mismo que el de un PR, desincentivando commits frecuentes y pequeños.

**Independent Test**: Se puede verificar de forma aislada ejecutando `jest --testPathPattern=".spec.ts"` (excluyendo `.integration.spec.ts` y `.e2e-spec.ts`) y comprobando que ningún contenedor Docker se levanta durante la corrida.

**Acceptance Scenarios**:

1. **Given** un push a cualquier rama que no sea main, **When** el pipeline de CI se dispara, **Then** solo se ejecutan los tests unitarios (archivos que coinciden con el patrón `*.spec.ts` sin ser `*.integration.spec.ts` ni `*.e2e-spec.ts`), y el job termina sin haber iniciado ningún contenedor de base de datos.
2. **Given** un test unitario que falla, **When** el pipeline de CI corre el perfil unitario, **Then** el job reporta fallo y bloquea el push con el mensaje de error del test fallido.
3. **Given** todos los tests unitarios pasan, **When** el pipeline de CI corre el perfil unitario, **Then** el job reporta éxito y el push queda registrado como verde.

---

### User Story 2 - PR contra main corre la suite completa (Priority: P1)

Un desarrollador abre un Pull Request hacia main. El pipeline de CI corre, además del perfil unitario, los perfiles de integración y e2e del backend y el perfil de integración del frontend (todos requieren Testcontainers). El merge queda bloqueado hasta que todos los perfiles pasen en verde.

**Why this priority**: Es la segunda mitad del trade-off central: los tests costosos corren antes de que el código entre a la rama principal, evitando roturas silenciosas de integración tanto en backend como en frontend.

**Independent Test**: Se puede verificar abriendo un PR de prueba y comprobando que el workflow de CI ejecuta los perfiles pesados de backend (integración + e2e) y el perfil de integración del frontend en el contexto del PR antes de habilitar el merge.

**Acceptance Scenarios**:

1. **Given** un PR abierto contra main con todos los tests pasando, **When** el pipeline de CI corre, **Then** se ejecutan los perfiles pesados de backend (integración + e2e) y el perfil de integración del frontend, y el PR queda habilitado para merge.
2. **Given** un PR abierto contra main donde un test de integración de backend falla, **When** el pipeline de CI corre, **Then** el job reporta fallo en el perfil de integración y el merge queda bloqueado hasta que se corrija.
3. **Given** un PR abierto contra main donde un test e2e de backend falla, **When** el pipeline de CI corre, **Then** el merge queda bloqueado con el error del test e2e reportado.
4. **Given** un PR abierto contra main donde un test de integración de frontend falla, **When** el pipeline de CI corre, **Then** el merge queda bloqueado con el error del test de integración de frontend reportado.

---

### User Story 3 - Ningún test existente se modifica (Priority: P2)

La separación de perfiles se logra únicamente cambiando cómo Jest invoca los tests (configuración, scripts de npm, workflow de CI), sin tocar el código interno de ningún test existente. Los tests siguen siendo identificables por su nombre de archivo, sin agregar anotaciones ni decoradores nuevos.

**Why this priority**: Preservar los tests intactos es una restricción de governance (Constitución IX). Modificar tests para hacerlos "caber" en un perfil rompería la red de seguridad existente.

**Independent Test**: Se puede verificar con `git diff` después de implementar la feature: ningún archivo bajo `**/*.spec.ts`, `**/*.integration.spec.ts` ni `**/*.e2e-spec.ts` debe aparecer modificado.

**Acceptance Scenarios**:

1. **Given** la feature implementada, **When** se compara el estado de todos los archivos de test con el estado anterior, **Then** ningún archivo de test existente muestra diferencias de contenido.
2. **Given** la convención de nombres ya establecida en el proyecto (`*.spec.ts` para unitarios, `*.integration.spec.ts` para integración, `*.e2e-spec.ts` para e2e), **When** Jest ejecuta el perfil unitario, **Then** discrimina los archivos correctamente sin necesidad de anotaciones adicionales en el código de los tests.

---

### Edge Cases

- ¿Qué ocurre si un archivo de test no sigue la convención de nombre establecida? El perfil correspondiente lo ignorará silenciosamente; el desarrollador no recibirá error, sino ausencia de ejecución. Se asume que la convención ya se respeta en todos los tests existentes.
- ¿Qué ocurre si se hace push a main (por el merge de un PR o directo)? Corren también los perfiles pesados y SonarCloud (commit `9ad1990`), de modo que main nunca queda sin verificación completa. Bloquear los pushes directos sigue siendo una política de GitHub, no un comportamiento de los perfiles de test.
- ¿Puede un desarrollador correr localmente el perfil de integración/e2e antes de abrir el PR? Sí, mediante el script de npm correspondiente; pero no hay forma de dispararlo automáticamente en CI para una rama sin PR abierto.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST disponer de dos perfiles de ejecución de tests claramente separados: **unitario** (sin dependencias externas) e **integración+e2e** (requiere Testcontainers y base de datos real).
- **FR-002**: El perfil unitario MUST incluir únicamente los tests identificados por el patrón de nombre `*.spec.ts`, excluyendo explícitamente `*.integration.spec.ts` y `*.e2e-spec.ts`.
- **FR-003**: El perfil de integración MUST incluir únicamente los tests identificados por el patrón `*.integration.spec.ts`.
- **FR-004**: El perfil e2e MUST incluir únicamente los tests identificados por el patrón `*.e2e-spec.ts`.
- **FR-005**: El pipeline de CI MUST ejecutar solo el perfil unitario en cada push a cualquier rama que no sea main.
- **FR-006**: El pipeline de CI MUST ejecutar los perfiles pesados de backend (integración + e2e) y el perfil de integración del frontend en cada PR abierto contra main, antes de habilitar el merge, y también en cada push a main.
- **FR-007**: La separación de perfiles MUST implementarse mediante configuración (scripts npm, configuración de Jest, workflow de CI), sin modificar el contenido de ningún archivo de test existente.
- **FR-008**: Cada perfil MUST poder ejecutarse de forma independiente mediante un comando local documentado, de modo que un desarrollador pueda correr el perfil costoso antes de abrir el PR si lo desea.
- **FR-009**: El pipeline de CI MUST bloquear el merge del PR si cualquier test de cualquier perfil falla.
- **FR-010**: El job de SonarCloud, que ejecuta la suite completa con cobertura (unit + integración + e2e), MUST seguir la misma condición que los perfiles pesados (PR contra main o push a main). En pushes a ramas y en PRs contra dev solo corren los jobs unitarios.

### Key Entities

- **Perfil unitario**: conjunto de tests que corren sin infraestructura externa, identificados por `*.spec.ts` (excluyendo los subpatrones de integración y e2e). Se ejecuta en cada push.
- **Perfil de integración (backend)**: tests contra base de datos real efímera (Testcontainers), identificados por `*.integration.spec.ts` bajo `backend/src/`. Se ejecuta solo en PRs contra main y en push a main.
- **Perfil e2e (backend)**: tests de extremo a extremo con supertest + base real efímera, identificados por `*.e2e-spec.ts` bajo `backend/test/`. Se ejecuta solo en PRs contra main y en push a main.
- **Perfil de integración (frontend)**: tests de componentes que ejercitan el cliente HTTP real contra el backend con base efímera (Testcontainers), bajo `frontend/test/`. Se ejecuta solo en PRs contra main y en push a main.
- **Análisis SonarCloud**: job que ejecuta la suite completa con cobertura (unit + integración + e2e backend, unit frontend) y publica el análisis. Tiene la misma condición de ejecución que los perfiles pesados.
- **Pipeline de CI**: workflow de GitHub Actions que determina qué perfiles correr según el evento que lo disparó (push a rama vs. PR contra main).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un push a una rama feature completa el job de CI de tests en menos de 3 minutos sin levantar ningún contenedor de base de datos.
- **SC-002**: Un PR contra main ejecuta los perfiles pesados (backend: integración + e2e; frontend: integración) sin intervención manual, y el resultado es visible en la página del PR antes de poder mergear.
- **SC-003**: El 100% de los archivos de test existentes permanece sin modificaciones de contenido después de implementar la feature (verificable con diff).
- **SC-004**: Cada perfil puede dispararse individualmente con un único comando local, sin necesidad de configuración adicional por parte del desarrollador.

## Assumptions

- La convención de nombre de archivo (`*.spec.ts` / `*.integration.spec.ts` / `*.e2e-spec.ts`) ya está respetada por todos los tests existentes en el proyecto; no hay tests fuera de convención que deban reclasificarse.
- El repositorio usa GitHub Actions como sistema de CI; el workflow se configura en `.github/workflows/`.
- La rama de integración principal es `main`; la condición del perfil costoso se basa en `pull_request` con base `main` o `push` a `main`.
- Queda fuera de alcance (riesgo aceptado): un push a una rama feature puede introducir una rotura de integración que no se detecta hasta que se abre el PR. No se provee mecanismo para disparar el perfil costoso sobre una rama sin PR desde CI.
- Trade-off aceptado: como SonarCloud sigue la misma condición que los perfiles pesados, no se analizan los pushes a ramas ni los PRs contra dev; el análisis de calidad se hace al integrar a main.
- Queda fuera de alcance: proteger main contra pushes directos (política de rama de GitHub, no responsabilidad de esta feature).
