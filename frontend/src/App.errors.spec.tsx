import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { router } from './routes/router';

/** Una ruta que no existe muestra la página 404 (con o sin sesión), sin redirigir al login. */
describe('Rutas inexistentes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('una ruta desconocida muestra la página de error 404', async () => {
    render(<App />);
    await act(async () => {
      await router.navigate('/esto-no-existe');
    });

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();
    expect(screen.getByText('/esto-no-existe')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /iniciar sesión/i })).not.toBeInTheDocument();
  });
});
