# Research: Alertas de precio por estrategia personal

No quedan `NEEDS CLARIFICATION` pendientes de la spec ni del input de planning: el
usuario ya resolvió las decisiones técnicas principales (Observer vía `EventEmitter2`,
dos listeners independientes para `alert.triggered`, SSE en vez de WebSockets,
`@nestjs-modules/mailer` sobre Nodemailer). Este documento registra las decisiones
derivadas necesarias para el diseño (Phase 1) y sus alternativas descartadas.

## 1. Mecanismo de evento interno: `@nestjs/event-emitter`

- **Decision**: Usar `@nestjs/event-emitter` (wrapper de NestJS sobre `eventemitter2`)
  con eventos síncronos (`eventEmitter.emit`) para `quote.recalculated` y
  `alert.triggered`. El emisor no espera resultado de los listeners (fire-and-forget).
- **Rationale**: Es la única pieza explícitamente pedida en el input de planning
  (`@nestjs/event-emitter`, patrón Observer). Permite que `QuotationService` emita el
  evento sin conocer quién lo consume, cumpliendo el requisito de la spec FR-021 de que
  "ninguno de los tres módulos... conoce a los otros dos directamente". Los listeners de
  `alert.triggered` (notificación y mail) corren de forma independiente entre sí porque
  cada uno es un `@OnEvent` separado: si uno lanza, no afecta la ejecución del otro (cada
  handler se invoca en su propio try/catch interno de `eventemitter2` cuando se usa modo
  async-por-handler; se documenta explícitamente el manejo de errores en la Decision #4).
- **Alternatives considered**:
  - **Cola de mensajes externa (p. ej. BullMQ/Redis)**: sobredimensionado para el alcance
    actual (un solo proceso, sin necesidad de persistencia de cola ni reintentos
    automáticos — la spec explícitamente acepta que un email fallido no se reintente).
  - **Llamada directa entre Services** (`AlertsService` inyecta `NotificationsService`):
    viola el desacople pedido en la decisión de diseño documentada en la spec y acopla
    `quotation` → `alerts` → `notifications` en cascada, dificultando testear cada módulo
    en aislamiento.

## 2. Notificaciones push en vivo: Server-Sent Events (SSE)

- **Decision**: Endpoint `GET /notifications/stream` (SSE, vía `@Sse()` de NestJS, que
  internamente expone un `Observable<MessageEvent>`). El `AlertNotificationListener`
  persiste la `Notification` y, además, emite hacia un `Subject` por usuario conectado
  (mantenido en memoria dentro de `NotificationsService`) para que el `Observable` SSE
  de ese usuario emita el nuevo evento.
- **Rationale**: Pedido explícitamente en el input de planning ("SSE en vez de
  WebSockets, por ser notificación unidireccional servidor→cliente"). `@Sse()` es
  soporte de primera clase en NestJS, no requiere librerías nuevas, y se autentica igual
  que cualquier otro endpoint HTTP vía `JwtAuthGuard` (con el JWT pasado como query param
  o header, según lo que soporte el cliente `EventSource` del browser — se resuelve en
  Phase 1/data contracts).
- **Alternatives considered**:
  - **WebSockets** (`@nestjs/websockets`): permite bidireccionalidad que esta feature no
    necesita (el cliente nunca envía datos por ese canal); agrega complejidad de
    protocolo y de testing que SSE no tiene.
  - **Polling periódico del frontend**: más simple de implementar pero no cumple el
    requisito de actualización "en vivo" (FR-018) sin introducir latencia perceptible o
    carga innecesaria de requests.
- **Known limitation aceptada**: si el usuario no está conectado en el momento del
  disparo, no hay reintento de push (ya aceptado como riesgo en la spec); al reconectar,
  el listado inicial (`GET /notifications`) ya refleja lo generado mientras no estaba.
- **Riesgo de exposición del JWT en query string**: pasar el JWT como query param expone
  el token en logs de acceso del servidor/proxy y en el historial del browser. Mitigación
  adoptada: el middleware de logging existente (Correlation ID, Principio VII) MUST
  excluir el query string completo al loguear requests a `/notifications/stream`, y el
  JWT usado para esta conexión MUST tener el mismo vencimiento corto ya definido para
  cualquier JWT (no se emite un token de vida más larga para este caso). Se documenta como
  decisión aceptada y acotada a este endpoint, no como excepción general al principio de
  no loguear secretos.

## 3. Envío de mail: `@nestjs-modules/mailer` + Nodemailer

- **Decision**: `MailModule` (de `@nestjs-modules/mailer`) configurado con transporte
  SMTP vía variables de entorno (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`,
  `MAIL_FROM`). El acceso real a Nodemailer queda detrás de un `MailAdapter` propio
  (interfaz de dominio `sendAlertTriggeredMail(to, payload)`) en
  `backend/src/adapters/mail/`, consumido únicamente por el listener de mail — nunca
  importado directamente por un Service, siguiendo el Principio I de la constitución
  (Adapter como única puerta a librerías externas).
- **Rationale**: Es la librería explícitamente pedida en el input de planning. Aislarla
  detrás de un Adapter permite testear el listener con un doble del Adapter (sin SMTP
  real) y reemplazar el proveedor (Gmail app password vs. Resend) sin tocar lógica de
  negocio.
- **Alternatives considered**:
  - **Llamar a Nodemailer directamente desde el Service**: viola el Principio I
    (Service no debe importar librerías de infraestructura directamente).
  - **Proveedor de mail transaccional con SDK propio (SendGrid, Resend SDK nativo)**: el
    input de planning deja la puerta abierta a Resend pero vía SMTP, no vía su SDK HTTP;
    se mantiene SMTP genérico para no atar el Adapter a un proveedor específico y poder
    apuntarlo a Gmail (app password) en demo/desarrollo sin cambiar código, solo env vars.
- **Manejo de fallo (FR-020)**: el listener de mail envuelve el envío en try/catch;
  ante una excepción, loguea con `Logger.error` (sin loguear el contenido del mail si
  incluyera datos sensibles — no es el caso aquí, solo jugador/condición/valor/fecha) y
  retorna sin relanzar, para no afectar al resto del procesamiento del recálculo ni a la
  notificación ya persistida por el otro listener.

## 4. Independencia entre los dos listeners de `alert.triggered`

- **Decision**: `AlertNotificationListener` y `AlertMailListener` son dos clases
  `@Injectable()` separadas, cada una con su propio método `@OnEvent('alert.triggered')`,
  registradas en `NotificationsModule`. Ninguna depende de la otra ni comparte estado.
- **Rationale**: Cumple FR-021 literalmente. Con `eventemitter2` (base de
  `@nestjs/event-emitter`), cuando hay múltiples listeners para el mismo evento, una
  excepción no capturada dentro de un listener async se resuelve como una promesa
  rechazada de ese listener puntual: no interrumpe la invocación de los demás listeners
  registrados para el mismo evento. Aun así, cada listener envuelve su propia lógica en
  try/catch interno para loguear el fallo explícitamente (FR-020) en lugar de depender
  implícitamente de ese comportamiento de la librería.
- **Alternatives considered**: un único listener que hace ambas cosas secuencialmente
  (persistir notificación y enviar mail) — descartado porque un fallo de mail podría
  quedar mezclado con la lógica de persistencia y porque la spec pide explícitamente que
  reaccionen "de forma independiente entre sí".

## 5. Trigger del recálculo semanal (scheduler)

- **Decision**: No se construye un scheduler nuevo en esta feature. `quote.recalculated`
  se emite dentro de `QuotationService.recalculateAll()` (el método ya invocado tanto por
  `POST /quotes/recalculate` como por cualquier futuro job `@Cron` que llame al mismo
  método, siguiendo el patrón ya usado por `player-sync` y `football-data-sync`). Si en
  el futuro se agrega el recálculo semanal automático, heredará la emisión del evento sin
  cambios en el módulo de alertas.
- **Rationale**: El input de planning (Precondiciones) no pide crear el scheduler
  semanal como parte de esta feature; solo pide modificar `recalculateAll` para emitir el
  evento. Emitir el evento dentro del método, no en el controller, garantiza que
  cualquier disparador (manual o futuro cron) active la evaluación de alertas por igual.
- **Alternatives considered**: emitir el evento desde el controller
  `POST /quotes/recalculate` — descartado porque dejaría sin cobertura un futuro trigger
  por scheduler que no pase por ese controller.
