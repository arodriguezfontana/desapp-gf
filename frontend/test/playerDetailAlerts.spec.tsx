/**
 * 025-player-price-alerts — Test de integración del flujo de alertas de
 * precio en PlayerDetailPage contra el backend real (NestJS + PostgreSQL en
 * Testcontainers), renderizando el componente de verdad con React Testing
 * Library (constitución, Principio IX: un test de componente que ejercita
 * el cliente de API MUST correr contra el backend real, nunca mockeado).
 * Ejecutar con: pnpm test:integration
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PlayerDetailPage } from '../src/pages/PlayerDetailPage';
import { authStorage } from '../src/service/authStorage';
import { apiKeyStorage } from '../src/service/apiKeyStorage';

const API_URL = process.env.VITE_TEST_API_URL ?? 'http://localhost:3001';

async function apiPost(path: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function registerLoginAndIssueApiKey(
  email: string,
  username: string,
): Promise<{ token: string; apiKey: string; userId: string }> {
  const password = 'Password123!';
  const register = await apiPost('/auth/register', { email, password, username });
  const { id: userId } = (await register.json()) as { id: string };
  const login = await apiPost('/auth/login', { email, password });
  const { accessToken: token } = (await login.json()) as { accessToken: string };
  const issued = await apiPost('/auth/api-key', {}, token);
  const { apiKey } = (await issued.json()) as { apiKey: string };
  return { token, apiKey, userId };
}

function renderPlayerDetail(playerId: string) {
  return render(
    <MemoryRouter initialEntries={[`/catalog/${playerId}`]}>
      <Routes>
        <Route path="/catalog/:id" element={<PlayerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PlayerDetailPage — flujo de alertas de precio contra backend real', () => {
  let pg: Client;

  beforeAll(async () => {
    const connectionString = process.env.TEST_DATABASE_URL;
    if (!connectionString) {
      throw new Error('TEST_DATABASE_URL no inicializada por global-setup.');
    }
    pg = new Client({ connectionString });
    await pg.connect();
  });

  afterAll(async () => {
    await pg?.end();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const insertFreshPlayer = async (): Promise<string> => {
    const playerId = randomUUID();
    await pg.query(
      `INSERT INTO "players" (id, "externalId", name, league, team, position, rating)
       VALUES ($1, $2, $3, 'Premier League', 'Alerts Integration FC', 'FW', 7)`,
      [playerId, `ext-${playerId}`, 'Jugador Alertas'],
    );
    return playerId;
  };

  it('crea una alerta desde la pantalla del jugador y la muestra en el listado propio', async () => {
    const playerId = await insertFreshPlayer();
    const user = await registerLoginAndIssueApiKey(
      `alerts-create-${Date.now()}@mail.com`,
      'alerts-create',
    );
    authStorage.setToken(user.token);
    apiKeyStorage.setApiKey(user.apiKey);

    renderPlayerDetail(playerId);

    await waitFor(() => expect(screen.getByText('Jugador Alertas')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /alertas de precio/i }));
    await waitFor(() => expect(screen.getByLabelText(/valor umbral/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/valor umbral/i), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /crear alerta/i }));

    await waitFor(() => expect(screen.getByText(/baja de 150/i)).toBeInTheDocument());

    const alerts = await pg.query(
      'SELECT user_id, player_id, condition, target_value, status FROM "price_alerts" WHERE user_id = $1',
      [user.userId],
    );
    expect(alerts.rows).toHaveLength(1);
    expect(alerts.rows[0]).toMatchObject({ player_id: playerId, condition: 'PRICE_BELOW', status: 'ACTIVE' });
  });

  it('cancela una alerta propia y deja de mostrar el botón Cancelar', async () => {
    const playerId = await insertFreshPlayer();
    const user = await registerLoginAndIssueApiKey(
      `alerts-cancel-${Date.now()}@mail.com`,
      'alerts-cancel',
    );
    authStorage.setToken(user.token);
    apiKeyStorage.setApiKey(user.apiKey);

    renderPlayerDetail(playerId);
    await waitFor(() => expect(screen.getByText('Jugador Alertas')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /alertas de precio/i }));
    await waitFor(() => expect(screen.getByLabelText(/valor umbral/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/valor umbral/i), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: /crear alerta/i }));
    await waitFor(() => expect(screen.getByText(/baja de 200/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /cancelar alerta baja de 200/i }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /cancelar alerta baja de 200/i })).not.toBeInTheDocument(),
    );

    const alerts = await pg.query(
      'SELECT status FROM "price_alerts" WHERE user_id = $1 AND player_id = $2',
      [user.userId, playerId],
    );
    expect(alerts.rows[0].status).toBe('CANCELLED');
  });
});
