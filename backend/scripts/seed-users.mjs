/**
 * seed-users.mjs — registra 20 usuarios y ejecuta 10 operaciones de compra/venta.
 * Uso: node scripts/seed-users.mjs [BASE_URL]
 * Por defecto apunta a http://localhost:3000
 */

const BASE = process.argv[2] ?? 'http://localhost:3000';

// ── 20 Usuarios ──────────────────────────────────────────────────────────────
const USERS = [
  { username: 'futval_ana',      email: 'ana.garcia@futval.io',      password: 'Futval123!' },
  { username: 'futval_bruno',    email: 'bruno.lopez@futval.io',     password: 'Futval123!' },
  { username: 'futval_camila',   email: 'camila.ruiz@futval.io',     password: 'Futval123!' },
  { username: 'futval_diego',    email: 'diego.martin@futval.io',    password: 'Futval123!' },
  { username: 'futval_elena',    email: 'elena.sanchez@futval.io',   password: 'Futval123!' },
  { username: 'futval_fede',     email: 'federico.gomez@futval.io',  password: 'Futval123!' },
  { username: 'futval_gabi',     email: 'gabriela.perez@futval.io',  password: 'Futval123!' },
  { username: 'futval_hernan',   email: 'hernan.diaz@futval.io',     password: 'Futval123!' },
  { username: 'futval_ines',     email: 'ines.torres@futval.io',     password: 'Futval123!' },
  { username: 'futval_julian',   email: 'julian.vargas@futval.io',   password: 'Futval123!' },
  { username: 'futval_karina',   email: 'karina.flores@futval.io',   password: 'Futval123!' },
  { username: 'futval_leo',      email: 'leonardo.silva@futval.io',  password: 'Futval123!' },
  { username: 'futval_marta',    email: 'marta.ibarra@futval.io',    password: 'Futval123!' },
  { username: 'futval_nico',     email: 'nicolas.ramos@futval.io',   password: 'Futval123!' },
  { username: 'futval_oriana',   email: 'oriana.medina@futval.io',   password: 'Futval123!' },
  { username: 'futval_pablo',    email: 'pablo.castro@futval.io',    password: 'Futval123!' },
  { username: 'futval_quino',    email: 'quintin.mora@futval.io',    password: 'Futval123!' },
  { username: 'futval_romina',   email: 'romina.vega@futval.io',     password: 'Futval123!' },
  { username: 'futval_sergio',   email: 'sergio.nunez@futval.io',    password: 'Futval123!' },
  { username: 'futval_tania',    email: 'tania.acosta@futval.io',    password: 'Futval123!' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const post = (path, body, token) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

const get = (path, token) =>
  fetch(`${BASE}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

const ok = (label, res) => {
  const mark = res.ok ? '✓' : '✗';
  console.log(`  ${mark} [${res.status}] ${label}`);
  return res.ok;
};

// ── 1. Registrar usuarios ─────────────────────────────────────────────────────
console.log('\n▶ Registrando 20 usuarios...');
const registered = [];
for (const u of USERS) {
  const res = await post('/auth/register', u);
  if (res.status === 201 || res.status === 200) {
    ok(`Registro: ${u.username}`, res);
    registered.push(u);
  } else if (res.status === 409) {
    console.log(`  ~ [409] Ya existe: ${u.username}`);
    registered.push(u); // ya existía, igual podemos loguearnos
  } else {
    ok(`Registro: ${u.username}`, res);
  }
}

// ── 2. Login y obtención de tokens JWT ───────────────────────────────────────
console.log('\n▶ Iniciando sesión...');
const sessions = {}; // username → { token, userId }
for (const u of registered) {
  const res = await post('/auth/login', { email: u.email, password: u.password });
  if (!res.ok) { ok(`Login: ${u.username}`, res); continue; }
  const body = await res.json();
  sessions[u.username] = { token: body.accessToken };
  ok(`Login: ${u.username}`, res);
}

// ── 3. Obtener ID del primer jugador del catálogo ────────────────────────────
console.log('\n▶ Obteniendo catálogo de jugadores...');
const firstToken = Object.values(sessions)[0]?.token;
if (!firstToken) { console.error('Sin sesiones válidas. Abortando.'); process.exit(1); }

const catalogRes = await get('/players?page=1&pageSize=5', firstToken);
const catalog = await catalogRes.json();
const players = catalog.data ?? [];
if (players.length === 0) { console.error('Catálogo vacío. Sincronizá jugadores primero.'); process.exit(1); }

const [p1, p2, p3] = players;
console.log(`  Jugadores disponibles: ${players.map(p => p.name).join(', ')}`);

// ── 4. Operaciones ────────────────────────────────────────────────────────────
// 7 compras primero (necesarias para poder vender después)
// 3 ventas (usuarios que ya compraron)
const OPERATIONS = [
  { user: 'futval_ana',    side: 'BUY',  player: p1, qty: 5  },
  { user: 'futval_bruno',  side: 'BUY',  player: p1, qty: 3  },
  { user: 'futval_camila', side: 'BUY',  player: p2, qty: 8  },
  { user: 'futval_diego',  side: 'BUY',  player: p2, qty: 2  },
  { user: 'futval_elena',  side: 'BUY',  player: p3 ?? p1, qty: 4  },
  { user: 'futval_fede',   side: 'BUY',  player: p1, qty: 6  },
  { user: 'futval_gabi',   side: 'BUY',  player: p3 ?? p2, qty: 10 },
  // Ventas: solo usuarios que compraron el mismo jugador
  { user: 'futval_ana',    side: 'SELL', player: p1, qty: 2  },
  { user: 'futval_bruno',  side: 'SELL', player: p1, qty: 1  },
  { user: 'futval_camila', side: 'SELL', player: p2, qty: 3  },
];

console.log('\n▶ Ejecutando 10 operaciones...');
for (const op of OPERATIONS) {
  const session = sessions[op.user];
  if (!session) { console.log(`  ~ Sin sesión para ${op.user}, saltando`); continue; }

  const res = await post('/orders', { side: op.side, playerId: op.player.id, quantity: op.qty }, session.token);
  const body = res.ok ? await res.json() : await res.text();
  const label = `${op.side.padEnd(4)} ${String(op.qty).padStart(2)} token(s) de ${op.player.name} (${op.user})`;
  ok(label, res);
  if (!res.ok) console.log(`     → ${JSON.stringify(body)}`);
}

console.log('\n✅ Seed completado.\n');
