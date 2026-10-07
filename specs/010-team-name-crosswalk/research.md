# Phase 0 — Research: Team Name Crosswalk

## §1 ¿Existe alguna utilidad de normalización de texto en el proyecto?

**Decision**: No existe. Se crea una nueva función pura `normalizeTeamName`.

**Findings**:
- `http-whoscored-adapter.ts` tiene `normalizeRawPosition(label: string)` pero normaliza etiquetas de posición HTML (ej. `"FW (R)"` → `"FWR"`). No usa NFD ni elimina acentos. Es completamente distinta.
- `domain/auth/email.ts` usa `.toLowerCase()` puntualmente, sin extracción a utilidad compartida.
- No hay ningún módulo `utils/` ni `helpers/` con normalización de texto en `src/`.

**Rationale**: Implementar `normalizeTeamName` como función pura en `src/domain/competition/` siguiendo el patrón de `mapWhoScoredPosition` — sin dependencias externas, testeable en aislamiento. Implementación: `name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\b(fc|afc|cf|sc|sl|as|ss|fk)\b\.?/g, '').replace(/\s+/g, ' ').trim()`.

---

## §2 ¿`ts-node` o `tsx` están disponibles para el script standalone?

**Decision**: Usar `ts-node`. Ya está en devDependencies.

**Findings**:
- `package.json` devDependencies: `"ts-node": "^10.9.2"` ✅
- El proyecto ya lo usa implícitamente vía `typeorm-ts-node-commonjs` (wrapper de TypeORM sobre ts-node para correr migrations).
- No hay `tsx` en devDependencies.
- Script en `package.json`: `"seed:crosswalk": "ts-node scripts/seed-crosswalk.ts"`.

**Rationale**: `ts-node` está disponible sin instalar nada nuevo. El script vive en `backend/scripts/seed-crosswalk.ts` y se invoca desde `backend/`.

---

## §3 Patrón de dominio para funciones puras

**Decision**: Seguir el patrón de `mapWhoScoredPosition.ts`.

**Findings**:
- `src/domain/player/whoscored-position-mapping.ts`: función pura exportada, tabla de lookup como `ReadonlyMap`, sin imports de NestJS ni TypeORM.
- `src/domain/player/team-roster-sync.ts`: función pura `computePlayersToRemove`, sin I/O.
- Ambas tienen sus propios `.spec.ts` en la misma carpeta.

**Rationale**: `normalizeTeamName` y `resolveTeam` siguen este mismo patrón — archivos individuales en `src/domain/competition/`, cada uno con su `.spec.ts` co-located. El test de tsarch verifica que `domain/` no importe NestJS ni TypeORM.

---

## §4 Patrón de repositorio para la entidad `TeamNameException`

**Decision**: Seguir el patrón completo de `Standing`: clase de dominio + entity TypeORM + mapper + interfaz de repositorio + implementación TypeORM.

**Findings** (examinando `Standing`):
- Clase de dominio: `src/domain/competition/standing.ts` — constructor privado, `create()` y `restore()`, getters.
- Entidad TypeORM: `src/repositories/competition/entities/standing.entity.ts` — `@Entity`, columnas mapeadas.
- Mapper: `src/repositories/competition/mappers/standing.mapper.ts` — `toDomain(entity)` y `toEntity(domain)`.
- Interfaz de repositorio: `src/repositories/competition/standing.repository.ts` — solo métodos, sin TypeORM.
- Implementación: `src/repositories/competition/typeorm-standing.repository.ts` — usa mapper + TypeORM DataSource.
- Módulo: `src/modules/competition/football-data-sync.module.ts` — `TypeOrmModule.forFeature([StandingEntity])`, token DI en constants.

`TeamNameException` sigue exactamente este patrón. La única simplificación: `TeamNameException` es de solo lectura para el dominio (el script de crosswalk no escribe via repositorio), así que el repositorio solo necesita `findAll(): Promise<TeamNameException[]>`.

---

## §5 Migración para `team_name_exception`

**Decision**: Nueva migration con timestamp `1791158400000` en `src/database/migrations/`.

**Findings**:
- `playerCatalogDataSource` apunta a `src/database/migrations/*.{ts,js}`.
- `synchronize: true` en dev/test crea la tabla automáticamente al bootear — la migration es solo para producción (donde `synchronize: false`).
- Patrón existente: `IF NOT EXISTS` hace la migration idempotente (`AddRoleToUsersAndApiKeys`).
- Timestamp de la última migration: `1790985600000` (2026-09-07). Usar `1791158400000` (2026-10-07).

**Rationale**: La tabla arranca vacía — la migration solo crea la tabla (`CREATE TABLE IF NOT EXISTS`), sin datos. No hay `down()` complejo: `DROP TABLE IF EXISTS team_name_exception`.

---

## §6 Módulo NestJS para el crosswalk

**Decision**: Crear `TeamCrosswalkModule` separado, en `src/modules/competition/`.

**Findings**:
- `FootballDataSyncModule` ya exporta `STANDING_REPOSITORY` — `TeamCrosswalkModule` puede importarlo y reutilizar ese repositorio.
- La única responsabilidad del módulo: registrar `TeamNameExceptionEntity` con `TypeOrmModule.forFeature()` y proveer `TypeOrmTeamNameExceptionRepository` bajo el token `TEAM_NAME_EXCEPTION_REPOSITORY`.
- No hay service ni controller: las funciones puras `normalizeTeamName` y `resolveTeam` no necesitan ser proveedores NestJS — son importadas directamente donde se usen (igual que `mapWhoScoredPosition`).

---

## §7 Script `seed-crosswalk.ts` — acceso a la DB

**Decision**: El script crea su propio `DataSource` TypeORM standalone (patrón de `playerCatalogDataSource`), sin levantar la app NestJS.

**Findings**:
- Los scripts de migrations usan `playerCatalogDataSource` (DataSource standalone con `DATABASE_URL` del env).
- El script de crosswalk necesita: (a) leer `Player.team` distintos, (b) leer `Standing[]` por liga, (c) llamar a la API de Football-Data directamente con `axios` (ya en dependencies).
- El script NO usa el repositorio NestJS — crea su propio DataSource, usa `getRepository()` de TypeORM directamente.

**Rationale**: Evita levantar el bootstrap de NestJS (que requiere módulos, DI, etc.) para un script de operación. Patrón ya establecido en el proyecto para scripts de DB.
