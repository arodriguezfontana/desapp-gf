# Research: Consulta de Cotización de Jugador (GET /players/:id/quote)

## Decision 1: Query y contrato de `PlayerQuoteRepository.findLatestAtDate`

- **Decision**: Agregar `findLatestAtDate(playerId: string, date: Date): Promise<PlayerQuote | null>` tanto en la interfaz de dominio `PlayerQuoteRepository` como en `TypeOrmPlayerQuoteRepository`.
- **Implementación**:
  ```typescript
  async findLatestAtDate(playerId: string, date: Date): Promise<PlayerQuote | null> {
    const entity = await this.repo
      .createQueryBuilder('quote')
      .where('quote.player_id = :playerId', { playerId })
      .andWhere('quote.calculated_at <= :date', { date })
      .orderBy('quote.calculated_at', 'DESC')
      .limit(1)
      .getOne();
    return entity ? this.mapper.toDomain(entity) : null;
  }
  ```
- **Rationale**: Cumple exactamente la instrucción de query `WHERE player_id = :playerId AND calculated_at <= :date ORDER BY calculated_at DESC LIMIT 1`. La interfaz de dominio declara el tipo de retorno nullable `Promise<PlayerQuote | null>`.
- **Alternativas consideradas**:
  - `find({ where: { playerId, calculatedAt: LessThanOrEqual(date) }, order: { calculatedAt: 'DESC' }, take: 1 })`: Funcionalmente equivalente, pero `createQueryBuilder` mapea de forma directa la consulta SQL solicitada.

---

## Decision 2: Parseo y validación de fecha `at` con `ParseDatePipe`

- **Decision**: Implementar un pipe de transformación y validación `ParseDatePipe` que intercepte el query param `@Query('at') at?: string`.
- **Comportamiento**:
  - Si `at === undefined` o cadena vacía: retorna `undefined`.
  - Si `at` no parsea como fecha válida (o fecha inexistente como `2026-02-31`): lanza `BadRequestException` (`HTTP 400: El parámetro "at" debe ser una fecha válida en formato ISO 8601`).
  - Si `at` es válido (ej. `YYYY-MM-DD` o timestamp ISO): calcula el instante correspondiente al final del día solicitado en UTC (`23:59:59.999Z`).
- **Rationale**: Centraliza la validación en la capa HTTP/Controller mediante la convención de NestJS (Pipes), respetando el Principio III de la Constitución (cada validación en su nivel: formato y tipo en DTO/Pipe).
- **Alternativas consideradas**:
  - Validar en el servicio: Rechazado porque la validación de formato HTTP y status 400 corresponde a la capa de Controller/Pipes.

---

## Decision 3: Flujo del método de servicio `getQuoteAtDate`

- **Decision**: Agregar en `QuotationService` el método:
  ```typescript
  async getQuoteAtDate(playerId: string, date?: Date): Promise<PlayerQuoteWithStrategy | null>
  ```
  donde `PlayerQuoteWithStrategy` contiene la entidad `PlayerQuote` y el `strategyName: string`.
- **Flujo de ejecución**:
  1. Verificar si el jugador existe en el catálogo mediante `playerRepository.findById(playerId)`.
  2. Si no existe: lanzar `PlayerNotFoundError` (código/mensaje `PLAYER_NOT_FOUND`, mapeado a 404 por `AllExceptionsFilter`).
  3. Si existe:
     - Si `date` está definida: consultar `quoteRepository.findLatestAtDate(playerId, date)`.
     - Si `date` no está definida: consultar `quoteRepository.findLatestByPlayerId(playerId)`.
  4. Si no se encuentra cotización: retornar `null` (sin lanzar excepción, indicando ausencia válida).
  5. Si se encuentra cotización: buscar la estrategia asociada mediante `strategyRepository.findById(quote.strategyId)` para resolver su nombre (`strategyName`) y retornar el resultado.
- **Rationale**: Reutiliza la infraestructura de jugadores existente y separa claramente el caso de "jugador no existe" (404) del caso "no hay cotización en esa fecha" (null -> 204).

---

## Decision 4: Manejo de respuestas HTTP 200 y 204 en el controlador

- **Decision**: En el método del controlador `GET /players/:id/quote`:
  ```typescript
  @Get(':id/quote')
  @ApiResponse({ status: 200, type: PlayerQuoteResponseDto })
  @ApiResponse({ status: 204, description: 'No hay cotización vigente para esa fecha' })
  @ApiResponse({ status: 400, description: 'Fecha inválida' })
  @ApiResponse({ status: 404, description: 'Jugador no encontrado' })
  async getQuote(
    @Param('id') id: string,
    @Query('at', ParseDatePipe) at: Date | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PlayerQuoteResponseDto | void> {
    const result = await this.quotationService.getQuoteAtDate(id, at);
    if (!result) {
      res.status(HttpStatus.NO_CONTENT);
      return;
    }
    return PlayerQuoteResponseDto.fromQuoteWithStrategy(result.quote, result.strategyName);
  }
  ```
- **Rationale**: Usar `@Res({ passthrough: true })` permite establecer el status code `204 No Content` sin romper la serialización automática de NestJS cuando el status es `200 OK`.
- **Alternativas consideradas**:
  - Lanzar una excepción de tipo `HttpException('', HttpStatus.NO_CONTENT)`: NestJS serializaría una respuesta JSON de error en lugar de un cuerpo 204 vacío.
  - Inyectar `@Res()` sin passthrough: Requeriría llamar manualmente a `res.json()` para el caso 200, perdiendo beneficios de serialización e interceptores.

---

## Decision 5: Estructura del DTO de respuesta `PlayerQuoteResponseDto`

- **Decision**: Extender o especializar el DTO de respuesta para incluir los 6 campos requeridos por la especificación:
  - `playerId`: string (UUID)
  - `valor`: number (DECIMAL 10,2)
  - `score`: number (DECIMAL 8,6)
  - `strategyName`: string
  - `weights`: Record<string, number> (snapshot de pesos al momento del cálculo)
  - `calculatedAt`: string (timestamp ISO 8601)
- **Rationale**: Cumple fielmente la especificación y los principios de documentación OpenAPI (Swagger).

