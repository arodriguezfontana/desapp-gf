# Data Model: Perfiles de ejecución de tests (022)

Esta feature no introduce entidades de dominio ni cambios de esquema de base de datos.

## Entidades de configuración (no de dominio)

### Perfil de tests

Un perfil es una agrupación lógica de archivos de test que comparten el mismo costo de ejecución y el mismo trigger de CI.

| Perfil | Script | Trigger CI | Requiere infraestructura |
|--------|--------|-----------|--------------------------|
| `unit` | `pnpm test:unit` | Todo push + todo PR | No |
| `integration` | `pnpm test:integration` | Solo PR a `main` | Sí (Testcontainers + Postgres) |
| `e2e` | `pnpm test:e2e` | Solo PR a `main` | Sí (Testcontainers + Postgres) |

### Relación perfil → archivos

```
unit        →  backend/src/**/*.spec.ts
                 (excluye *.integration.spec.ts)
integration →  backend/src/**/*.integration.spec.ts
e2e         →  backend/test/**/*.e2e-spec.ts
```

### Artefactos de configuración afectados

| Archivo | Rol | Estado |
|---------|-----|--------|
| `backend/package.json` | Define scripts `test:unit`, `test:integration`, `test:e2e` y la config de proyectos Jest | **Ya correcto, sin cambios** |
| `backend/test/jest-e2e.json` | Config Jest para el perfil e2e | **Ya correcto, sin cambios** |
| `.github/workflows/ci.yml` | Define los jobs y cuándo corre cada perfil | **Requiere cambio: separar job backend en dos** |
