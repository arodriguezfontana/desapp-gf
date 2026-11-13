#!/usr/bin/env node
/**
 * Línea base de latencia para fundamentar los SLA de la spec 029 (Principio XIII).
 *
 * Ejercita endpoints representativos de cada clase de SLA con carga concurrente y, por cada uno,
 * calcula el p95 de dos maneras que se contrastan entre sí:
 *   1. del lado del cliente (latencia exacta medida con performance.now()), y
 *   2. del lado del servidor, a partir de los buckets del histograma `http_request_duration_seconds`
 *      de `GET /metrics` (es la misma medida contra la que se verificará el SLA; da una cota superior
 *      porque los buckets son discretos).
 * Después agrupa por clase, toma el PEOR p95 entre sus endpoints y propone un objetivo con la regla
 * "peor p95 × MARGIN, redondeado al próximo límite de bucket".
 *
 * IMPORTANTE: escribe datos (usuarios, alertas, órdenes, pesos de estrategias). Correrlo SOLO contra
 * una instancia con una base descartable, nunca contra la base de desarrollo. No toca los endpoints
 * de sincronización con terceros ni la simulación (clases `system-*`), que dependen de servicios
 * externos; el recálculo se ejecuta una vez como preparación (genera las notificaciones a leer).
 *
 * Uso:
 *   BASE_URL=http://localhost:3299 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/slo-baseline.mjs
 * Variables opcionales: CONCURRENCY (10), REQUESTS (200), MARGIN (2), OUT (ruta del JSON de salida).
 */
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const BASE = process.env.BASE_URL ?? 'http://localhost:3299';
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 10);
const REQUESTS = Number(process.env.REQUESTS ?? 200);
const MARGIN = Number(process.env.MARGIN ?? 2);
const OUT = process.env.OUT;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PASSWORD = 'Abcd1234!';
const RUN = Date.now().toString(36);

/** Límites del histograma y SLA declarados hoy (espejo de `request-metrics.ts` y `sla.ts`). */
const BUCKETS_S = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.3, 0.5, 0.6, 0.8, 1, 2.5, 5, 10];
const DECLARED_MS = { auth: 600, read: 300, 'read-computed': 800, write: 500, market: 800, ping: 100, technical: 250 };

async function call(method, path, { token, apiKey, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (apiKey) headers['x-api-key'] = apiKey;
  const start = performance.now();
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  const ms = performance.now() - start;
  let json;
  try { json = JSON.parse(text); } catch { json = undefined; }
  return { status: res.status, ms, json, text };
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

/** Ejecuta `total` tareas con `concurrency` en paralelo; `task(i)` devuelve { status, ms }. */
async function runPool(total, concurrency, task) {
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < total) {
        const i = next++;
        results.push(await task(i));
      }
    }),
  );
  return results;
}

async function scrape() {
  const res = await fetch(BASE + '/metrics');
  const samples = [];
  for (const line of (await res.text()).split('\n')) {
    const m = /^http_request_duration_seconds_bucket\{(.*)\}\s+(\S+)$/.exec(line.trim());
    if (!m) continue;
    const labels = Object.fromEntries([...m[1].matchAll(/(\w+)="((?:[^"\\]|\\.)*)"/g)].map((x) => [x[1], x[2]]));
    samples.push({ labels, value: Number(m[2]) });
  }
  return samples;
}

/** p95 de servidor (cota superior por bucket) de la serie method+route, restando una captura previa. */
function serverP95Ms(before, after, method, route) {
  const sum = (samples) => {
    const acc = new Map();
    for (const s of samples) {
      if (s.labels.method !== method || s.labels.route !== route) continue;
      acc.set(s.labels.le, (acc.get(s.labels.le) ?? 0) + s.value);
    }
    return acc;
  };
  const a = sum(after);
  const b = sum(before);
  const delta = (le) => (a.get(le) ?? 0) - (b.get(le) ?? 0);
  const total = delta('+Inf');
  if (total <= 0) return null;
  for (const bucket of BUCKETS_S) {
    if (delta(String(bucket)) >= 0.95 * total) return bucket * 1000;
  }
  return Infinity;
}

const report = [];

