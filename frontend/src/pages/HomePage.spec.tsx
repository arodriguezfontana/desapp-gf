import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { HomePage } from './HomePage';

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe('HomePage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra el primer slide del hero por defecto', () => {
    renderHome();
    expect(screen.getByText(/bienvenido a fútval/i)).toBeInTheDocument();
  });

  it('cambia de slide al hacer clic en un indicador', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: /ver slide 2/i }));
    expect(screen.getByText(/gestión de seguridad & apikey/i)).toBeInTheDocument();
  });

  it('rota automáticamente de slide cada 5 segundos', () => {
    vi.useFakeTimers();
    renderHome();
    expect(screen.getByText(/bienvenido a fútval/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText(/gestión de seguridad & apikey/i)).toBeInTheDocument();
  });
});
