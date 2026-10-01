import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { PublicOnlyRoute } from './PublicOnlyRoute';
import { AuthContext, type AuthContextValue } from '../contexts/auth-context';

function renderWithAuth(isAuthenticated: boolean) {
  const authValue: AuthContextValue = {
    isAuthenticated,
    login: vi.fn(),
    logout: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/home" element={<div>Home Page</div>} />
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<div>Login Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('PublicOnlyRoute', () => {
  it('renderiza la ruta pública (login/registro) si isAuthenticated es false', () => {
    renderWithAuth(false);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument();
  });

  it('redirige a /home si isAuthenticated es true (FR-014 de 003-frontend-auth)', () => {
    renderWithAuth(true);
    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});