/** Mide un endpoint: calentamiento, carga medida y p95 de cliente y de servidor. */
async function measure({ cls, method, route, total = REQUESTS, concurrency = CONCURRENCY, build, warmup = 10 }) {
  await runPool(warmup, Math.min(concurrency, warmup), (i) => build(-1 - i));
  const before = await scrape();
  const results = await runPool(total, concurrency, (i) => build(i));
  const after = await scrape();
  const ok = results.filter((r) => r.status < 400).length;
  const server5xx = results.filter((r) => r.status >= 500).length;
  const row = {
    cls,
    endpoint: `${method} ${route}`,
    requests: results.length,
    ok,
    server5xx,
    clientP50: percentile(results.map((r) => r.ms), 50),
    clientP95: percentile(results.map((r) => r.ms), 95),
    clientMax: Math.max(...results.map((r) => r.ms)),
    serverP95: serverP95Ms(before, after, method, route),
  };
  report.push(row);
  console.log(
    `${cls.padEnd(14)} ${row.endpoint.padEnd(52)} ok ${String(ok).padStart(4)}/${row.requests}  5xx ${server5xx}  p50 ${row.clientP50.toFixed(1).padStart(7)}  p95 cliente ${row.clientP95.toFixed(1).padStart(7)}  p95 servidor ≤ ${row.serverP95}`,
  );
}

