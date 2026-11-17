/**
 * Simulación de mercado y actividad interactiva, REAL: opera contra la API HTTP de un backend en ejecución
 * (`pnpm dev`), igual que lo haría un usuario. Así cada alta, compra, venta, rechazo, cancelación, recálculo,
 * alerta y notificación pasa por el backend que expone `GET /metrics` y cuenta en las métricas de negocio
 * (spec 031), y por lo tanto aparece en Prometheus y en Grafana.
 *
 * Pasos:
 *   1. `POST /admin/simulate-market` siembra el mercado de demo (bots, tenencias, historial, cotizaciones, alertas).
 *   2. Compras y ventas reales entre el superusuario, el admin y los bots; rechazos por tokens insuficientes y
 *      cancelaciones. Quién vende y quién compra se decide con los portfolios reales: vende el que más tokens
 *      tiene del jugador.
 *   3. Alertas, recálculos y notificaciones (una con el stream SSE abierto y otra sin conexión).
 *
 * Uso (con el backend corriendo):
 *   pnpm --dir backend seed:simulation            # contra http://localhost:3000
 *   pnpm --dir backend seed:simulation -- --sync  # además sincroniza Football-Data (~70 s, llama al proveedor real)
 *
 * Variables (backend/.env): BACKEND_URL, ADMIN_EMAIL, ADMIN_PASSWORD, BOT_PASSWORD, SUPERUSER_EMAIL,
 * SUPERUSER_PASSWORD, ADMIN_API_KEY (opcional: si no está, se emite una API key de admin nueva por corrida) y
 * ACTIVITY_ROUNDS (rondas por jugador, default 3).
 */
import 'dotenv/config';
import * as http from 'node:http';

interface ActivityOptions {
  baseUrl?: string;
  /** Jugadores sobre los que operar; si falta, se pide a `POST /admin/simulate-market`. */
  playerIds?: string[];
  rounds?: number;
  /** Dispara además la sincronización de Football-Data (sincrónica, ~70 s). */
  sync?: boolean;
}

interface OrderSummary {
  playerId: string;
  side: string;
  status: string;
  remainingQuantity: number;
}

interface ApiResponse {
  status: number;
  body: Record<string, unknown> | null;
}

const BOT_EMAILS = ['bot_liquidity_1@desapp.com', 'bot_trader_2@desapp.com', 'bot_whale_3@desapp.com'];
const PLAYERS_TO_TRADE = 3;
const ACTIVITY_USER_PASSWORD = 'Activity123!';

class ActivityClient {
  constructor(private readonly baseUrl: string) {}

