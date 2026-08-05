/** Shared value formatting, so every screen renders a number the same way. */

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const currencyCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const EMPTY = '—';

export function money(value, { compact = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return EMPTY;
  // Compact form keeps six-figure revenue from blowing out a stat tile.
  return compact && Math.abs(n) >= 10_000 ? currencyCompact.format(n) : currency.format(n);
}

export function num(value, { decimals } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return EMPTY;
  if (decimals != null) return n.toFixed(decimals);
  return Number.isInteger(n) ? integer.format(n) : decimal.format(n);
}

export function percent(value, { decimals = 1, signed = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return EMPTY;
  const sign = signed && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals)}%`;
}

export function date(value, { withTime = false } = {}) {
  if (!value) return EMPTY;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

export function shortDate(value) {
  if (!value) return EMPTY;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "3 minutes ago" — used for data-freshness pills. */
export function relativeTime(value) {
  if (!value) return EMPTY;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return EMPTY;

  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 45) return 'just now';

  const units = [
    { limit: 3600, div: 60, name: 'minute' },
    { limit: 86400, div: 3600, name: 'hour' },
    { limit: 604800, div: 86400, name: 'day' },
    { limit: 2629800, div: 604800, name: 'week' },
    { limit: Infinity, div: 2629800, name: 'month' },
  ];
  for (const unit of units) {
    if (seconds < unit.limit) {
      const value = Math.round(seconds / unit.div);
      return `${value} ${unit.name}${value === 1 ? '' : 's'} ago`;
    }
  }
  return EMPTY;
}

/** ML artifacts key products in lowercase; screens should not shout it back. */
export function titleCase(value) {
  return String(value || '')
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function initials(nameOrEmail) {
  const source = String(nameOrEmail || '').trim();
  if (!source) return '?';
  const namePart = source.includes('@') ? source.split('@')[0] : source;
  const words = namePart.split(/[\s._-]+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function toCsv(headers, rows) {
  const escape = (value) => {
    const s = value == null ? '' : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
}
