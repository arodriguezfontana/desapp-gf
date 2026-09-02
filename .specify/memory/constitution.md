<!--
Sync Impact Report
==================
Version change: (uninitialized template) → 1.0.0
Rationale: Initial ratification. First concrete constitution replacing the unfilled
scaffold; establishes the full governing principle set for the project.

Modified principles: none (initial adoption)

Added sections:
  - Core Principles (11 principles):
      I. Arquitectura en capas
      II. Modelo de dominio rico
      III. Cada validación en su nivel
      IV. Autenticación
      V. Auditoría inmutable
      VI. Observabilidad
      VII. Documentación de la API
      VIII. Testing
      IX. Definición de terminado
      X. Idioma
      XI. Spec-first
  - Technology Stack & Constraints
  - Development Workflow & Quality Gates
  - Governance

Removed sections: none

Follow-up TODOs:
  - RATIFICATION_DATE set to 2026-09-02 (date of first formal adoption). Adjust if the
    team agrees on an earlier adoption date.
-->

# DesApp — Plataforma de Valuación de Jugadores Constitution

Plataforma de valoración de mercado de jugadores de fútbol. Monorepo único con backend
NestJS 11 + TypeScript y frontend React 19 + Vite + Tailwind. Trabajo grupal para la
cátedra de Desarrollo de Aplicaciones.

## Core Principles

### I. Arquitectura en capas

El backend MUST organizarse en capas con dependencias en un único sentido
(Controller → Service → {Dominio, Repository, Adapter}). Reglas no negociables:

- **Controller**: solo habla con **Service**. MUST NOT llamar a un Repository ni a un
  Adapter directamente. MUST NOT contener lógica de negocio. Las clases Request/Response
  (DTOs) viven en la capa de Controller y MUST convertirse a objetos de dominio antes de
  delegar: nunca cruzan hacia el Service tal cual llegan.
- **Service**: orquesta entre dominio, Repositories y Adapters. MUST NOT contener
  cálculos de negocio propios; delega esa lógica al dominio. MUST recibir y devolver
  objetos de dominio, nunca entidades de persistencia.
- **Dominio**: la lógica de negocio vive acá. Las clases de dominio MUST NOT llevar
  decoradores de TypeORM ni conocer NestJS, HTTP o la base de datos.
- **Repository**: es el único punto del sistema donde conviven dominio y persistencia.
  MUST recibir y devolver objetos de dominio; por dentro usa la entidad de persistencia
  y un mapper explícito sin lógica de negocio. El Service MUST NOT ver la entidad de
  persistencia ni el mapper.
- **Adapter**: única puerta de entrada a sistemas externos (p. ej. WhoScored,
  Football-Data.org), detrás de una interfaz de dominio propia.

**Rationale**: El sentido único de dependencias mantiene el dominio testeable en
aislamiento y permite cambiar framework, ORM o proveedor externo sin reescribir reglas
de negocio.

### II. Modelo de dominio rico

La lógica de negocio (cálculo de score de valuación, validación de si una venta es
posible, cálculo de ganancia/pérdida de una posición, reglas de compra/venta de tokens)
MUST vivir en clases de dominio, nunca en Controllers, Services ni Repositories.

Las estrategias de valuación MUST implementarse con Strategy pattern: una interfaz
común, implementaciones intercambiables y configurables en runtime. Cada cotización
MUST registrar la versión de la estrategia que la produjo.

**Rationale**: Un dominio rico concentra las decisiones de negocio en un solo lugar
verificable; versionar la estrategia hace auditable y reproducible cada cotización.

### III. Cada validación en su nivel

Cada tipo de validación MUST ocurrir en su nivel correspondiente:

- **DTO** (class-validator): forma y tipos del request; sanitización de input.
- **Service**: que lo pedido exista y la acción sea posible (el jugador existe, el
  usuario existe, hay tokens disponibles antes de intentar operar).
- **Dominio**: invariantes de negocio (p. ej. no vender más tokens de los que se
  poseen), lanzando excepciones propias del dominio, no errores genéricos.

Un único exception filter global (`AllExceptionsFilter`) MUST centralizar el manejo de
errores y devolver siempre el mismo formato de error JSON con el status code correcto
(400, 401, 403, 404, 409). El sistema MUST NOT filtrar stack traces ni mensajes internos
al cliente.

**Rationale**: Separar validaciones evita duplicación y huecos; un filtro único
garantiza respuestas de error consistentes y sin fugas de información.

### IV. Autenticación

Un usuario nuevo MUST recibir, al darse de alta, un JWT que actúa como su ApiKey. Ese
token MUST exigirse en todos los endpoints salvo el de alta de usuario. Las contraseñas
MUST almacenarse hasheadas (bcrypt o argon2). Ningún token ni contraseña MUST loguearse
ni persistirse en texto plano.

**Rationale**: Un único mecanismo de credencial simplifica el modelo de acceso; hashing
y ausencia de secretos en logs son mínimos de seguridad no negociables.

### V. Auditoría inmutable

Toda operación de compra/venta de tokens MUST quedar registrada en un log de auditoría
append-only con: autor, timestamp, estado anterior y estado posterior. Un asiento de
auditoría MUST NOT modificarse ni borrarse nunca.

**Rationale**: La traza inmutable es la fuente de verdad para reconstruir posiciones y
resolver disputas sobre operaciones.

