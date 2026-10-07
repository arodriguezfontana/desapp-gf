# Research: Extensión de Métricas de Jugador (WhoScored)

## Decisiones de Arquitectura y Diseño

### 1. Extracción y mapeo de campos desde WhoScored

- **Contexto**: El scraper de WhoScored ya obtiene la página de estadísticas de partido/temporada (`player-matchstatistics.html`) y extrae el array JSON embebido `tournaments`.
- **Hallazgo / Verificación**:
  - En el objeto de estadísticas de torneo (`WhoScoredTournamentSeasonStats`), los campos existen con las claves exactas:
    - `Goals` (número entero acumulado)
    - `Assists` (número entero acumulado)
    - `KeyPasses` (número entero acumulado)
    - `Dribbles` (número entero acumulado)
    - `TotalTackles` (número entero acumulado)
    - `Yellow` (número entero acumulado)
    - `Red` (número entero acumulado)
- **Decisión**: Mapear directamente estos 7 campos desde el objeto de torneo al puerto del adapter `WhoScoredRawMetrics` y a `PlayerSyncInput`.
- **Nomenclatura**:
  - `Goals` → `goals`
  - `Assists` → `assists`
  - `KeyPasses` → `keyPasses`
  - `Dribbles` → `dribbles`
  - `TotalTackles` → `totalTackles`
  - `Yellow` → `yellowCards` (decisión de diseño por claridad semántica)
  - `Red` → `redCards` (decisión de diseño por claridad semántica)
- **Tratamiento de `null` vs `0`**:
  - Si el jugador no tiene estadísticas (0 apariciones o sin fila para el torneo), las métricas se devuelven como `null`.
  - Si el jugador tiene estadísticas registradas con valor 0 (ej. 0 goles), se almacena `0`.
  - El sistema de cotización (feature 012) tratará `null` como `0` para sus cálculos, pero el modelo de datos preserva la fidelidad de `null`.

### 2. Esquema de Persistencia y Migración

- **Decisión**:
  - Agregar 7 columnas de tipo `integer` (`nullable: true`) a la tabla `players`:
    - `goals` integer NULL
    - `assists` integer NULL
    - `key_passes` (o camelCase `keyPasses` según convención TypeORM del proyecto) integer NULL
    - `dribbles` integer NULL
    - `total_tackles` (o `totalTackles`) integer NULL
    - `yellow_cards` (o `yellowCards`) integer NULL
    - `red_cards` (o `redCards`) integer NULL
  - Generar una migración TypeORM explícita (`1791331200000-AddExtendedMetricsToPlayers.ts`) con cláusulas `ADD COLUMN IF NOT EXISTS` y `DROP COLUMN IF EXISTS` para soportar producción.
  - En dev y CI, TypeORM `synchronize: true` y Testcontainers aplican el esquema automáticamente.
- **Repositorio TypeORM**:
  - Actualizar `UPSERT_OVERWRITE_COLUMNS` en `TypeOrmPlayerRepository` para incluir las 7 nuevas columnas de modo que las corridas periódicas actualicen los valores cuando cambien en WhoScored.

### 3. Capa de API y Contrato DTO

- **Decisión**:
  - Extender `PlayerResponseDto` para incluir los 7 campos tipados como `number | null`.
  - Configurar `@ApiProperty` con descripción, tipo entero y ejemplos adecuados.
  - No omitir los campos si son `null` (deben serializarse explícitamente en el JSON como `null`).
  - Mantener los endpoints existentes `GET /players` y `GET /players/:id` sin cambios en sus filtros ni lógica de autorización.

### 4. Capa de Presentación (Frontend)

- **Decisión**:
  - Actualizar el tipo `Player` en `frontend/src/types/catalog.types.ts`.
  - En `PlayerCard.tsx`: Incorporar una sección visual compacta que resalte al menos Goles (`goals`), Asistencias (`assists`) y Tarjetas Amarillas (`yellowCards`), utilizando badges y colores acordes al diseño institucional.
  - En `PlayerDetailPage.tsx`: Ampliar la cuadrícula de métricas de rendimiento para mostrar las 11 estadísticas completas (Rating, Pases completados, Remates, Intercepciones, Goles, Asistencias, Pases clave, Regates, Entradas totales, Tarjetas amarillas, Tarjetas rojas).
  - Manejo de `null`: Mostrar un indicador neutro (`—`) cuando una métrica no tenga dato disponible.

