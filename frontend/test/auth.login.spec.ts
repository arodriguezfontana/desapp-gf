/**
 * T033 — Test de integración de authService.login contra el backend real.
 * Ejecutar con: pnpm test:integration
 */
import { describe, it, expect } from 'vitest';

const API_URL = process.env.VITE_TEST_API_URL ?? 'http://localhost:3001';

async function apiPost(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('authService.login — integración contra backend real', () => {
  const uniqueEmail = `login-test-${Date.now()}-${Math.random().toString(36).slice(2)}@mail.com`;
  const password = 'Password123!';

  it('login con credenciales válidas devuelve accessToken', async () => {
    // 1. Crear usuario primero
    const regRes = await apiPost('/auth/register', { email: uniqueEmail, password });
    expect(regRes.status).toBe(201);

    // 2. Login
    const loginRes = await apiPost('/auth/login', { email: uniqueEmail, password });
    expect(loginRes.status).toBe(201);
    const body = (await loginRes.json()) as { accessToken: string };
    expect(body.accessToken).toBeTruthy();
  });

  it('login con contraseña incorrecta devuelve 401', async () => {
    const loginRes = await apiPost('/auth/login', {
      email: uniqueEmail,
      password: 'WrongPassword!',
    });
    expect(loginRes.status).toBe(401);
  });

  it('login con email inexistente devuelve 401', async () => {
    const loginRes = await apiPost('/auth/login', {
      email: 'nonexistent-user-12345@mail.com',
      password,
    });
    expect(loginRes.status).toBe(401);
  });
});

