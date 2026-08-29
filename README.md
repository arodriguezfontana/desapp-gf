## Stack

### Frontend
- React 19
- Vite 8 (dev server y build)
- TypeScript
- Tailwind CSS 4
- ESLint

### Backend
- Node.js
- NestJS 11 (sobre Express)
- TypeScript 5.7
- CORS habilitado

## Requisitos previos

- Node.js >= 20
- npm

Verificá tus versiones con:

```bash
node -v
npm -v
```

## Instalación (al clonar el repo)

Lo único que necesitás para **correr el proyecto** es Node.js y npm. Cada carpeta es un
proyecto npm independiente, así que la **primera vez** hay que instalar las dependencias
en ambas:

```bash
cd backend
npm install

cd ../frontend
npm install
```

> No hay nada más que instalar para levantar la app. Para trabajar con Spec-Driven
> Development ver la sección [Spec-Driven Development (spec-kit)](#spec-driven-development-spec-kit).

## Levantar el proyecto

### Backend

```bash
cd backend
npm run dev
```

Queda corriendo en http://localhost:3000 (modo watch, recarga automática).

Endpoints disponibles:
- `GET /` → mensaje de la API
- `GET /health` → estado del servicio

### Frontend

```bash
cd frontend
npm run dev
```

Queda corriendo en http://localhost:5173


## Scripts disponibles

### Backend
| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Levanta el servidor en modo watch |
| `npm run build` | Compila a `dist/` |
| `npm run start` | Levanta el servidor (sin watch) |
| `npm run start:prod` | Ejecuta la build de producción (`dist/main`) |

### Frontend
| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Levanta el dev server de Vite |
| `npm run build` | Genera la build de producción |
| `npm run preview` | Previsualiza la build |
| `npm run lint` | Corre ESLint |

## Spec-Driven Development (spec-kit)

Este repo usa [spec-kit](https://github.com/github/spec-kit) para trabajar con
Spec-Driven Development (SDD).

Qué se versiona y qué no:

- **`.specify/` → SÍ se versiona.** Acá vive el trabajo colaborativo: la constitución
  del proyecto y las especificaciones de cada feature (además de templates y scripts).
- **`.claude/` → NO se versiona** (está en `.gitignore`). Son solo los comandos
  `/speckit-*` para el agente Claude Code, y cada quien los regenera en su máquina.

### Setup al clonar (una sola vez)

Los comandos del agente (`.claude/`, `.github/`, `.cursor/`, etc.) no vienen en el
repo, así que después de clonar tenés que instalarlos para tu agente:

1. Instalá [`uv`](https://docs.astral.sh/uv/):
   - Windows (PowerShell): `irm https://astral.sh/uv/install.ps1 | iex`
   - Mac/Linux: `curl -LsSf https://astral.sh/uv/install.sh | sh`
2. Instalá el CLI de spec-kit:
   ```bash
   uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
   ```
3. Instalá la integración de tu agente (ver claves con `specify integration list`):
   ```bash
   specify integration install claude --script ps    # o copilot, cursor, gemini, codex, etc.
   ```
4. Verificá con `specify check`.

Esto regenera solo los comandos del agente; **no toca `.specify/`**, así que la
constitución y las specs que ya están en el repo se mantienen intactas.

> Los scripts de spec-kit son **PowerShell** (`.ps1`). En Windows funcionan de una;
> en Mac/Linux necesitás tener PowerShell instalado (`pwsh`).

### Flujo de trabajo

1. `/speckit-constitution` — Establecer principios/arquitectura del proyecto.
2. `/speckit-specify` — Crear la especificación de una feature.
3. `/speckit-plan` — Plan de implementación.
4. `/speckit-tasks` — Generar tareas accionables.
5. `/speckit-implement` — Ejecutar la implementación.
