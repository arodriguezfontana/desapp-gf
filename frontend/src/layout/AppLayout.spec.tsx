import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { AppLayout } from './AppLayout';
import { AuthContext, type AuthContextValue } from '../contexts/auth-context';

function renderLayout(logout = vi.fn(), initialPath = '/home') {
  const authValue: AuthContextValue = { isAuthenticated: true, login: vi.fn(), logout };
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/home" element={<div>Home Content</div>} />
            <Route path="/account" element={<div>Account Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('AppLayout', () => {
  it('renderiza la marca, la navegación y el contenido de la ruta activa', () => {
    renderLayout();
    expect(screen.getAllByText(/desapp/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /inicio/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /mi cuenta/i }).length).toBeGreaterThan(0);
    expect(screen.getByText('Home Content')).toBeInTheDocument();
  });

  it('el botón Cerrar Sesión llama a logout', () => {
    const logout = vi.fn();
    renderLayout(logout);
    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('marca "Mi cuenta" como activo y "Inicio" como inactivo en /account', () => {
    renderLayout(vi.fn(), '/account');
    const accountLink = screen.getAllByRole('link', { name: /mi cuenta/i })[0];
    const homeLink = screen.getAllByRole('link', { name: /inicio/i })[0];
    expect(accountLink).toHaveAttribute('aria-current', 'page');
    expect(homeLink).not.toHaveAttribute('aria-current');
  });
});
