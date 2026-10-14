# Quickstart & Validation Guide: Frontend — Portfolio personal

Esta guía describe los pasos necesarios para validar de extremo a extremo la funcionalidad de **Portfolio personal** en el frontend, tanto mediante la suite automatizada de tests como de forma manual en el entorno local.

---

## 1. Prerrequisitos

- Node.js 20+ y pnpm instalados.
- Docker Desktop en ejecución (requerido para los tests de integración con Testcontainers).
- Variables de entorno del frontend configuradas en `frontend/.env` (o valores por defecto de testing).

---

## 2. Ejecución de Tests Automatizados

### A. Tests Unitarios y de Componentes (Frontend)

Ejecuta las pruebas en aislamiento de la capa de servicios, hooks y componentes de UI:

```bash
# Desde la carpeta frontend/ o la raíz del monorepo
pnpm --filter frontend test:unit
```

**Resultados esperados**:
- `src/service/portfolioService.spec.ts`: Pasa en verde (valida peticiones HTTP con Bearer token y manejo de respuestas).
- `src/hooks/usePortfolio.spec.ts`: Pasa en verde (valida transiciones de estado `loading`, `error`, datos y reintento).
- `src/components/PortfolioSummary.spec.tsx`: Pasa en verde (valida métricas consolidadas y estilos de ganancia/pérdida).
- `src/components/HoldingList.spec.tsx`: Pasa en verde (valida renderizado de grilla, columnas y valores individuales).

### B. Tests de Integración contra Backend Real (Testcontainers)

Valida la integración completa del cliente de frontend contra una instancia real de NestJS y base de datos PostgreSQL efímera:

```bash
pnpm --filter frontend test:integration
```

**Escenarios validados en `frontend/test/portfolio.spec.ts`**:
1. Usuario no autenticado intentando acceder al portfolio devuelve `401 Unauthorized`.
2. Usuario autenticado sin compras de tokens recibe `200 OK` con lista vacía de holdings.
3. Usuario autenticado con compras de tokens recibe `200 OK` con las posiciones correctas y valores consistentes con la base de datos real.

---

## 3. Validación Manual en Navegador

1. **Iniciar el stack local**:
   ```bash
   # En una terminal: levantar backend y PostgreSQL
   pnpm --filter backend start:dev

   # En otra terminal: levantar frontend
   pnpm --filter frontend dev
   ```

2. **Acceder a la aplicación**:
   - Abrir `http://localhost:5173/portfolio` sin haber iniciado sesión.
   - **Resultado esperado**: Redirección inmediata a `http://localhost:5173/login`.

3. **Iniciar sesión con un usuario nuevo (sin tokens)**:
   - Iniciar sesión y navegar a `/portfolio` (o mediante el enlace "Portfolio" en el menú de navegación).
   - **Resultado esperado**: Se despliega el mensaje de bienvenida ("Aún no tienes tokens en tu portfolio") y el botón que conduce a `/catalog`.

4. **Comprar tokens y volver a consultar**:
   - Con el usuario habiendo adquirido tokens, regresar a `/portfolio`.
   - **Resultado esperado**:
     - Las tarjetas de **Resumen Global** muestran: Total Invertido, Valor Actual y Ganancia/Pérdida neta acumulada en verde/rojo según el balance.
     - La tabla o tarjetas de **Holdings** muestra cada futbolista con cantidad, precio de compra promedio, cotización actual y rendimiento particular.
     - No se ejecutan consultas automáticas en segundo plano (inspeccionar pestaña Network en DevTools).

