<!--
Sync Impact Report
==================
Version change: 1.5.0 → 1.6.0
Rationale: MINOR. Se generaliza el rol de Adapter del Principio I: ya no se limita a
"sistemas externos" (WhoScored, Football-Data.org), también MUST cubrir librerías de
infraestructura (hasheo, generación de valores aleatorios criptográficos), detrás de una
interfaz de dominio propia y sin que el Service pueda importarlas directamente. Motivo:
la regla ya se había aplicado dos veces por separado como caso puntual
(BcryptPasswordHasher para contraseñas, y ahora TokenHasher/Sha256TokenHasher para
ApiKeys) sin estar generalizada en la constitución. Consistentemente, el test de
arquitectura tsarch obligatorio del Principio IX ahora también MUST verificar que el
Service no importe esas librerías de infraestructura de forma directa. Ningún principio
se elimina ni se redefine de forma incompatible; el resto de ambos principios queda
intacto.

Modified principles:
  - I. Arquitectura en capas (el rol de Adapter se generaliza de "sistemas externos" a
    "sistemas externos y librerías de infraestructura"; se agrega la prohibición
    explícita de que el Service las importe directamente)
  - IX. Testing (el test de arquitectura tsarch obligatorio suma la verificación de que
    el Service no importe librerías de infraestructura directamente)

Added sections: none
Removed sections: none
Renumbered principles: none
Updated cross-references: none

Follow-up TODOs:
  - RATIFICATION_DATE se mantiene en 2026-09-02 (fecha de la primera adopción formal).
  - Cumplimiento pendiente: verificar que el test tsarch existente se actualice para
    cubrir la nueva regla (Service sin imports directos de librerías de hasheo o de
    generación de aleatoriedad criptográfica) antes de dar por conforme a v1.6.0 el
    trabajo en curso de specs/002-api-key-issuance.
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
  Football-Data.org) y a librerías de infraestructura (p. ej. hasheo, generación de
  valores aleatorios criptográficos), detrás de una interfaz de dominio propia. El
  Service MUST NOT importar esas librerías directamente: siempre pasa por el Adapter
  correspondiente.
- **Degradación ante fallo del proveedor externo**: si un proveedor externo falla o no
  responde, el sistema MUST seguir funcionando con los datos que ya tiene guardados
  localmente, en la medida de lo posible. Una operación que sólo depende de datos ya
  persistidos MUST NOT bloquearse por la caída del proveedor; sólo las funcionalidades
  que requieren datos frescos e inexistentes localmente pueden quedar indisponibles.

**Rationale**: El sentido único de dependencias mantiene el dominio testeable en
aislamiento y permite cambiar framework, ORM o proveedor externo sin reescribir reglas
de negocio. Aislar el proveedor detrás de un Adapter además permite que su caída degrade
sólo una parte del sistema y no lo tumbe entero. La misma lógica aplica a librerías de
infraestructura como hasheo o generación de aleatoriedad criptográfica: aislarlas detrás
de un Adapter permite reemplazarlas o testearlas con un doble sin tocar el Service, y
evita que la regla se resuelva caso por caso cada vez que aparece una librería nueva
(ya pasó con el hasheo de contraseñas y de nuevo con el hasheo de API keys).

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

La autenticación MUST basarse en JWT. El JWT se obtiene mediante un login independiente del alta, de forma que la sesión pueda renovarse sin volver a registrarse. Todo endpoint que necesite saber qué usuario está operando MUST
exigir un JWT válido; el alta de usuario y el login son las únicas excepciones. El JWT
MUST tener un vencimiento definido; el valor concreto de esa expiración es un detalle de
la spec de autenticación, no de esta constitución. Las contraseñas MUST almacenarse
hasheadas (bcrypt). Ningún JWT, contraseña ni dato personal del usuario MUST
loguearse ni persistirse en texto plano, y esta regla rige en todas las capas del sistema
(Controller, Service, dominio, Repository, Adapter y logs), no solo en la de
autenticación.

