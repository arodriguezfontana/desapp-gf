import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterPage } from './RegisterPage';
import * as authServiceModule from '../service/authService';
import { AuthContext, type AuthContextValue } from '../contexts/auth-context';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderRegister() {
  const authValue: AuthContextValue = {
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
  };
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renderiza el formulario con campos email y password', () => {
    renderRegister();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /registr/i })).toBeInTheDocument();
  });

  it('redirige a /login tras un registro exitoso', async () => {
    vi.spyOn(authServiceModule.authService, 'register').mockResolvedValueOnce(undefined);
    renderRegister();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'nuevo@mail.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'Abcd1234!' } });
    fireEvent.click(screen.getByRole('button', { name: /registr/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });

  it('muestra el mensaje exacto del backend ante un error', async () => {
    const err = new Error('El email ya está en uso.');
    vi.spyOn(authServiceModule.authService, 'register').mockRejectedValueOnce(err);
    renderRegister();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'dup@mail.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'Abcd1234!' } });
    fireEvent.click(screen.getByRole('button', { name: /registr/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('El email ya está en uso.'),
    );
  });

  it('deshabilita el botón mientras isLoading = true', async () => {
    let resolve: () => void;
    const promise = new Promise<void>((r) => { resolve = r; });
    vi.spyOn(authServiceModule.authService, 'register').mockReturnValueOnce(promise);
    renderRegister();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@mail.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'Abcd1234!' } });
    fireEvent.click(screen.getByRole('button', { name: /registr/i }));

    expect(screen.getByRole('button', { name: /registrando/i })).toBeDisabled();
    await waitFor(() => resolve!());
  });
});

