import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 020-order-matching-engine: primer test de integración que renderiza un
  // componente React de verdad (RTL) contra el backend real — el resto de
  // los specs de esta suite usa `fetch` crudo (sin render), así que no
  // necesitaban jsdom ni el plugin de React hasta ahora.
  plugins: [react()],
  // `import.meta.env.VITE_API_BASE_URL` (lo que lee httpClient) es un
  // reemplazo estático de Vite en build-time; una env var seteada en runtime
  // por `globalSetup` (que corre en otro proceso) no alcanza a tiempo para
  // esta sustitución. El puerto es fijo (BACKEND_PORT en global-setup.ts),
  // así que se define acá directamente.
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://localhost:3001'),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    include: ['test/**/*.spec.{ts,tsx}'],
    testTimeout: 60000,
  },
});