**Rationale**: Autenticar con un JWT evita transmitir las credenciales en cada request;
que el token venza acota en el tiempo el daño si el JWT se filtra; y separar el login del
alta permite renovar la sesión sin volver a registrarse. El hashing de contraseñas y la
ausencia de secretos —en logs o en almacenamiento en texto plano— son mínimos de
seguridad no negociables.

### V. Auditoría inmutable

Toda operación de compra/venta de tokens MUST quedar registrada en un log de auditoría
append-only con: autor, timestamp, estado anterior y estado posterior. El asiento MUST
además guardar el detalle de los cambios realizados en esa operación como un campo
propio y explícito, no algo que se infiere comparando el estado anterior con el
posterior. Un asiento de auditoría MUST NOT modificarse ni borrarse nunca.

**Rationale**: La traza inmutable es la fuente de verdad para reconstruir posiciones y
resolver disputas sobre operaciones; registrar el detalle del cambio como campo propio
evita reconstrucciones ambiguas y sobrevive a cambios de esquema en el estado.

### VI. Integridad transaccional

Cuando una operación modifica más de un estado a la vez —por ejemplo comprar o vender
tokens, que altera la disponibilidad de tokens, la posición del usuario, el saldo y el
registro de auditoría— todos esos cambios MUST aplicarse como una unidad atómica: o se
confirman todos o no se aplica ninguno. Una operación de este tipo MUST NOT quedar
parcialmente aplicada ante un error, dejando el sistema a mitad de camino. La lógica que
define qué cambios forman la unidad y que garantiza que se confirmen o se descarten
juntos MUST vivir en el dominio, no en el Service.

**Rationale**: Un estado a medio camino (tokens descontados sin registrar la posición,
saldo cobrado sin asiento de auditoría) corrompe la fuente de verdad y es irreconciliable
con la auditoría inmutable; concentrar la regla de atomicidad en el dominio la hace
testeable sin infraestructura y evita que cada Service reinvente el manejo de
consistencia.

### VII. Observabilidad

El backend MUST emitir logs estructurados, MUST propagar un Correlation ID mediante
middleware en toda la cadena de una request, MUST exponer un endpoint de health check, y
MUST exponer métricas de latencia y de tasa de error.

**Rationale**: Sin logs estructurados y correlación no se puede diagnosticar un
problema que cruza capas o servicios; las métricas de latencia y tasa de error permiten
detectar degradaciones antes de que se conviertan en incidentes.

### VIII. Documentación de la API

La API MUST documentarse con OpenAPI v3 vía `@nestjs/swagger`, generada desde los DTOs y
decoradores. La especificación OpenAPI MUST NOT escribirse ni editarse a mano.

**Rationale**: Documentación derivada del código no se desincroniza del comportamiento
real.

### IX. Testing

- Los tests unitarios de dominio MUST ejecutarse sin NestJS y sin base de datos, y
  cubrir las estrategias de valuación y las clases de dominio en aislamiento.
- Los tests de integración de Services y Repositories MUST correr contra una base
  PostgreSQL real (no mocks de la base).
- Los tests end-to-end MUST usar supertest sobre la app NestJS en memoria, y MUST vivir
  en su propia carpeta, nunca mezclados dentro de un test de Service.
- Toda base de datos real que necesiten los tests de integración o end-to-end MUST ser
  una instancia de PostgreSQL efímera levantada con Testcontainers, creada y destruida
  por la propia corrida de tests. Estos tests MUST NOT correr nunca contra la base
  persistente de desarrollo —ni en local ni en CI—: así los datos de prueba no se mezclan
  con los de desarrollo y las corridas pueden paralelizarse sin pisarse entre sí.
- MUST existir un test de arquitectura escrito con tsarch que corra junto al resto de la
  suite (y que falle el build igual que cualquier otro test) y verifique que se respeten
  las reglas de capas del Principio I: el sentido único de dependencias
  Controller → Service → {Dominio, Repository, Adapter}, el dominio sin decoradores de
  TypeORM ni imports de NestJS, el Service sin ver la entidad de persistencia ni el
  mapper, y el Service sin importar directamente librerías de infraestructura (hasheo,
  generación de valores aleatorios criptográficos): esas dependencias sólo MUST aparecer
  detrás de un Adapter.