async function must(res, what) {
  if (res.status >= 400) throw new Error(`${what} falló: ${res.status} ${res.text.slice(0, 200)}`);
  return res.json;
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Faltan ADMIN_EMAIL y ADMIN_PASSWORD');
  console.log(`Base: ${BASE} | concurrencia ${CONCURRENCY} | ${REQUESTS} requests por endpoint | margen ×${MARGIN}\n`);

  // ── Preparación (no se mide): usuarios de prueba con token y API key, y datos del catálogo ──
  const users = [];
  for (let i = 0; i < 5; i++) {
    const email = `slo.${RUN}.${i}@slo.test`;
    await must(await call('POST', '/auth/register', { body: { email, password: PASSWORD, username: `slo_${RUN}_${i}` } }), 'register');
    const token = (await must(await call('POST', '/auth/login', { body: { email, password: PASSWORD } }), 'login')).accessToken;
    const apiKey = (await must(await call('POST', '/auth/api-key', { token }), 'api-key')).apiKey;
    const me = await must(await call('GET', '/auth/me', { token }), 'me');
    users.push({ email, token, apiKey, id: me.id ?? me.userId });
  }
  const adminToken = (await must(await call('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } }), 'admin login')).accessToken;
  const adminKey = (await must(await call('POST', '/auth/api-key', { token: adminToken }), 'admin api-key')).apiKey;

  // Usuario aparte, sólo para `PATCH /notifications/:id/read`: se le crean alertas que ya se cumplen
  // (precio > 0,01 o precio < 100000, para cualquier cotización) ANTES del recálculo, así éste las dispara
  // y deja una notificación por alerta. No se mezcla con `users` para no alterar las lecturas de arriba.
  const notifEmail = `slo.${RUN}.notif@slo.test`;
  await must(await call('POST', '/auth/register', { body: { email: notifEmail, password: PASSWORD, username: `slo_${RUN}_notif` } }), 'register notif');
  const notifToken = (await must(await call('POST', '/auth/login', { body: { email: notifEmail, password: PASSWORD } }), 'login notif')).accessToken;

  const list = await must(await call('GET', '/players?pageSize=50', { apiKey: users[0].apiKey }), 'players');
  const players = (list.items ?? list.data ?? list.players ?? list).map((p) => p.id);
  if (players.length === 0) throw new Error('El catálogo está vacío');
  console.log(`Catálogo: ${players.length} jugadores en la muestra. Recalculando cotizaciones (necesario para el ranking)...`);
  for (const playerId of players) {
    for (const [condition, targetValue] of [['PRICE_ABOVE', 0.01], ['PRICE_BELOW', 100000]]) {
      await must(await call('POST', '/alerts', { token: notifToken, body: { playerId, condition, targetValue } }), 'alerta para notificar');
    }
  }
  const recalc = await call('POST', '/quotes/recalculate', { apiKey: adminKey });
  console.log(`Recálculo: ${recalc.status} en ${(recalc.ms / 1000).toFixed(1)} s (clase system-long: sin objetivo de p95)\n`);

  const pick = (i) => players[Math.abs(i) % players.length];
  const user = (i) => users[Math.abs(i) % users.length];

  // ── Autenticación ──
  let regSeq = 0;
  await measure({ cls: 'auth', method: 'POST', route: '/auth/register', total: 40, concurrency: 5, warmup: 2,
    build: () => { const n = `${RUN}r${regSeq++}`; return call('POST', '/auth/register', { body: { email: `reg.${n}@slo.test`, password: PASSWORD, username: `reg_${n}` } }); } });
  await measure({ cls: 'auth', method: 'POST', route: '/auth/login', total: 100, concurrency: 5, warmup: 2,
    build: (i) => call('POST', '/auth/login', { body: { email: user(i).email, password: PASSWORD } }) });
  // Un usuario por request y sin concurrencia sobre el MISMO usuario: la rotación concurrente de la API
  // key de un mismo usuario viola `idx_api_keys_active_user` y responde 500 (hallazgo de la primera
  // corrida, ver specs/029-http-metrics-sla/spec.md → "Fundamento de los objetivos").
  await measure({ cls: 'auth', method: 'POST', route: '/auth/api-key', total: 40, concurrency: 1, warmup: 2,
    build: () => call('POST', '/auth/api-key', { token: user(4).token }) });
  users[4].apiKey = (await must(await call('POST', '/auth/api-key', { token: users[4].token }), 'api-key')).apiKey;

  // ── Lecturas simples ──
  const reads = [
    ['/auth/me', (i) => call('GET', '/auth/me', { token: user(i).token })],
    ['/players', (i) => call('GET', `/players?page=${(Math.abs(i) % 5) + 1}&pageSize=20`, { apiKey: user(i).apiKey })],
    ['/players/:id', (i) => call('GET', `/players/${pick(i)}`, { apiKey: user(i).apiKey })],
    ['/players/:id/quotes', (i) => call('GET', `/players/${pick(i)}/quotes`, { token: user(i).token })],
    ['/players/:id/order-book', (i) => call('GET', `/players/${pick(i)}/order-book`, { token: user(i).token })],
    ['/users/:id/portfolio', (i) => call('GET', `/users/${user(i).id}/portfolio`, { token: user(i).token })],
    ['/orders', (i) => call('GET', '/orders', { token: user(i).token })],
    ['/orders/history', (i) => call('GET', '/orders/history', { token: user(i).token })],
    ['/alerts', (i) => call('GET', '/alerts', { token: user(i).token })],
    ['/notifications', (i) => call('GET', '/notifications', { token: user(i).token })],
    ['/users/me/strategies', (i) => call('GET', '/users/me/strategies', { token: user(i).token })],
  ];
  for (const [route, build] of reads) await measure({ cls: 'read', method: 'GET', route, build });

  // ── Lecturas calculadas ──
  await measure({ cls: 'read-computed', method: 'GET', route: '/players/ranking', build: (i) => call('GET', '/players/ranking', { token: user(i).token }) });
  await measure({ cls: 'read-computed', method: 'GET', route: '/players/:id/valuation', build: (i) => call('GET', `/players/${pick(i)}/valuation`, { token: user(i).token }) });

  // ── Escrituras ──
  const alertIds = [];
  let alertSeq = 0;
  await measure({ cls: 'write', method: 'POST', route: '/alerts', total: 100, build: async (i) => {
    const u = user(i); const n = alertSeq++;
    const res = await call('POST', '/alerts', { token: u.token, body: { playerId: pick(n), condition: n % 2 ? 'PRICE_ABOVE' : 'PRICE_BELOW', targetValue: 1000 + n } });
    if (res.status === 201 && res.json?.id) alertIds.push({ id: res.json.id, token: u.token });
    return res;
  } });
  await measure({ cls: 'write', method: 'DELETE', route: '/alerts/:id', total: Math.min(alertIds.length, 100), warmup: 0,
    build: (i) => { const a = alertIds[i]; return call('DELETE', `/alerts/${a.id}`, { token: a.token }); } });
  await measure({ cls: 'write', method: 'PATCH', route: '/notifications/read-all', build: (i) => call('PATCH', '/notifications/read-all', { token: user(i).token }) });
  // Las notificaciones las generó el recálculo de la preparación; se leen una vez y cada request toma una distinta.
  const notifications = await must(await call('GET', '/notifications', { token: notifToken }), 'notificaciones');
  const notificationIds = (Array.isArray(notifications) ? notifications : notifications.items ?? []).map((n) => n.id);
  console.log(`Notificaciones disponibles para marcar como leídas: ${notificationIds.length}`);
  if (notificationIds.length > 0) {
    await measure({ cls: 'write', method: 'PATCH', route: '/notifications/:id/read', total: notificationIds.length, warmup: 0,
      build: (i) => call('PATCH', `/notifications/${notificationIds[i]}/read`, { token: notifToken }) });
  }
  const strategyIds = [];
  for (const u of users) strategyIds.push((await must(await call('GET', '/users/me/strategies', { token: u.token }), 'strategies')).strategies.map((s) => s.id));
  await measure({ cls: 'write', method: 'PATCH', route: '/users/me/strategies/:id/select', build: (i) => { const ids = strategyIds[Math.abs(i) % users.length]; return call('PATCH', `/users/me/strategies/${ids[Math.abs(i) % ids.length]}/select`, { token: user(i).token }); } });

  // Se reenvían los pesos que la estrategia ya tiene (válidos por construcción: suman 1 y usan métricas
  // reconocidas); el costo medido es el de la validación + el UPDATE. El perfil de posición reemplaza el
  // de FW por los pesos generales, que también son válidos como perfil.
  const strategies = [];
  for (const u of users) strategies.push((await must(await call('GET', '/users/me/strategies', { token: u.token }), 'strategies')).strategies);
  const ownStrategy = (i) => { const list = strategies[Math.abs(i) % users.length]; return list[Math.abs(i) % list.length]; };
  await measure({ cls: 'write', method: 'PATCH', route: '/users/me/strategies/:id/weights', build: (i) => { const st = ownStrategy(i); return call('PATCH', `/users/me/strategies/${st.id}/weights`, { token: user(i).token, body: { weights: st.weights } }); } });
  await measure({ cls: 'write', method: 'PATCH', route: '/users/me/strategies/:id/position-weights/:position', build: (i) => { const st = ownStrategy(i); return call('PATCH', `/users/me/strategies/${st.id}/position-weights/FW`, { token: user(i).token, body: { weights: st.weights } }); } });

  // ── Mercado: orden de compra seguida de su cancelación ──
  const orderIds = [];
  await measure({ cls: 'market', method: 'POST', route: '/orders', total: 100, build: async (i) => {
    const u = user(i);
    const res = await call('POST', '/orders', { token: u.token, body: { playerId: pick(i), side: 'BUY', quantity: 1 } });
    if (res.status === 201 && res.json?.id) orderIds.push({ id: res.json.id, token: u.token });
    return res;
  } });
  await measure({ cls: 'market', method: 'DELETE', route: '/orders/:id', total: orderIds.length, warmup: 0,
    build: (i) => { const o = orderIds[i]; return call('DELETE', `/orders/${o.id}`, { token: o.token }); } });

  // ── Técnicos ──
  await measure({ cls: 'ping', method: 'GET', route: '/', build: () => call('GET', '/') });
  for (const route of ['/health', '/metrics', '/info']) await measure({ cls: 'technical', method: 'GET', route, build: () => call('GET', route) });

  // ── Propuesta por clase ──
  const roundUp = (ms) => { const s = ms / 1000; const b = BUCKETS_S.find((x) => x >= s); return b === undefined ? null : Math.round(b * 1000); };
  const byClass = {};
  for (const r of report) (byClass[r.cls] ??= []).push(r);
  console.log('\nClase           peor p95 cliente  peor p95 servidor  objetivo hoy  propuesta (peor cliente ×' + MARGIN + ', al bucket)');
  const summary = [];
  for (const [cls, rows] of Object.entries(byClass)) {
    const worstClient = Math.max(...rows.map((r) => r.clientP95));
    const worstServer = Math.max(...rows.map((r) => r.serverP95 ?? 0));
    const proposal = roundUp(worstClient * MARGIN);
    const worst = rows.find((r) => r.clientP95 === worstClient).endpoint;
    summary.push({ cls, worstClient, worstServer, declared: DECLARED_MS[cls] ?? null, proposal, worst, errors5xx: rows.reduce((a, r) => a + r.server5xx, 0), requests: rows.reduce((a, r) => a + r.requests, 0) });
    console.log(`${cls.padEnd(15)} ${worstClient.toFixed(1).padStart(10)} ms  ${String(worstServer).padStart(10)} ms  ${String(DECLARED_MS[cls] ?? '—').padStart(9)} ms  ${proposal ?? '> 10 s'} ms   (peor: ${worst})`);
  }
  if (OUT) writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), base: BASE, concurrency: CONCURRENCY, requests: REQUESTS, margin: MARGIN, report, summary }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
