/**
 * 020-order-matching-engine — Test de integración del flujo Comprar/Vender
 * de PlayerDetailPage contra el backend real (NestJS + PostgreSQL en
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

describe('PlayerDetailPage — flujo Comprar/Vender contra backend real', () => {
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

  /**
   * Un jugador nuevo por test (no reutilizado entre tests): el motor de
   * matching real matchea por (playerId, lado opuesto, precio exacto), así
   * que una orden PENDING que quede de un test anterior sobre el MISMO
   * jugador matchearía inesperadamente con la orden del siguiente test
   * (misma estrategia default → mismo precio). Aislar por jugador evita
   * ese acoplamiento sin necesitar limpiar las tablas entre tests.
   */
  const insertFreshPlayer = async (): Promise<string> => {
    const playerId = randomUUID();
    // Nota: `PlayerEntity.externalId` no tiene override `name:` (a diferencia
    // de las entidades nuevas de 020, que sí usan snake_case explícito), así
    // que su columna real en Postgres es camelCase literal: "externalId".
    await pg.query(
      `INSERT INTO "players" (id, "externalId", name, league, team, position, rating)
       VALUES ($1, $2, $3, 'Premier League', 'Integration FC', 'FW', 7)`,
      [playerId, `ext-${playerId}`, 'Jugador Integración'],
    );
    return playerId;
  };

  it('Comprar sin contraparte en el libro: la orden queda pendiente y el mensaje lo refleja', async () => {
    const playerId = await insertFreshPlayer();
    const buyer = await registerLoginAndIssueApiKey(
      `orders-buyer-pending-${Date.now()}@mail.com`,
      'orders-buyer-pending',
    );
    authStorage.setToken(buyer.token);
    apiKeyStorage.setApiKey(buyer.apiKey);

    renderPlayerDetail(playerId);

    await waitFor(() => expect(screen.getByText('Jugador Integración')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }));

    const quantityInput = await screen.findByLabelText(/cantidad de tokens/i);
    fireEvent.change(quantityInput, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar comprar/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/queda pendiente hasta encontrar una contraparte/i),
      ).toBeInTheDocument(),
    );

    const orders = await pg.query(
      'SELECT side, status, remaining_quantity FROM "orders" WHERE user_id = $1 AND player_id = $2',
      [buyer.userId, playerId],
    );
    expect(orders.rows).toHaveLength(1);
    expect(orders.rows[0]).toMatchObject({ side: 'BUY', status: 'PENDING', remaining_quantity: 3 });
  });

  it('Vender y luego Comprar entre dos usuarios distintos ejecuta el match real y actualiza holdings', async () => {
    const playerId = await insertFreshPlayer();
    const seller = await registerLoginAndIssueApiKey(
      `orders-seller-${Date.now()}@mail.com`,
      'orders-seller',
    );
    // El vendedor necesita holding propio: se le acredita directo en base,
    // igual que los e2e de backend (no hay endpoint de "depósito" en 020).
    await pg.query(
      `INSERT INTO "token_holdings" (id, user_id, player_id, quantity, updated_at)
       VALUES ($1, $2, $3, 10, now())`,
      [randomUUID(), seller.userId, playerId],
    );

    authStorage.setToken(seller.token);
    apiKeyStorage.setApiKey(seller.apiKey);
    const sellerRender = renderPlayerDetail(playerId);
    await waitFor(() => expect(screen.getByText('Jugador Integración')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /vender/i }));
    const sellQuantityInput = await screen.findByLabelText(/cantidad de tokens/i);
    fireEvent.change(sellQuantityInput, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar vender/i }));
    await waitFor(() =>
      expect(screen.getByText(/queda pendiente hasta encontrar una contraparte/i)).toBeInTheDocument(),
    );
    sellerRender.unmount();
    localStorage.clear();

    // Un comprador distinto, con la misma estrategia default (seed de 019),
    // valúa el mismo jugador al mismo precio exacto: el motor de matching
    // (020) lo ejecuta de inmediato contra la SELL recién publicada.
    const buyer = await registerLoginAndIssueApiKey(
      `orders-buyer-match-${Date.now()}@mail.com`,
      'orders-buyer-match',
    );
    authStorage.setToken(buyer.token);
    apiKeyStorage.setApiKey(buyer.apiKey);
    renderPlayerDetail(playerId);
    await waitFor(() => expect(screen.getByText('Jugador Integración')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }));
    const buyQuantityInput = await screen.findByLabelText(/cantidad de tokens/i);
    fireEvent.change(buyQuantityInput, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar comprar/i }));

    await waitFor(() =>
      expect(screen.getByText(/ejecutada por completo/i)).toBeInTheDocument(),
    );

    const buyerHolding = await pg.query(
      'SELECT quantity FROM "token_holdings" WHERE user_id = $1 AND player_id = $2',
      [buyer.userId, playerId],
    );
    const sellerHolding = await pg.query(
      'SELECT quantity FROM "token_holdings" WHERE user_id = $1 AND player_id = $2',
      [seller.userId, playerId],
    );
    expect(buyerHolding.rows[0].quantity).toBe(10);
    expect(sellerHolding.rows[0].quantity).toBe(0);

    const transactions = await pg.query(
      'SELECT type, quantity FROM "token_transactions" WHERE user_id = $1',
      [buyer.userId],
    );
    expect(transactions.rows).toHaveLength(1);
    expect(transactions.rows[0]).toMatchObject({ type: 'CREDIT', quantity: 10 });
  });
});
