import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirige a /home por defecto, y sin sesión termina en /login (home está protegida)', () => {
    render(<App />);
    expect(
      screen.getByRole('button', { name: /iniciar sesión/i }),
    ).toBeInTheDocument();
  });
});
