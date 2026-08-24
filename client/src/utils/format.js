/** Formatting helpers shared across the app. */

const CURRENCY_DECIMALS = { JPY: 0 };

/** Format a decimal string as money. Amounts arrive as strings and stay exact. */
export function formatMoney(amount, currency = 'INR', { symbol = true, compact = false } = {}) {
  const value = Number(amount ?? 0);
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;

  if (compact && Math.abs(value) >= 100000) {
    const formatter = new Intl.NumberFormat('en-IN', {
      notation: 'compact',
      maximumFractionDigits: 1,
    });
    return `${symbol ? currencySymbol(currency) : ''}${formatter.format(value)}`;
  }

  const formatted = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

  return symbol ? `${currencySymbol(currency)}${formatted}` : formatted;
}

const SYMBOLS = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥', AED: 'د.إ',
};

export function currencySymbol(code) {
  return SYMBOLS[code] || `${code} `;
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value ?? 0));
}

export function formatDate(value, { withTime = false } = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/** "2 hours ago" style label for notification and activity feeds. */
export function formatRelative(value) {
  if (!value) return '';
  const date = new Date(value);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, secondsInUnit] of units) {
    const amount = Math.floor(seconds / secondsInUnit);
    if (amount >= 1) return `${amount} ${unit}${amount > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

/** transfer_out -> Transfer out */
export function humanise(value) {
  if (!value) return '';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/^\w/, (char) => char.toUpperCase());
}

export function initials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

/** Maps a domain status onto the shared badge variants. */
export function statusVariant(status) {
  switch (status) {
    case 'completed':
    case 'active':
    case 'paid':
    case 'success':
    case 'approved':
      return 'success';
    case 'pending':
    case 'under_review':
    case 'applied':
    case 'overdue':
      return 'warning';
    case 'failed':
    case 'rejected':
    case 'blocked':
    case 'suspended':
    case 'frozen':
    case 'failure':
      return 'danger';
    case 'cancelled':
    case 'closed':
    case 'expired':
      return 'neutral';
    default:
      return 'info';
  }
}
