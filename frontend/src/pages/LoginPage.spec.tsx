import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginPage } from './LoginPage';
import * as authServiceModule from '../service/authService';
import type { LoginResponseDto } from '../types/auth.types';
import { AuthContext, type AuthContextValue } from '../contexts/auth-context';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderLogin(loginFn = vi.fn()) {
  const authValue: AuthContextValue = {
    isAuthenticated: false,
    login: loginFn,
    logout: vi.fn(),
  };
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/home" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
  });

  it('renderiza el formulario con campos email y password', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it('login exitoso llama a login(), guarda token y navega a /home', async () => {
    const mockLoginCtx = vi.fn();
    vi.spyOn(authServiceModule.authService, 'login').mockResolvedValueOnce({
      accessToken: 'jwt-xyz',
      tokenType: 'Bearer',
      expiresIn: 86400,
    });
    renderLogin(mockLoginCtx);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@mail.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'Pass1234!' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockLoginCtx).toHaveBeenCalledWith('jwt-xyz');
      expect(mockNavigate).toHaveBeenCalledWith('/home');
    });
  });

  it('muestra mensaje genérico Credenciales inválidas ante un error de login', async () => {
    vi.spyOn(authServiceModule.authService, 'login').mockRejectedValueOnce(
      new Error('Detalle interno del servidor no debe exponerse'),
    );
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bad@mail.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'WrongPass!' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Credenciales inválidas.');
    });
  });

  it('deshabilita el botón mientras isLoading = true', async () => {
    let resolve: (val: LoginResponseDto) => void;
    const promise = new Promise<LoginResponseDto>((r) => { resolve = r; });
    vi.spyOn(authServiceModule.authService, 'login').mockReturnValueOnce(promise);
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@mail.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'Pass1234!' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(screen.getByRole('button', { name: /ingresando/i })).toBeDisabled();
    await waitFor(() => resolve({ accessToken: 'tok', tokenType: 'Bearer', expiresIn: 1000 }));
  });
});
