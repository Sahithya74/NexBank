/**
 * In-browser stand-in for the API, used only by the static GitHub Pages demo
 * (vite build --mode pages). It answers from a snapshot of the real API taken
 * with `npm run demo:snapshot`: lists are stored whole and filtered, sorted and
 * paged here; anything that would change data is refused as read-only.
 *
 * Responses use the same { status, payload } envelope the server sends, so the
 * rest of the client handles them exactly like real ones.
 */

import snapshot from '../demo/snapshot.json';

const TOKEN_PREFIX = 'demo.';
const PAGING_KEYS = new Set(['page', 'limit', 'sortBy', 'sortDir']);
const DATE_FIELDS = ['date', 'created_at', 'createdAt', 'appliedAt', 'paid_at', 'paidAt', 'openedAt'];
const FIELD_ALIASES = {
  currency: ['currency', 'currency_code', 'from_currency'],
  userId: ['userId', 'user_id'],
};

const READ_ONLY_MESSAGE =
  'This is a read-only demo, so changes are switched off. Run NexBank locally to make transfers, payments and other changes.';

const ok = (data) => ({ status: 200, payload: { success: true, data, message: '' } });
const fail = (status, code, message) => ({ status, payload: { success: false, error: { code, message } } });
const readOnly = () => fail(403, 'DEMO_READ_ONLY', READ_ONLY_MESSAGE);

const toSnake = (key) => key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
const toCamel = (key) => key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());

function fieldFor(item, key) {
  const candidates = FIELD_ALIASES[key] ?? [key, toSnake(key), toCamel(key)];
  return candidates.find((field) => field in item);
}

function dateOf(item) {
  const field = DATE_FIELDS.find((name) => item[name]);
  return field ? String(item[field]).slice(0, 10) : null;
}

function matches(item, key, value) {
  const wanted = String(value).toLowerCase();

  if (key === 'q') {
    return Object.values(item).some(
      (entry) => (typeof entry === 'string' || typeof entry === 'number') && String(entry).toLowerCase().includes(wanted),
    );
  }
  if (key === 'from' || key === 'to') {
    const day = dateOf(item);
    if (!day) return true;
    return key === 'from' ? day >= value : day <= value;
  }
  if (key === 'minAmount') return Number(item.amount) >= Number(value);
  if (key === 'maxAmount') return Number(item.amount) <= Number(value);
  if (key === 'status' && !('status' in item) && 'is_read' in item) {
    return wanted === 'read' ? Boolean(item.is_read) : !item.is_read;
  }

  const field = fieldFor(item, key);
  return field === undefined || String(item[field]).toLowerCase() === wanted;
}

function compareBy(key) {
  return (a, b) => {
    const field = fieldFor(a, key) ?? (/date|created/i.test(key) ? DATE_FIELDS.find((name) => name in a) : undefined);
    if (!field) return 0;
    const left = a[field];
    const right = b[field];
    const bothNumeric = left !== null && right !== null && left !== '' && right !== ''
      && !Number.isNaN(Number(left)) && !Number.isNaN(Number(right));
    return bothNumeric ? Number(left) - Number(right) : String(left ?? '').localeCompare(String(right ?? ''));
  };
}

/** Applies the server's list contract (filters, sort, page/limit) to a full list. */
function listView(data, params = {}) {
  let items = data.items.filter((item) =>
    Object.entries(params).every(([key, value]) => PAGING_KEYS.has(key) || value === undefined || value === '' || matches(item, key, value)),
  );

  if (params.sortBy) {
    const direction = String(params.sortDir).toLowerCase() === 'asc' ? 1 : -1;
    items = [...items].sort((a, b) => compareBy(params.sortBy)(a, b) * direction);
  }

  const page = Math.max(1, Number.parseInt(params.page, 10) || 1);
  const limit = Math.min(Math.max(1, Number.parseInt(params.limit, 10) || 10), 100);
  return {
    ...data,
    items: items.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total: items.length },
  };
}

function sessionUser(token) {
  if (!token?.startsWith(TOKEN_PREFIX)) return null;
  const id = token.slice(TOKEN_PREFIX.length);
  return snapshot.users[id] ? id : null;
}

function login({ email = '', password = '' } = {}) {
  const id = snapshot.logins[String(email).trim().toLowerCase()];
  if (!id || password !== snapshot.password) {
    return fail(401, 'INVALID_CREDENTIALS', 'The email or password you entered is incorrect.');
  }
  return ok({ token: `${TOKEN_PREFIX}${id}`, user: snapshot.users[id]['/auth/me'].payload.data });
}

function conversionQuote({ from, to, amount } = {}) {
  const quote = snapshot.quotes[`${from}:${to}`];
  if (!quote) return fail(400, 'UNSUPPORTED_CURRENCY', 'Choose two different supported currencies.');
  const value = Number(amount);
  if (!(value > 0)) return fail(400, 'VALIDATION_ERROR', 'Enter an amount greater than zero.');

  const normalised = value.toFixed(quote.fromDecimals);
  return ok({
    from,
    to,
    rate: quote.rate,
    amount: normalised,
    convertedAmount: (Number(normalised) * Number(quote.rate)).toFixed(quote.toDecimals),
    fromSymbol: quote.fromSymbol,
    toSymbol: quote.toSymbol,
  });
}

/** Same reducing-balance EMI formula as the server's loan service. */
function loanQuote({ amount, interestRate, tenureMonths } = {}) {
  const principal = Number(amount);
  const months = Number(tenureMonths);
  const monthlyRate = Number(interestRate) / 12 / 100;
  if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(months) || months <= 0) {
    return fail(400, 'INVALID_LOAN_TERMS', 'Enter a valid loan amount and tenure.');
  }

  const factor = (1 + monthlyRate) ** months;
  const emi = monthlyRate === 0 ? (principal / months).toFixed(2) : ((principal * monthlyRate * factor) / (factor - 1)).toFixed(2);
  const totalPayable = (Number(emi) * months).toFixed(2);
  return ok({
    principal: String(amount),
    interestRate: String(interestRate),
    tenureMonths: months,
    emi,
    totalPayable,
    totalInterest: (Number(totalPayable) - principal).toFixed(2),
  });
}

export async function respond(method, path, { body, params, token } = {}) {
  if (method === 'POST' && path === '/auth/login') return login(body);
  if (method === 'POST' && path === '/auth/logout') return ok(null);

  const userId = sessionUser(token);
  if (!userId) return fail(401, 'UNAUTHORIZED', 'Please sign in to continue.');
  if (method !== 'GET') return readOnly();

  if (path === '/wallets/quote' || path === '/currencies/quote') return conversionQuote(params);
  if (path === '/loans/quote') return loanQuote(params);
  if (path === '/beneficiaries/verify' || /^\/accounts\/\d+\/number$/.test(path)) return readOnly();

  const entry = snapshot.users[userId][path];
  if (!entry) return fail(404, 'NOT_FOUND', 'This view is not part of the demo.');
  if (!entry.list) return { status: entry.status, payload: entry.payload };
  return ok(listView(entry.payload.data, params));
}
