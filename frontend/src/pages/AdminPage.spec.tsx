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
    expect(screen.getByRole('heading', { name: /Actualizar Datos de Jugadores/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Actualizar Clubes y Escudos/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Simulación de Mercado y Actividad Interactiva/i })).toBeInTheDocument();
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

  it('dispara la simulación de mercado y muestra el resumen de resultados', async () => {
    vi.spyOn(authServiceModule.authService, 'me').mockResolvedValueOnce({
      id: 'u-admin',
      email: 'admin@mail.com',
      role: 'admin',
    });

    const simSpy = vi.spyOn(adminServiceModule.adminService, 'simulateMarket').mockResolvedValueOnce({
      success: true,
      message: 'Simulación completada con éxito.',
      adminEmail: 'admin@mail.com',
      holdingsCreated: 6,
      transactionsCreated: 12,
      ordersCreated: 4,
      marketOrdersCreated: 36,
      quotesCreated: 30,
      playersInvolved: ['Emiliano Martínez', 'Wesley Fofana'],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ejecutar Simulación Completa/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Ejecutar Simulación Completa/i }));

    await waitFor(() => {
      expect(simSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Simulación ejecutada con éxito para admin@mail\.com/i)).toBeInTheDocument();
      expect(screen.getByText('⚽ Emiliano Martínez')).toBeInTheDocument();
    });
  });

  it('dispara el recálculo global de cotizaciones y muestra el resumen de recalculados/salteados', async () => {
    vi.spyOn(authServiceModule.authService, 'me').mockResolvedValueOnce({
      id: 'u-admin',
      email: 'admin@mail.com',
      role: 'admin',
    });

    const recalcSpy = vi.spyOn(adminServiceModule.adminService, 'recalculateQuotes').mockResolvedValueOnce({
      recalculated: [{ userId: 'u-1', playerId: 'p-1', value: 50, score: 0.5 }],
      skipped: [{ userId: 'u-2', playerId: 'p-2', reason: 'faltan métricas' }],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Recalcular$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Recalcular$/i }));

    await waitFor(() => {
      expect(recalcSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Cotizaciones actualizadas:')).toBeInTheDocument();
      expect(screen.getByText(/Combinaciones salteadas \(1\)/)).toBeInTheDocument();
    });
  });

  it('muestra un error si falla el recálculo global de cotizaciones', async () => {
    vi.spyOn(authServiceModule.authService, 'me').mockResolvedValueOnce({
      id: 'u-admin',
      email: 'admin@mail.com',
      role: 'admin',
    });

    vi.spyOn(adminServiceModule.adminService, 'recalculateQuotes').mockRejectedValueOnce(
      new Error('Ya hay un recálculo en curso'),
    );

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Recalcular$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Recalcular$/i }));

    await waitFor(() => {
      expect(screen.getByText('Ya hay un recálculo en curso')).toBeInTheDocument();
    });
  });
});
