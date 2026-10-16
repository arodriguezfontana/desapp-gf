/**
 * Test de integración de Portfolio contra backend real (NestJS + PostgreSQL en Testcontainers).
 * Ejecutar con: pnpm test:integration
 */
import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env.VITE_TEST_API_URL ?? 'http://localhost:3001';

async function apiGet(path: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${API_URL}${path}`, {
    method: 'GET',
    headers,
  });
}

async function apiPost(path: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('Portfolio personal — integración contra backend real', () => {
  const uniqueEmail = `portfolio-test-${Date.now()}-${Math.random().toString(36).slice(2)}@mail.com`;
  const password = 'Password123!';
  let userId: string;
  let accessToken: string;

  beforeAll(async () => {
    // 1. Registrar usuario
    const regRes = await apiPost('/auth/register', { email: uniqueEmail, password, username: 'portfolio-tester' });
    expect(regRes.status).toBe(201);
    const regBody = (await regRes.json()) as { id?: string };
    userId = regBody.id ?? '';

    // 2. Login para obtener JWT
    const loginRes = await apiPost('/auth/login', { email: uniqueEmail, password });
    expect(loginRes.status).toBe(201);
    const loginBody = (await loginRes.json()) as { accessToken: string; user?: { id: string } };
    accessToken = loginBody.accessToken;
    if (loginBody.user?.id) {
      userId = loginBody.user.id;
    }
  });

  it('GET /users/:id/portfolio sin JWT devuelve 401 No Autorizado', async () => {
    const res = await apiGet(`/users/${userId || 'any-id'}/portfolio`);
    expect(res.status).toBe(401);
  });

  it('GET /users/:id/portfolio con JWT inválido devuelve 401 No Autorizado', async () => {
    const res = await apiGet(`/users/${userId || 'any-id'}/portfolio`, 'invalid.jwt.token');
    expect(res.status).toBe(401);
  });

  it('GET /users/:id/portfolio con usuario sin tokens devuelve 200 y holdings vacío', async () => {
    const res = await apiGet(`/users/${userId}/portfolio`, accessToken);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      holdings: Array<{
        playerId: string;
        playerName: string;
        tokenQuantity: number;
        averageBuyPrice: number;
        currentPrice: number;
        totalProfitLoss: number;
      }>;
      summary?: {
        totalInvested: number;
        totalCurrentValue: number;
        netProfitLoss: number;
      };
    };

    expect(Array.isArray(body.holdings)).toBe(true);
    expect(body.holdings).toHaveLength(0);

    if (body.summary) {
      expect(body.summary.totalInvested).toBe(0);
      expect(body.summary.totalCurrentValue).toBe(0);
      expect(body.summary.netProfitLoss).toBe(0);
    }
  });
});

