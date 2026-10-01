import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { AppLayout } from './AppLayout';
import { AuthContext, type AuthContextValue } from '../contexts/auth-context';

function renderLayout(logout = vi.fn(), initialPath = '/home', isAuthenticated = true) {
  const authValue: AuthContextValue = { isAuthenticated, login: vi.fn(), logout };
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/home" element={<div>Home Content</div>} />
            <Route path="/account" element={<div>Account Content</div>} />
            <Route path="/login" element={<div>Login Content</div>} />
            <Route path="/catalog" element={<div>Catalog Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('AppLayout', () => {
  it('renderiza la marca, la navegación y el contenido de la ruta activa', () => {
    renderLayout();
    expect(screen.getAllByText(/fútval/i).length).toBeGreaterThan(0);
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

  it('sin autenticar muestra "Iniciar Sesión" y oculta el botón "Cerrar Sesión"', () => {
    renderLayout(vi.fn(), '/home', false);
    expect(screen.getAllByRole('link', { name: /iniciar sesión/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /cerrar sesión/i })).not.toBeInTheDocument();
  });

  it('el botón hamburguesa abre y cierra el menú móvil', () => {
    renderLayout();
    const toggleBtn = screen.getByRole('button', { name: /abrir menú de navegación/i });

    // El footer ya incluye estos textos una vez; al abrir el menú móvil se duplican.
    expect(screen.getAllByText('Inicio Plataforma')).toHaveLength(1);

    fireEvent.click(toggleBtn);
    expect(screen.getAllByText('Inicio Plataforma')).toHaveLength(2);
    expect(screen.getAllByText('Catálogo de Jugadores')).toHaveLength(2);

    fireEvent.click(toggleBtn);
    expect(screen.getAllByText('Inicio Plataforma')).toHaveLength(1);
  });

  it('en el menú móvil autenticado "Cerrar Sesión" llama a logout y cierra el menú', () => {
    const logout = vi.fn();
    renderLayout(logout);

    fireEvent.click(screen.getByRole('button', { name: /abrir menú de navegación/i }));
    const closeButtons = screen.getAllByRole('button', { name: /cerrar sesión/i });
    expect(closeButtons).toHaveLength(2);

    fireEvent.click(closeButtons[1]);

    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Inicio Plataforma')).toHaveLength(1);
  });

  it('en el menú móvil sin autenticar muestra "Iniciar Sesión" y lo cierra al hacer click', () => {
    renderLayout(vi.fn(), '/home', false);

    fireEvent.click(screen.getByRole('button', { name: /abrir menú de navegación/i }));
    const mobileLoginLinks = screen.getAllByRole('link', { name: /iniciar sesión/i });
    expect(mobileLoginLinks.length).toBeGreaterThan(1);

    fireEvent.click(mobileLoginLinks[mobileLoginLinks.length - 1]);
    expect(screen.getAllByText('Inicio Plataforma')).toHaveLength(1);
  });

  it('un link del menú móvil cierra el menú al hacer click', () => {
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: /abrir menú de navegación/i }));
    const catalogLinks = screen.getAllByText('Catálogo de Jugadores');
    expect(catalogLinks).toHaveLength(2);
    // El primero es el del menú desplegable móvil (en el header); el segundo es el del footer.
    fireEvent.click(catalogLinks[0]);

    expect(screen.getAllByText('Inicio Plataforma')).toHaveLength(1);
  });
});
