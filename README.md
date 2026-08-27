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

## Instalación

Cada carpeta es un proyecto npm independiente. La **primera vez** hay que instalar las dependencias en ambas:

```bash
cd backend
npm install

cd ../frontend
npm install
```

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
