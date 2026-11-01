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

## 4. Sincronización del crosswalk

El crosswalk corre solo los domingos a las 06:00 (`TeamCrosswalkSyncService`), después de las sincronizaciones de WhoScored y de Football-Data. Para probar la lógica sin esperar al cron:

```bash
cd backend
npm run test -- --testPathPattern="team-crosswalk-sync"
```

**Esperado**: suite en verde (resolución por normalización, por excepción, equipos sin resolver y manejo de errores del cron).

**En la app corriendo**: revisar el log de la corrida semanal:
- `Crosswalk de equipos: N resueltos, M sin resolver.`
- Si hay sin resolver, un `warn` con sus nombres: son candidatos a agregar como excepciones manuales en la tabla `team_name_exception`.

**Interpretación del resultado**: si el 90%+ resuelven por normalización → SC-001 cumplido.

## 5. Agregar una excepción manual (validación de SC-004)

```sql
-- Ejemplo: "Lyon" en WhoScored → "Olympique Lyonnais" en Football-Data (teamId hipotético)
INSERT INTO team_name_exception (whoscored_raw_name, football_data_team_id, football_data_team_name, league_code)
VALUES ('Lyon', 1234, 'Olympique Lyonnais', 'FL1');
```

En la siguiente corrida del servicio, "Lyon" ya no aparece en el `warn` de sin resolver y tiene su fila en `teams`.
## 6. Build completo

```bash
cd backend
npm run build
```

**Esperado**: `nest build` sin errores de TypeScript.
