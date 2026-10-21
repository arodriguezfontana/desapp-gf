# Quickstart: Validación del Libro de Órdenes

Guía de verificación rápida para probar los flujos del libro de órdenes (`024-player-order-book`).

---

## Prerrequisitos

1. Backend corriendo en `http://localhost:3000`.
2. Frontend corriendo en `http://localhost:5173`.
3. Un usuario con sesión iniciada y token JWT disponible (`<TOKEN>`).
4. Al menos un jugador existente en el catálogo (`<PLAYER_ID>`).

---

## Escenario 1: Consulta de libro con órdenes agrupadas en Bids y Asks

1. Publicar dos órdenes de compra a diferentes precios para el jugador:
   * Orden 1: `side = BUY`, `quantity = 10`, valuación/precio ~ `20.00`.
   * Orden 2: `side = BUY`, `quantity = 5`, valuación/precio ~ `22.00`.
2. Publicar dos órdenes de venta:
   * Orden 3: `side = SELL`, `quantity = 8`, valuación/precio ~ `25.00`.
   * Orden 4: `side = SELL`, `quantity = 12`, valuación/precio ~ `25.00` (mismo precio que Orden 3).
3. Enviar consulta:
   ```bash
   GET http://localhost:3000/players/<PLAYER_ID>/order-book
   Authorization: Bearer <TOKEN>
   ```
4. **Verificación esperada**:
   * Código HTTP `200 OK`.
   * `bids`: contiene 2 niveles ordenados de mayor a menor (`22.00` con 5 tokens, luego `20.00` con 10 tokens).
   * `asks`: contiene 1 nivel consolidado (`25.00` con 20 tokens, resultado de 8 + 12).
   * Ningún identificador de usuario (`userId`) ni ID de orden (`orderId`) aparece en la respuesta.

---

## Escenario 2: Jugador sin órdenes activas (Libro vacío)

1. Seleccionar un jugador que no tenga ninguna orden publicada.
2. Enviar consulta:
   ```bash
   GET http://localhost:3000/players/<EMPTY_PLAYER_ID>/order-book
   Authorization: Bearer <TOKEN>
   ```
3. **Verificación esperada**:
   * Código HTTP `200 OK`.
   * Respuesta:
     ```json
     {
       "playerId": "<EMPTY_PLAYER_ID>",
       "bids": [],
       "asks": []
     }
     ```

---

## Escenario 3: Jugador inexistente (404 Not Found)

1. Enviar consulta con un UUID inexistente:
   ```bash
   GET http://localhost:3000/players/00000000-0000-0000-0000-000000000000/order-book
   Authorization: Bearer <TOKEN>
   ```
2. **Verificación esperada**:
   * Código HTTP `404 Not Found`.
   * Mensaje de error claro de jugador no encontrado.

---

## Escenario 4: Verificación visual en Frontend

1. Iniciar sesión en el frontend.
2. Navegar al catálogo de jugadores (`/catalog`) y seleccionar un jugador para ver su detalle (`/catalog/:id`).
3. Observar el panel **Profundidad de Mercado / Libro de Órdenes**:
   * Se visualiza la tabla o lista de **Compras (Bids)** en verde/morado y **Ventas (Asks)** en naranja/rojo.
   * Las barras de profundidad gráfica reflejan el volumen relativo de cada nivel de precio.
   * Si no hay órdenes, se muestra un mensaje informativo indicando que aún no hay posturas en el mercado para ese jugador.

