import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { router } from './routes/router';

/** El inicio, el portafolio, la cuenta y la administración exigen sesión; el catálogo es público. Sin sesión activa. */
describe('Rutas públicas y protegidas (sin sesión)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const go = async (path: string) => {
    render(<App />);
    await act(async () => {
      await router.navigate(path);
    });
  };

  it.each(['/home', '/portfolio', '/account', '/admin'])('%s sigue pidiendo sesión: sin ella lleva a /login', async (path) => {
    await go(path);

    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it('el catálogo sigue siendo público', async () => {
    await go('/catalog');

    expect(screen.queryByRole('button', { name: /iniciar sesión/i })).not.toBeInTheDocument();
  });
});
