# Quickstart: Validación de la feature Team Name Crosswalk

## Prerequisitos

- Backend levantado localmente con Docker Compose (`docker compose up -d`)
- `FOOTBALL_DATA_API_TOKEN` en `backend/.env`
- `DATABASE_URL` en `backend/.env`
- Feature 007 (football-data sync) ejecutada al menos una vez — tabla `standings` con datos reales

## 1. Tests unitarios (sin DB)

```bash
cd backend
npm run test:unit -- --testPathPattern="normalize-team-name|resolve-team"
```

**Esperado**: 2 suites en verde. Validan:
- `normalizeTeamName`: eliminación de prefijos, acentos, diéresis, espacios extra
- `resolveTeam`: paso de normalización, paso de excepción, retorno `null` cuando no hay match

## 2. Test de integración del repositorio (con Testcontainers)

```bash
cd backend
npm run test:integration -- --testPathPattern="typeorm-team-name-exception"
```

**Esperado**: suite en verde. Valida `findAll()` contra PostgreSQL efímero — tabla vacía devuelve `[]`, tabla con filas devuelve `TeamNameException[]` correctamente mapeados.

## 3. Test de arquitectura (tsarch)

```bash
cd backend
npm run test -- --testPathPattern="architecture"
```

**Esperado**: sigue en verde. Las nuevas funciones en `domain/competition/` no importan NestJS ni TypeORM — el test de tsarch lo verifica automáticamente.

## 4. Script de cobertura

```bash
cd backend
npm run seed:crosswalk
```

**Esperado**:
- Salida en consola: total de equipos distintos en `players`, cuántos resuelven por normalización, cuántos no
- Si hay equipos sin resolver: se crea `backend/team_crosswalk_unresolved.txt` con sus nombres
- El script termina sin error (exit 0) si la conexión a DB y la API de Football-Data son exitosas

**Interpretación del resultado**:
- Si el 90%+ resuelven por normalización → SC-001 cumplido
- Los nombres en `team_crosswalk_unresolved.txt` son candidatos a agregar como excepciones manuales en la tabla `team_name_exception`

## 5. Agregar una excepción manual (validación de SC-004)

```sql
-- Ejemplo: "Lyon" en WhoScored → "Olympique Lyonnais" en Football-Data (teamId hipotético)
INSERT INTO team_name_exception (whoscored_raw_name, football_data_team_id, football_data_team_name, league_code)
VALUES ('Lyon', 1234, 'Olympique Lyonnais', 'FL1');
```

Volver a correr `npm run seed:crosswalk` → "Lyon" ya no aparece en `team_crosswalk_unresolved.txt`.

## 6. Build completo

```bash
cd backend
npm run build
```

**Esperado**: `nest build` sin errores de TypeScript.
