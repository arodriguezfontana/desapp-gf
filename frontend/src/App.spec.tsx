import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirige a /login y renderiza la pantalla de inicio de sesión por defecto', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
  });
});
