# Contrato: funciones puras de crosswalk

Esta feature no expone endpoints HTTP. Sus contratos son las signaturas de las dos
funciones puras de dominio que la componen, consumidas internamente por la feature
de cotización.

---

## `normalizeTeamName(name: string): string`

**Archivo**: `src/domain/competition/normalize-team-name.ts`

**Contrato**:
- Input: string — nombre de equipo tal como lo provee cualquiera de las dos fuentes.
- Output: string normalizado (minúsculas, sin acentos/diéresis, sin prefijos/sufijos estándar, sin espacios extra).
- Si `name` es empty string → devuelve `""`.
- Pura: mismo input siempre produce mismo output. Sin side effects.

**Prefijos/sufijos eliminados**: `FC`, `AFC`, `CF`, `SC`, `SL`, `AS`, `SS`, `FK` (case-insensitive, como palabras completas).

---

## `resolveTeam(whoScoredTeamName, standings, exceptions): Standing | null`

**Archivo**: `src/domain/competition/resolve-team.ts`

**Contrato**:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `whoScoredTeamName` | `string` | Nombre del equipo exactamente como lo devuelve WhoScored (`Player.team`) |
| `standings` | `Standing[]` | Standings del repositorio existente (feature 007). Campo relevante: `teamName`. |
| `exceptions` | `TeamNameException[]` | Excepciones manuales del repositorio `team_name_exception`. |

**Output**: `Standing | null`

**Algoritmo**:
1. Si `whoScoredTeamName` es vacío → `null`.
2. Normalizar: `needle = normalizeTeamName(whoScoredTeamName)`.
3. Para cada `s` en `standings`: si `normalizeTeamName(s.teamName) === needle` → devolver `s`.
4. Para cada `e` en `exceptions`: si `e.whoScoredRawName === whoScoredTeamName` (exacto) → buscar en `standings` el standing cuyo `externalTeamId === e.footballDataTeamId` → devolver ese standing.
5. Si ningún paso resuelve → `null`.

**Garantías**:
- Pura: no modifica sus argumentos. Sin I/O.
- El paso 3 (normalización) tiene prioridad sobre el paso 4 (excepción).
- Si `standings` no contiene ningún standing con `externalTeamId === exception.footballDataTeamId` en el paso 4 → `null` (la excepción apunta a un equipo que no está en los standings cargados).

---

## `TeamNameExceptionRepository`

**Archivo**: `src/repositories/competition/team-name-exception.repository.ts`

Token DI: `TEAM_NAME_EXCEPTION_REPOSITORY`

```ts
export interface TeamNameExceptionRepository {
  findAll(): Promise<TeamNameException[]>;
}
```

Carga todas las excepciones de una vez (tabla < 15 filas). Sin filtros ni paginación.