  async call(
    method: string,
    path: string,
    options: { token?: string; apiKey?: string; body?: unknown } = {},
  ): Promise<ApiResponse> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.apiKey ? { 'x-api-key': options.apiKey } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const body = await res.json().then(
      (json: unknown) => json as Record<string, unknown>,
      () => null,
    );
    return { status: res.status, body };
  }

  async login(email: string, password: string): Promise<string> {
    const res = await this.call('POST', '/auth/login', { body: { email, password } });
    const token = res.body?.accessToken;
    if (typeof token !== 'string') {
      throw new Error(`No se pudo iniciar sesión como ${email} (HTTP ${res.status}).`);
    }
    return token;
  }

  /** Abre el stream de notificaciones y devuelve cómo cerrarlo (cierre abrupto del cliente). */
  openStream(token: string): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}/notifications/stream?token=${token}`);
      const req = http.get(url, (res) => {
        res.on('data', () => undefined);
        resolve(() => res.destroy());
      });
      req.on('error', reject);
    });
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function runSimulation(options: ActivityOptions = {}): Promise<void> {
  const baseUrl = options.baseUrl ?? process.env.BACKEND_URL ?? 'http://localhost:3000';
  const rounds = options.rounds ?? Number(process.env.ACTIVITY_ROUNDS ?? 3);
  const api = new ActivityClient(baseUrl);
  const counters = { orders: 0, rejected: 0, cancelled: 0, failed: 0 };

  const health = await api.call('GET', '/health').catch(() => null);
  if (!health || health.status !== 200) {
    throw new Error(`No hay un backend respondiendo en ${baseUrl}. Levantalo con "pnpm dev" y reintentá.`);
  }

  // 1. Sesiones: admin y bots (el login de cada uno ya es una operación medida).
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@desapp.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Abrilrz1!';
  const botPassword = process.env.BOT_PASSWORD ?? 'BotSecurePass123!';
  const adminToken = await api.login(adminEmail, adminPassword);

  let apiKey = process.env.ADMIN_API_KEY;
  if (!apiKey) {
    const issued = await api.call('POST', '/auth/api-key', { token: adminToken });
    apiKey = typeof issued.body?.apiKey === 'string' ? issued.body.apiKey : undefined;
  }
  if (!apiKey) throw new Error('No se pudo obtener una API key de admin.');

  // 2. Jugadores con actividad: los que la simulación sembró (los bots tienen tokens de esos jugadores).
  let playerIds = options.playerIds;
  if (!playerIds || playerIds.length === 0) {
    const simulated = await api.call('POST', '/admin/simulate-market', { token: adminToken });
    const quotes = (simulated.body?.quotes as Array<{ playerId: string }> | undefined) ?? [];
    const involved = (simulated.body?.playersInvolved as string[] | undefined)?.length ?? 0;
    playerIds = quotes.slice(0, involved).map((q) => q.playerId);
  }
  playerIds = playerIds.slice(0, PLAYERS_TO_TRADE);
  if (playerIds.length === 0) throw new Error('No hay jugadores simulados para operar. Corré antes la simulación.');

  // Operadores con tokens: el superusuario (que recibe la emisión inicial de cada jugador), el admin y los bots.
  interface Trader {
    name: string;
    token: string;
    userId: string;
  }
  const traders: Trader[] = [];
  const addTrader = async (name: string, email: string, password: string, token?: string) => {
    try {
      const jwt = token ?? (await api.login(email, password));
      const me = await api.call('GET', '/auth/me', { token: jwt });
      if (typeof me.body?.id === 'string') traders.push({ name, token: jwt, userId: me.body.id });
    } catch {
      console.warn(`   (se omite ${name}: no se pudo iniciar sesión)`);
    }
  };
  if (process.env.SUPERUSER_EMAIL && process.env.SUPERUSER_PASSWORD) {
    await addTrader('superusuario', process.env.SUPERUSER_EMAIL, process.env.SUPERUSER_PASSWORD);
  }
  await addTrader('admin', adminEmail, adminPassword, adminToken);
  for (const email of BOT_EMAILS) await addTrader(email.split('@')[0], email, botPassword);
  if (traders.length < 2) throw new Error('Hacen falta al menos dos operadores con sesión para operar entre sí.');

  /**
   * Tokens que cada operador puede vender del jugador: lo que tiene en el portfolio real menos lo que ya
   * ofreció en ventas abiertas (la misma cuenta que hace el backend al validar una venta).
   */
  const holdingsOf = async (playerId: string): Promise<Map<Trader, number>> => {
    const entries = await Promise.all(
      traders.map(async (trader): Promise<[Trader, number]> => {
        const portfolio = await api.call('GET', `/users/${trader.userId}/portfolio`, { token: trader.token });
        const holdings = (portfolio.body?.holdings as Array<{ playerId: string; tokenQuantity: number }> | undefined) ?? [];
        const owned = holdings.find((h) => h.playerId === playerId)?.tokenQuantity ?? 0;
        const orders = await api.call('GET', '/orders', { token: trader.token });
        const list = Array.isArray(orders.body) ? (orders.body as unknown as OrderSummary[]) : [];
        const pendingSells = list
          .filter((o) => o.playerId === playerId && o.side === 'SELL' && (o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED'))
          .reduce((total, o) => total + o.remainingQuantity, 0);
        return [trader, Math.max(0, owned - pendingSells)];
      }),
    );
    return new Map(entries);
  };

  const place = async (trader: Trader | string, side: 'BUY' | 'SELL', playerId: string, quantity: number) => {
    const token = typeof trader === 'string' ? trader : trader.token;
    const res = await api.call('POST', '/orders', { token, body: { side, playerId, quantity } });
    return res;
  };
  const accepted = (res: ApiResponse) => {
    if (res.status === 201) counters.orders += 1;
    else {
      counters.failed += 1;
      if (counters.failed <= 3) console.warn(`   (orden no aceptada: HTTP ${res.status} ${String(res.body?.message ?? '')})`);
    }
    return res;
  };

  // 3. Un usuario sin tokens: sus ventas son rechazos por tokens insuficientes.
  const activityEmail = 'futval_activity@desapp.local';
  await api.call('POST', '/auth/register', {
    body: { email: activityEmail, password: ACTIVITY_USER_PASSWORD, username: 'futval_activity' },
  });
  const activityToken = await api.login(activityEmail, ACTIVITY_USER_PASSWORD);

  // 4. Compras y ventas reales: el que más tokens tiene del jugador le vende a otro operador.
  console.log(`📈 Operando ${rounds} ronda(s) sobre ${playerIds.length} jugador(es) en ${baseUrl}...`);
  /**
   * Cancela las órdenes abiertas de los operadores sobre el jugador. Con el libro vacío, una compra queda
   * esperando y la venta siguiente la toma (así hay también ventas que cruzan como iniciador), y los tokens
   * ofrecidos en corridas anteriores vuelven a estar disponibles.
   */
  const clearOpenOrders = async (playerId: string) => {
    for (const trader of traders) {
      const orders = await api.call('GET', '/orders', { token: trader.token });
      const list = Array.isArray(orders.body) ? (orders.body as unknown as Array<OrderSummary & { id: string }>) : [];
      for (const order of list) {
        if (order.playerId !== playerId || (order.status !== 'PENDING' && order.status !== 'PARTIALLY_FILLED')) continue;
        const res = await api.call('DELETE', `/orders/${order.id}`, { token: trader.token });
        counters.cancelled += res.status === 204 || res.status === 200 ? 1 : 0;
      }
    }
  };

  for (const playerId of playerIds) {
    await clearOpenOrders(playerId);
    for (let round = 0; round < rounds; round++) {
      const holdings = await holdingsOf(playerId);
      const ranked = [...traders].sort((a, b) => (holdings.get(b) ?? 0) - (holdings.get(a) ?? 0));
      const seller = ranked[0];
      const buyer = ranked[1 + (round % (ranked.length - 1))];
      if ((holdings.get(seller) ?? 0) < 3) {
        console.warn(`   (nadie tiene tokens suficientes del jugador ${playerId}: se omite)`);
        break;
      }
      // Compra que cruza: el vendedor deja una venta y el comprador la toma (el iniciador compra).
      accepted(await place(seller, 'SELL', playerId, 2));
      accepted(await place(buyer, 'BUY', playerId, 2));
      // Venta que cruza: el comprador deja una compra y el vendedor la toma (el iniciador vende).
      accepted(await place(buyer, 'BUY', playerId, 1));
      accepted(await place(seller, 'SELL', playerId, 1));
      // Una orden que queda en el libro y se cancela.
      const resting = accepted(await place(buyer, 'BUY', playerId, 1));
      const restingId = resting.body?.id;
      if (resting.status === 201 && resting.body?.status !== 'COMPLETED' && typeof restingId === 'string') {
        const cancelled = await api.call('DELETE', `/orders/${restingId}`, { token: buyer.token });
        counters.cancelled += cancelled.status === 204 || cancelled.status === 200 ? 1 : 0;
      }
      // Rechazo por tokens insuficientes.
      const rejected = await place(activityToken, 'SELL', playerId, 5);
      if (rejected.status === 400) counters.rejected += 1;
      else counters.failed += 1;
    }
  }

  // 5. Alertas, recálculo y notificaciones: una con el stream abierto (live) y otra sin conexión (stored_only).
  console.log('🔔 Alertas, recálculos y notificaciones...');
  await api.call('POST', '/alerts', {
    token: adminToken,
    body: { playerId: playerIds[0], condition: 'PRICE_BELOW', targetValue: 999999 },
  }); // 409 si ya existe: es idempotente

  const closeStream = await api.openStream(adminToken);
  await sleep(500);
  await api.call('POST', '/quotes/recalculate', { apiKey });
  await sleep(500);
  closeStream();
  await sleep(500);
  await api.call('POST', '/quotes/recalculate', { apiKey });

  // 6. Sincronización de Football-Data (opcional: tarda ~70 s y llama al proveedor real).
  if (options.sync) {
    console.log('🔄 Sincronizando Football-Data (~70 s)...');
    const sync = await api.call('POST', '/sync/football-data', { apiKey });
    console.log(`   respuesta HTTP ${sync.status}`);
  }

  console.log(
    `✅ Movimiento listo: ${counters.orders} órdenes aceptadas, ${counters.rejected} rechazos por tokens insuficientes, ${counters.cancelled} canceladas` +
      (counters.failed > 0 ? ` (${counters.failed} respuestas inesperadas)` : '.'),
  );
  console.log(`   Métricas: ${baseUrl}/metrics  ·  Grafana: http://localhost:3001/d/futval-http-metrics (fila "Negocio")`);
}

runSimulation({ sync: process.argv.includes('--sync') }).catch((error: unknown) => {
  console.error('❌ Error en la simulación:', error instanceof Error ? error.message : error);
  process.exit(1);
});
