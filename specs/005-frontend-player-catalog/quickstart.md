# Quickstart — Validaciones del Catálogo de Jugadores

**Feature**: `005-frontend-player-catalog` | **Date**: 2026-09-20
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## 1. Requisitos Previos

- Node.js v20+ y `pnpm` instalados.
- Backend NestJS listo para levantar o Docker corriendo para Testcontainers.

---

## 2. Comandos de Verificación

```bash
# Entrar al directorio de frontend
cd frontend

# Ejecutar tests unitarios de catálogo (RTL + Vitest)
pnpm test:unit

# Ejecutar tests de integración contra backend real en Testcontainers
pnpm test:integration

# Verificar linter de ESLint (sin violaciones de importación de fetch/axios en componentes)
pnpm lint

# Compilar proyecto para producción
pnpm build
```

---

## 3. Escenarios Manuales de Validación

1. **Sin ApiKey guardada**:
   - Abrir `http://localhost:5173/catalog` sin haber generado una ApiKey.
   - **Resultado esperado**: Aparece el aviso `"Necesitás generar una ApiKey para ver el catálogo."` con link a `/account`.

2. **Generación de ApiKey y consulta del catálogo**:
   - Registrarse/Iniciar sesión → ir a `/account` → hacer clic en **Generar ApiKey** → copiar la clave.
   - Navegar a `/catalog`.
   - **Resultado esperado**: Se visualiza la lista de jugadores paginada de a 10 elementos.

3. **Filtros combinados**:
   - Seleccionar Liga "Premier League" y Posición "FW".
   - **Resultado esperado**: La lista se filtra mostrando solo delanteros de la Premier League y resetea a la página 1.

4. **Filtro sin resultados**:
   - Escribir un equipo inexistente en el filtro de texto (ej. "EquipoInexistenteXYZ").
   - **Resultado esperado**: Se muestra el mensaje `"No se encontraron jugadores con estos filtros."` (sin mensaje de error).

5. **Detalle e inexistencia (404)**:
   - Hacer clic en un jugador del listado → se abre `/catalog/:id`.
   - Navegar manualmente a `/catalog/id-inexistente-123`.
   - **Resultado esperado**: Muestra el mensaje de error 404 del backend tal cual sin redirigir.

