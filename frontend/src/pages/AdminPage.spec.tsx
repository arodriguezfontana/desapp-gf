import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminPage } from './AdminPage';
import * as authServiceModule from '../service/authService';
import * as adminServiceModule from '../service/adminService';
import { apiKeyStorage } from '../service/apiKeyStorage';
import { authStorage } from '../service/authStorage';

describe('AdminPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    apiKeyStorage.clearApiKey();
    authStorage.setToken('test-admin-jwt');
  });

  it('redirige a /home si el usuario no tiene rol admin', async () => {
    vi.spyOn(authServiceModule.authService, 'me').mockResolvedValueOnce({
      id: 'u-1',
      email: 'regular@mail.com',
      role: 'user',
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/home" element={<div>Home Mock</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Home Mock')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Panel de Administración/i)).not.toBeInTheDocument();
  });

  it('renderiza el panel de administración completo cuando el usuario es admin', async () => {
    vi.spyOn(authServiceModule.authService, 'me').mockResolvedValueOnce({
      id: 'u-admin',
      email: 'admin@mail.com',
      role: 'admin',
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Panel de Administración/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/ADMINISTRADOR: admin@mail\.com/i)).toBeInTheDocument();
    expect(screen.getByText('WHOSCORED')).toBeInTheDocument();
    expect(screen.getByText('FOOTBALL DATA')).toBeInTheDocument();
    expect(screen.getByText('MOTOR DE PRICING')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Actualizar Datos de Jugadores/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Actualizar Clubes y Escudos/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Calcular Cotizaciones/i })).toBeInTheDocument();
  });

  it('dispara la actualización de datos de WhoScored al hacer click en el botón', async () => {
    vi.spyOn(authServiceModule.authService, 'me').mockResolvedValueOnce({
      id: 'u-admin',
      email: 'admin@mail.com',
      role: 'admin',
    });

    const triggerSpy = vi.spyOn(adminServiceModule.adminService, 'triggerWhoScoredSync').mockResolvedValueOnce({
      runId: 'run-1234',
      status: 'running',
      trigger: 'manual',
      startedAt: '2026-10-12T00:00:00.000Z',
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Iniciar Actualización de Jugadores/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Iniciar Actualización de Jugadores/i }));

    await waitFor(() => {
      expect(triggerSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Actualización en curso/i)).toBeInTheDocument();
    });
  });

  it('dispara el recálculo masivo de cotizaciones y muestra el resultado en pantalla', async () => {
    vi.spyOn(authServiceModule.authService, 'me').mockResolvedValueOnce({
      id: 'u-admin',
      email: 'admin@mail.com',
      role: 'admin',
    });

    const recalcSpy = vi.spyOn(adminServiceModule.adminService, 'recalculateQuotes').mockResolvedValueOnce({
      processedPlayers: 150,
      errors: 0,
      durationMs: 840,
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Calcular Todas las Cotizaciones/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Calcular Todas las Cotizaciones/i }));

    await waitFor(() => {
      expect(recalcSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('150 jugadores')).toBeInTheDocument();
      expect(screen.getByText(/0\.8 segundos/i)).toBeInTheDocument();
    });
  });

  it('permite generar y vincular una clave de administrador si no tiene una en el navegador', async () => {
    vi.spyOn(authServiceModule.authService, 'me').mockResolvedValueOnce({
      id: 'u-admin',
      email: 'admin@mail.com',
      role: 'admin',
    });

    const apiKeySpy = vi.spyOn(authServiceModule.authService, 'generateApiKey').mockResolvedValueOnce({
      id: 'key-admin',
      apiKey: 'pmk_admin_secret_key',
      createdAt: '2026-10-12T00:00:00.000Z',
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generar Clave Ahora/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Generar Clave Ahora/i }));

    await waitFor(() => {
      expect(apiKeySpy).toHaveBeenCalledTimes(1);
      expect(apiKeyStorage.getApiKey()).toBe('pmk_admin_secret_key');
      expect(screen.getByText(/Clave de administrador emitida y vinculada correctamente/i)).toBeInTheDocument();
    });
  });
});
