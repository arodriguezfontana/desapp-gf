import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider } from './AuthContext';
import { useAuth } from '../hooks/useAuth';
import { authStorage } from '../service/authStorage';
import { httpEvents } from '../service/httpClient';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function Consumer() {
  const { isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
      <button onClick={() => login('new-token')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
  });

  it('arranca autenticado si ya hay un token guardado', () => {
    authStorage.setToken('existing-token');
    renderProvider();
    expect(screen.getByTestId('status')).toHaveTextContent('in');
  });

  it('arranca no autenticado si no hay token guardado', () => {
    renderProvider();
    expect(screen.getByTestId('status')).toHaveTextContent('out');
  });

  it('login guarda el token en authStorage y marca al usuario como autenticado', () => {
    renderProvider();
    fireEvent.click(screen.getByText('login'));
    expect(authStorage.getToken()).toBe('new-token');
    expect(screen.getByTestId('status')).toHaveTextContent('in');
  });

  it('logout limpia el token, desautentica y navega a /login', () => {
    authStorage.setToken('existing-token');
    renderProvider();
    fireEvent.click(screen.getByText('logout'));
    expect(authStorage.getToken()).toBeNull();
    expect(screen.getByTestId('status')).toHaveTextContent('out');
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('ante un evento unauthorized del httpClient, desautentica y navega a /login', () => {
    authStorage.setToken('existing-token');
    renderProvider();

    act(() => {
      httpEvents.dispatchEvent(new Event('unauthorized'));
    });

    expect(screen.getByTestId('status')).toHaveTextContent('out');
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});
