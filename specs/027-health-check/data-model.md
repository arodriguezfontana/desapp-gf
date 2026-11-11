# Data Model: Health check del backend

Esta feature **no persiste datos**: no hay tablas, migraciones ni cambios de esquema (sólo ejecuta `SELECT 1`).
Las entidades de la spec son valores de respuesta en memoria.

## Resultado de salud (`HealthReport`)

Informe devuelto por `HealthService.check()` y serializado tal cual por el controller.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `status` | `'ok' \| 'error'` (`'shutting_down'` sólo si algún día se habilitan shutdown hooks) | Estado general. `ok` ⇔ todos los componentes `up` |
| `info` | mapa `{ [componente]: Estado }` | Componentes en `up` (vacío si ninguno) |
| `error` | mapa `{ [componente]: Estado }` | Componentes en `down` (vacío si ninguno) |
| `details` | mapa `{ [componente]: Estado }` | Todos los componentes verificados, con su estado individual |

## Estado de componente (`ComponentStatus`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `status` | `'up' \| 'down'` | Estado individual del componente |
| `message` | `string` (opcional) | Sólo en `down` por timeout (`"timeout of 3000ms exceeded"`) o proveedor de conexión ausente. Nunca contiene datos del error original |

## Componentes verificados

| Clave | Qué verifica | Notas |
|-------|--------------|-------|
| `database` | La conexión a PostgreSQL responde a `SELECT 1` dentro de 3000 ms | **Único** componente (decisión de diseño de la spec). Football-Data y WhoScored **no** figuran |

## Reglas de validación / invariantes

- `status === 'ok'` ⇒ HTTP 200 y `error` vacío. `status !== 'ok'` ⇒ HTTP 503 y al menos un componente en `down`.
- El informe no contiene configuración, cadenas de conexión, credenciales, versiones ni mensajes de error crudos (FR-008).
- Sin estado entre consultas: cada llamada ejecuta un ping nuevo (FR-010); no hay caché.

## Transiciones de estado

No hay máquina de estados propia. El resultado refleja el instante de la consulta: `database: up ⇄ down` según la base responda.
