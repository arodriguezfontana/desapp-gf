# Quickstart: Alertas de precio por estrategia personal

Guía de validación manual end-to-end de la feature, una vez implementada. No reemplaza
los tests automatizados (unit/integración/e2e/componentes) requeridos por la
constitución — es la forma rápida de demostrar que el flujo completo funciona.

## Prerrequisitos

- Backend y PostgreSQL local levantados (`docker-compose up -d`, luego `npm run start:dev`
  en `backend/`).
- Frontend levantado (`npm run dev` en `frontend/`).
- Variables de mail configuradas en `backend/.env` (ver `.env.example` para los nombres;
  en desarrollo puede usarse una cuenta SMTP de prueba como [Mailtrap](https://mailtrap.io)
  o un Gmail con contraseña de aplicación).
- Un usuario autenticado (JWT válido) con al menos una estrategia de valuación activa
  (ver spec 019) y al menos una `PlayerQuote` ya calculada para un jugador del catálogo.
- Un API key de admin válido (para disparar `POST /quotes/recalculate`).

## Escenario 1 — Crear una alerta y verla en el listado propio

1. `POST /alerts` con el JWT del usuario, un `playerId` existente, `condition: "PRICE_BELOW"`
   y un `targetValue` mayor al valor actual de la cotización de ese usuario para ese
   jugador (para poder dispararla en el paso siguiente).
2. Verificar response `201` con `status: "ACTIVE"`.
3. `GET /alerts` con el mismo JWT → la alerta recién creada aparece en el listado.
4. (Negativo) Repetir el paso 1 con otro JWT (otro usuario) y confirmar que su
   `GET /alerts` no incluye la alerta del primer usuario.

## Escenario 2 — Disparo por recálculo, notificación en bandeja y email

1. Con la alerta del Escenario 1 todavía activa, forzar que la próxima cotización del
   usuario para ese jugador cumpla la condición (por ejemplo, ajustando los pesos de su
   estrategia activa para que el valor calculado quede por debajo del umbral).
2. Disparar `POST /quotes/recalculate` con el API key de admin.
3. `GET /notifications` con el JWT del usuario dueño de la alerta → debe aparecer una
   notificación nueva con el `playerId`, `condition`, `triggeredValue` y `createdAt`
   esperados, con `read: false`.
4. Revisar la casilla de email registrada del usuario → debe haber recibido un mail con
   la misma información.
5. Revisar los logs del backend → no debe haber errores si el mail se envió
   correctamente; si se simula una falla en el proveedor SMTP (credenciales inválidas),
   el log debe registrar el fallo y el paso 3 (`GET /notifications`) debe seguir
   devolviendo la notificación igual.
6. `PATCH /notifications/:id/read` sobre esa notificación → luego `GET /notifications`
   debe mostrarla con `read: true`.

## Escenario 3 — Push en vivo y cancelación

1. Abrir el frontend logueado como el usuario dueño de la alerta, con la campanita
   visible en el layout, dejando la pestaña abierta (conexión SSE activa).
2. Repetir el paso 2 del Escenario 2 (recalcular con una alerta que vuelva a cumplirse).
3. Verificar que el contador de no leídas de la campanita se actualiza sin recargar la
   página, y que al abrir la bandeja aparece la notificación nueva arriba de todo (más
   reciente primero).
4. Desde la UI, cancelar la alerta (botón "cancelar" en `PlayerAlertsList`).
5. Repetir el recálculo una vez más y confirmar que no se genera ninguna notificación
   nueva para esa alerta (sigue cumpliendo la condición, pero ya está cancelada).

## Resultado esperado

Todos los pasos anteriores pasan sin intervención manual en la base de datos ni en
código: crear, listar, cancelar, dispararse por recálculo, reflejarse en bandeja (con
push en vivo) y por email, y dejar de dispararse tras cancelar.
