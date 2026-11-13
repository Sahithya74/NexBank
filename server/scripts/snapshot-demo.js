'use strict';

/**
 * Captures a read-only snapshot of the API for the static GitHub Pages demo.
 *
 *   npm run demo:snapshot        (the API must be running)
 *
 * For every active user it records the GET responses the client reads, with
 * paginated lists captured in full so the demo can filter, sort and page them
 * in the browser. Tokens are signed here rather than obtained by signing in,
 * so taking a snapshot does not add sign-in events to the data.
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { pool, query } = require('../config/db');

const API = `http://localhost:${config.port}/api`;
const OUTPUT = path.resolve(__dirname, '..', '..', 'client', 'src', 'demo', 'snapshot.json');

const PLAIN_ROUTES = [
  '/auth/me',
  '/accounts',
  '/accounts/summary',
  '/wallets',
  '/currencies',
  '/currencies/rates',
  '/transactions/filters',
  '/transactions/summary',
  '/transactions/analytics',
  '/beneficiaries',
  '/cards',
  '/bills',
  '/bills/billers',
  '/loans',
  '/loans/products',
  '/notifications/unread-count',
  '/admin/dashboard',
  '/admin/reports',
  '/admin/staff',
  '/admin/roles',
  '/audit-logs/actions',
];

const LIST_ROUTES = [
  '/accounts/all',
  '/wallets/all',
  '/wallets/conversions',
  '/wallets/transactions',
  '/transactions',
  '/transfers',
  '/bills/history',
  '/loans/all',
  '/notifications',
  '/admin/users',
  '/audit-logs',
];

async function call(token, route, params = {}) {
  const search = new URLSearchParams(params).toString();
  const response = await fetch(`${API}${route}${search ? `?${search}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = response.status === 204 ? null : await response.json();
  return { status: response.status, payload };
}

/** Fetches every page of a paginated list and stores it as one complete list. */
async function callAll(token, route) {
  const first = await call(token, route, { page: 1, limit: 100 });
  const data = first.payload?.data;
  if (first.status !== 200 || !data?.pagination) return first;

  const items = [...data.items];
  for (let page = 2; items.length < data.pagination.total; page += 1) {
    const next = await call(token, route, { page, limit: 100 });
    const nextItems = next.payload?.data?.items ?? [];
    if (next.status !== 200 || nextItems.length === 0) break;
    items.push(...nextItems);
  }

  return {
    status: 200,
    list: true,
    payload: { ...first.payload, data: { ...data, items, pagination: { page: 1, limit: items.length, total: items.length } } },
  };
}

const itemsOf = (entry) => {
  const data = entry?.status === 200 ? entry.payload?.data : null;
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
};

async function snapshotUser(user) {
  const token = jwt.sign({ sub: user.id, role: user.role_name, email: user.email }, config.auth.jwtSecret, {
    expiresIn: '10m',
  });
  const routes = {};

  for (const route of PLAIN_ROUTES) routes[route] = await call(token, route);
  for (const route of LIST_ROUTES) routes[route] = await callAll(token, route);

  for (const account of itemsOf(routes['/accounts'])) {
    routes[`/accounts/${account.id}`] = await call(token, `/accounts/${account.id}`);
    routes[`/accounts/${account.id}/statement`] = await callAll(token, `/accounts/${account.id}/statement`);
  }

  const loanIds = new Set([...itemsOf(routes['/loans']), ...itemsOf(routes['/loans/all'])].map((loan) => loan.id));
  for (const id of loanIds) routes[`/loans/${id}`] = await call(token, `/loans/${id}`);

  for (const row of itemsOf(routes['/admin/users'])) {
    routes[`/admin/users/${row.id}`] = await call(token, `/admin/users/${row.id}`);
  }

  return { token, routes };
}

async function run() {
  const health = await fetch(`${API}/health`).catch(() => null);
  if (!health?.ok) throw new Error(`The API is not reachable at ${API}. Start it with npm start first.`);

  const users = await query(
    `SELECT u.id, u.email, r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.status = 'active'
      ORDER BY u.id`,
  );

  const snapshot = { capturedAt: new Date().toISOString(), password: config.seedPassword, logins: {}, users: {}, quotes: {} };
  let quoteToken = null;

  for (const user of users) {
    process.stdout.write(`[nexbank] capturing ${user.email}... `);
    const { token, routes } = await snapshotUser(user);
    snapshot.logins[user.email.toLowerCase()] = user.id;
    snapshot.users[user.id] = routes;
    quoteToken = quoteToken || token;
    process.stdout.write(`${Object.keys(routes).length} routes\n`);
  }

  const currencies = itemsOf(snapshot.users[users[0].id]['/currencies']).filter((c) => c.is_active);
  for (const from of currencies) {
    for (const to of currencies) {
      if (from.code === to.code) continue;
      const { payload } = await call(quoteToken, '/currencies/quote', { from: from.code, to: to.code, amount: 1 });
      snapshot.quotes[`${from.code}:${to.code}`] = {
        rate: payload.data.rate,
        fromSymbol: payload.data.fromSymbol,
        toSymbol: payload.data.toSymbol,
        fromDecimals: from.decimals,
        toDecimals: to.decimals,
      };
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(snapshot));
  console.log(`[nexbank] wrote ${path.relative(process.cwd(), OUTPUT)} (${(fs.statSync(OUTPUT).size / 1024).toFixed(0)} KB)`);
}

run()
  .catch((error) => {
    console.error(`[nexbank] snapshot failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