### VI. Observabilidad

El backend MUST emitir logs estructurados, MUST propagar un Correlation ID mediante
middleware en toda la cadena de una request, y MUST exponer un endpoint de health check.

**Rationale**: Sin logs estructurados y correlación no se puede diagnosticar un
problema que cruza capas o servicios.

### VII. Documentación de la API

La API MUST documentarse con OpenAPI v3 vía `@nestjs/swagger`, generada desde los DTOs y
decoradores. La especificación OpenAPI MUST NOT escribirse ni editarse a mano.

**Rationale**: Documentación derivada del código no se desincroniza del comportamiento
real.

### VIII. Testing

- Los tests unitarios de dominio MUST ejecutarse sin NestJS y sin base de datos, y
  cubrir las estrategias de valuación y las clases de dominio en aislamiento.
- Los tests de integración de Services y Repositories MUST correr contra una base
  PostgreSQL real (no mocks de la base), levantada como servicio en el pipeline de CI.
- Los tests end-to-end MUST usar supertest sobre la app NestJS en memoria, y MUST vivir
  en su propia carpeta, nunca mezclados dentro de un test de Service.
- Todo comportamiento MUST cubrirse con casos felices y casos borde.
- Ningún test existente MUST modificarse ni borrarse para hacerlo pasar, en ninguna fase
  del desarrollo, sin pedir permiso explícito y recibir un "sí" primero. Si un test
  falla, se corrige la implementación; si el test parece mal escrito, se pregunta antes
  de tocarlo.

**Rationale**: La pirámide de tests con base real en integración detecta errores de
mapeo y persistencia; la regla sobre no tocar tests protege la red de seguridad del
grupo.

### IX. Definición de terminado

Un requerimiento MUST considerarse terminado solo cuando:

1. Tiene tests unitarios y de integración, felices y borde, y todos pasan.
2. La aplicación compila y levanta con la configuración local.
3. La documentación Swagger quedó actualizada con los endpoints nuevos.

**Rationale**: Un criterio explícito y compartido evita entregar trabajo a medias y
discusiones sobre qué cuenta como listo.

### X. Idioma

Los identificadores de código (clases, variables, funciones) MUST estar en inglés,
siguiendo la convención estándar del ecosistema TypeScript/NestJS. Los nombres de
dominio conceptual, los mensajes de error y la documentación MUST estar en español. Los
términos técnicos sin traducción natural (token, endpoint, dashboard) se mantienen en
inglés.

**Rationale**: El código sigue la convención del ecosistema y las herramientas; la
comunicación de negocio queda en el idioma de la cátedra y del enunciado.

### XI. Spec-first

Cada feature MUST nacer de una spec antes de escribir código. Toda ambigüedad del
enunciado MUST resolverse como una decisión explícita en la spec, con su justificación.

**Rationale**: Escribir la spec primero fuerza a acordar el alcance y a dejar registro
de por qué se decidió cada cosa.

## Technology Stack & Constraints

El proyecto MUST mantenerse dentro del siguiente stack salvo enmienda de esta
constitución:

- **Backend**: Node.js, NestJS 11, TypeScript 5.7 en modo `strict`.
- **Frontend**: React 19, Vite 8, TypeScript, Tailwind CSS 4.
- **Persistencia**: PostgreSQL, accedida vía TypeORM.
- **Base local**: PostgreSQL levantado con Docker (`docker-compose`).
- **CI**: PostgreSQL corre como servicio del propio workflow de GitHub Actions; los
  tests de integración y e2e MUST correr en CI contra esa base.
- **Testing**: Jest + supertest.
- **Estructura**: monorepo único con `backend/` y `frontend/`.

## Development Workflow & Quality Gates

- El flujo de trabajo es Spec-Driven Development (spec-kit):
  `/speckit-constitution` → `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement`. Los artefactos de `.specify/` se versionan.
- Todo cambio MUST pasar `lint` y la suite de tests completa (unit + integración + e2e)
  en CI antes de integrarse.
- Un cambio MUST NOT integrarse si viola una capa (Principio I), mueve lógica de negocio
  fuera del dominio (Principio II), o deja la documentación Swagger desactualizada
  (Principios VII y IX).
- La revisión de cada cambio MUST verificar explícitamente el cumplimiento de los
  principios afectados.

## Governance

- Esta constitución MUST prevalecer sobre cualquier otra práctica o preferencia
  individual del equipo.
- **Enmiendas**: cualquier integrante puede proponer una enmienda mediante un cambio a
  `.specify/memory/constitution.md`. La enmienda MUST documentar qué cambia y por qué, y
  MUST ser aprobada por el resto del grupo antes de integrarse.
- **Versionado** (semantic versioning del documento):
  - **MAJOR**: remoción o redefinición incompatible de un principio o de una regla de
    governance.
  - **MINOR**: se agrega un principio o una sección, o se expande materialmente una
    guía existente.
  - **PATCH**: aclaraciones, correcciones de redacción, refinamientos no semánticos.
- **Cumplimiento**: toda review de código MUST verificar la conformidad con esta
  constitución. Cualquier desviación deliberada MUST justificarse por escrito en la spec
  o en la descripción del cambio, o si no debe corregirse antes de integrar.

**Version**: 1.0.0 | **Ratified**: 2026-09-02 | **Last Amended**: 2026-09-02