- Todo comportamiento MUST cubrirse con casos felices y casos borde.
- Ningún test existente MUST modificarse ni borrarse para hacerlo pasar, en ninguna fase
  del desarrollo, sin pedir permiso explícito y recibir un "sí" primero. Si un test
  falla, se corrige la implementación; si el test parece mal escrito, se pregunta antes
  de tocarlo.

**Rationale**: La pirámide de tests con base real en integración detecta errores de
mapeo y persistencia; hacer esa base efímera con Testcontainers evita contaminar el
entorno de desarrollo y habilita la paralelización. El test de tsarch convierte las
reglas de capas del Principio I en un chequeo automático que no depende de que un
reviewer se acuerde de mirarlas. La regla sobre no tocar tests protege la red de
seguridad del grupo.

### X. Definición de terminado

Un requerimiento MUST considerarse terminado solo cuando:

1. Tiene tests unitarios y de integración, felices y borde, y todos pasan.
2. La aplicación compila y levanta con la configuración local.
3. La documentación Swagger quedó actualizada con los endpoints nuevos.
4. La colección de Postman del proyecto quedó actualizada con los endpoints nuevos o
   modificados, igual que se exige para Swagger.

**Rationale**: Un criterio explícito y compartido evita entregar trabajo a medias y
discusiones sobre qué cuenta como listo.

### XI. Idioma

Los identificadores de código (clases, variables, funciones) MUST estar en inglés,
siguiendo la convención estándar del ecosistema TypeScript/NestJS. Los nombres de
dominio conceptual, los mensajes de error y la documentación MUST estar en español. Los
términos técnicos sin traducción natural (token, endpoint, dashboard) se mantienen en
inglés.

**Rationale**: El código sigue la convención del ecosistema y las herramientas; la
comunicación de negocio queda en el idioma de la cátedra y del enunciado.

### XII. Spec-first

Cada feature MUST nacer de una spec antes de escribir código. Toda ambigüedad del
enunciado MUST resolverse como una decisión explícita en la spec, con su justificación.

**Rationale**: Escribir la spec primero fuerza a acordar el alcance y a dejar registro
de por qué se decidió cada cosa.

## Technology Stack & Constraints

El proyecto MUST mantenerse dentro del siguiente stack salvo enmienda de esta
constitución:

- **Backend**: Node.js 20, NestJS 11, TypeScript 5.7 en modo `strict`.
- **Frontend**: React 19, Vite 8, TypeScript, Tailwind CSS 4. MUST ser una aplicación
  web responsiva y comunicarse con el backend vía HTTP/REST.
- **Persistencia**: PostgreSQL, accedida vía TypeORM.
- **Base local**: PostgreSQL levantado con Docker (`docker-compose`).
- **CI**: los tests de integración y end-to-end MUST correr en CI usando la base efímera
  de Testcontainers (el runner MUST tener Docker disponible); MUST NOT depender de un
  PostgreSQL provisto como servicio del workflow ni de ninguna base persistente.
- **Testing**: Jest + supertest + Testcontainers + tsarch.
- **Estructura**: monorepo único con `backend/` y `frontend/`.

## Development Workflow & Quality Gates

- El flujo de trabajo es Spec-Driven Development (spec-kit):
  `/speckit-constitution` → `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement`. Los artefactos de `.specify/` se versionan.
- Todo cambio MUST pasar `lint` y la suite de tests completa (unit + integración + e2e +
  el test de arquitectura tsarch del Principio IX) en CI antes de integrarse.
- Un cambio MUST NOT integrarse si viola una capa (Principio I), mueve lógica de negocio
  fuera del dominio (Principio II), o deja desactualizada la documentación Swagger o la
  colección de Postman (Principios VIII y X).
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

**Version**: 1.6.0 | **Ratified**: 2026-09-02 | **Last Amended**: 2026-09-11
