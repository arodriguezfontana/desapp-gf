# Implementation Plan: Team Name Crosswalk (WhoScored ↔ Football-Data)

**Branch**: `010-team-name-crosswalk` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-team-name-crosswalk/spec.md`

## Summary

Infraestructura de mapeo que permite, dado un nombre de equipo de WhoScored, encontrar el `Standing` correspondiente en Football-Data. Se compone de dos funciones puras de dominio (`normalizeTeamName`, `resolveTeam`), una entidad persistida de excepciones manuales (`TeamNameException`) y un script standalone de verificación de cobertura (`npm run seed:crosswalk`). No expone ningún endpoint HTTP.

## Technical Context

**Language/Version**: TypeScript 5.7 / Node.js 20

**Primary Dependencies**: NestJS 11, TypeORM (ya configurados). `ts-node ^10.9.2` disponible en devDependencies para el script standalone.

**Storage**: PostgreSQL. Nueva tabla `team_name_exception`. `synchronize: true` en dev/test la crea sola al bootear; migration explícita para producción.

**Testing**: Jest (unit sin NestJS/DB; integration con Testcontainers + PostgreSQL efímero). Suite existente no se toca.

**Target Platform**: Servidor Node.js (backend NestJS). Script standalone ejecutable localmente.

**Project Type**: Web service (backend) + script de operación interna.

**Performance Goals**: No aplica — función pura sobre listas de ~20 equipos por liga. Sin requisitos de latencia.

**Constraints**: Dominio sin imports de NestJS ni TypeORM (Principio I + test de arquitectura tsarch). Sin nuevas dependencias npm.

**Scale/Scope**: ~98 equipos fijos en 5 ligas. Tabla de excepciones esperada: < 15 filas.

## Constitution Check

*GATE: Verificado contra constitución v1.8.0 antes de Fase 0.*

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Capas (sentido único) | ✅ | `normalizeTeamName`/`resolveTeam` viven en `domain/` sin imports de NestJS ni TypeORM. El test de tsarch lo verifica automáticamente. |
| II. Dominio rico | ✅ | La lógica de normalización y resolución vive en el dominio, no en el Service ni el Repository. |
| III. Validación por nivel | ✅ | No hay inputs externos nuevos que validar en esta feature. |
| VI. Integridad transaccional | ✅ | La tabla `team_name_exception` es de solo escritura manual (INSERT); no hay operaciones multi-tabla. |
| IX. Testing | ✅ | Tests unitarios de `normalizeTeamName` y `resolveTeam` sin NestJS/DB. Test de integración para `TypeOrmTeamNameExceptionRepository` con Testcontainers. |
| X. DoD | ✅ | Sin endpoint nuevo → no requiere actualizar Swagger ni Postman. Requiere tests + build verde. |
| XI. Idioma | ✅ | Identificadores en inglés; mensajes/docs en español. |

No hay violaciones. Complejidad Tracking vacío.

## Project Structure

### Documentation (this feature)

```text
specs/010-team-name-crosswalk/
├── plan.md              ← este archivo
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── resolve-team.md
└── tasks.md             ← generado por /speckit-tasks (no por este comando)
```

### Source Code

```text
backend/
├── src/
│   ├── domain/competition/
│   │   ├── normalize-team-name.ts          ← función pura (nueva)
│   │   ├── normalize-team-name.spec.ts     ← unit tests (nuevo)
│   │   ├── resolve-team.ts                 ← función pura (nueva)
│   │   ├── resolve-team.spec.ts            ← unit tests (nuevo)
│   │   └── team-name-exception.ts          ← clase de dominio (nueva)
│   ├── repositories/competition/
│   │   ├── entities/
│   │   │   └── team-name-exception.entity.ts   ← entidad TypeORM (nueva)
│   │   ├── mappers/
│   │   │   └── team-name-exception.mapper.ts   ← mapper (nuevo)
│   │   ├── team-name-exception.repository.ts   ← interfaz (nueva)
│   │   └── typeorm-team-name-exception.repository.ts  ← impl (nueva)
│   ├── modules/competition/
│   │   ├── team-crosswalk.constants.ts     ← token DI (nuevo)
│   │   └── team-crosswalk.module.ts        ← módulo NestJS (nuevo)
│   └── database/migrations/
│       └── 1791158400000-CreateTeamNameExceptionTable.ts  ← migración (nueva)
└── scripts/
    └── seed-crosswalk.ts                   ← script standalone ts-node (nuevo)

package.json                                ← agrega "seed:crosswalk" en scripts
```

**Structure Decision**: Sigue el patrón existente de `007-football-data-integration` (Standing): dominio en `src/domain/competition/`, persistencia en `src/repositories/competition/`, módulo en `src/modules/competition/`. Sin frontend ni controller nuevos.
