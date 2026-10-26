# Quickstart: Perfiles de ejecución de tests (022)

## Prerequisitos

- Docker corriendo localmente (para Testcontainers en integración/e2e)
- `pnpm install` ejecutado en `backend/`
- Variables de entorno: `DATABASE_URL` y `JWT_SECRET` (ver `.env.example`)

## Validación local de cada perfil

### Perfil unitario (sin infraestructura)

```bash
cd backend
pnpm test:unit
```

Esperado: todos los archivos `*.spec.ts` (excluyendo `*.integration.spec.ts`) pasan en verde. No se levanta ningún contenedor.

### Perfil de integración

```bash
cd backend
pnpm test:integration
```

Esperado: Testcontainers levanta un Postgres efímero, corre todos los `*.integration.spec.ts`, destruye el contenedor. Sin efectos sobre la base de desarrollo.

> **Advertencia**: si Docker no está corriendo, `backend/test/setup/global-setup.ts` cae a un fallback y usa la `DATABASE_URL` local, es decir, la base de desarrollo. Arrancar Docker antes de correr este perfil y el e2e.

### Perfil e2e

```bash
cd backend
pnpm test:e2e
```

Esperado: Testcontainers levanta un Postgres efímero, corre todos los `*.e2e-spec.ts` con la app NestJS en memoria via supertest, destruye el contenedor.

---

## Validación del comportamiento de CI

### Escenario 1: Push a rama feature (solo unitarios)

1. Hacer push a cualquier rama que no sea main (ej. `feat/algo`)
2. Ir a GitHub Actions → ver el run disparado por el push
3. Verificar que el job `backend-unit` corre y completa
4. Verificar que los jobs `backend-heavy`, `frontend-heavy` y `sonarqube` aparecen como skipped: solo corren `backend-unit` y `frontend`
5. El tiempo total del pipeline debe ser notablemente menor que antes del cambio

### Escenario 2: PR contra main (suite completa)

1. Abrir un PR desde cualquier rama hacia `main`
2. Ir a GitHub Actions → ver el run disparado por el PR
3. Verificar que corren `backend-unit`, `frontend`, `backend-heavy`, `frontend-heavy` y `sonarqube`
4. El botón de merge queda bloqueado hasta que todos los jobs pasen en verde
5. Si `backend-heavy` falla (ej. un test de integración roto), el PR no puede mergearse

### Escenario 3: Push a main

1. Mergear un PR (o hacer push) a `main`
2. Verificar que corren todos los jobs, incluidos `backend-heavy`, `frontend-heavy` y `sonarqube`

### Escenario 4: PR contra dev

1. Abrir un PR contra `dev`
2. Verificar que solo corren `backend-unit` y `frontend`; los jobs pesados y `sonarqube` quedan skipped

### Escenario 5: Ningún archivo de test modificado

```bash
git diff HEAD~1 HEAD -- '**/*.spec.ts' '**/*.integration.spec.ts' '**/*.e2e-spec.ts'
```

Esperado: output vacío — la feature no modifica el contenido de ningún test.

---

## Estructura del workflow resultante

```
ci.yml
├── job: backend-unit       (push a cualquier rama + PR a cualquier rama)
│   ├── lint
│   ├── pnpm test:unit
│   └── build
│
├── job: backend-heavy      (pull_request con base main, o push a main)
│   ├── pnpm test:integration
│   └── pnpm test:e2e
│
├── job: frontend-heavy     (misma condición que backend-heavy)
│   ├── pnpm build (backend)
│   └── pnpm test:integration (frontend)
│
├── job: frontend           (push + PR a cualquier rama: lint, test:unit, build)
│
└── job: sonarqube          (misma condición que backend-heavy; suite completa con coverage)
```
