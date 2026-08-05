import React from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, CircleSlash, Circle, Minus } from 'lucide-react';

/**
 * Badges and status chips.
 *
 * Status colour is never the only signal: every chip that means something
 * ships with an icon *and* a word, so it still reads under colour-vision
 * deficiency, in greyscale print and in forced-colors mode.
 */

const TONES = {
  neutral: 'bg-hairline/8 text-ink-soft border-hairline/12',
  honey: 'bg-honey/12 text-honey border-honey/28',
  good: 'bg-good/12 text-good border-good/30',
  warning: 'bg-warn/14 text-warn border-warn/32',
  serious: 'bg-serious/14 text-serious border-serious/32',
  critical: 'bg-critical/12 text-critical border-critical/32',
  series1: 'bg-series-1/12 text-series-1 border-series-1/28',
  series2: 'bg-series-2/12 text-series-2 border-series-2/28',
  series3: 'bg-series-3/12 text-series-3 border-series-3/28',
};

export function Badge({ children, tone = 'neutral', icon: Icon, size = 'sm', className = '' }) {
  const sizing = size === 'xs' ? 'px-1.5 py-0.5 text-[10px] gap-1' : 'px-2 py-0.5 text-[11px] gap-1.5';
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border font-semibold tracking-wide',
        sizing,
        TONES[tone] || TONES.neutral,
        className,
      ].join(' ')}
    >
      {Icon && <Icon size={size === 'xs' ? 10 : 11} aria-hidden="true" />}
      {children}
    </span>
  );
}

// ── Anomaly severity ─────────────────────────────────────────────────────────
// The backend classifies drops as low / medium / high against the owner's
// threshold; "none" means the product was checked and is fine.
const SEVERITY = {
  high: { tone: 'critical', icon: AlertOctagon, label: 'High' },
  medium: { tone: 'serious', icon: AlertTriangle, label: 'Medium' },
  low: { tone: 'warning', icon: AlertTriangle, label: 'Low' },
  none: { tone: 'good', icon: CheckCircle2, label: 'Normal' },
};

export function SeverityChip({ severity, size = 'sm' }) {
  const key = String(severity || 'none').toLowerCase();
  const config = SEVERITY[key] || { tone: 'neutral', icon: Circle, label: severity || 'Unknown' };
  return (
    <Badge tone={config.tone} icon={config.icon} size={size}>
      {config.label}
    </Badge>
  );
}

// ── Inventory stock bands ────────────────────────────────────────────────────
// Five bands mapped onto the four reserved status roles; "Depleted" is the
// strongest and gets a solid treatment so it cannot be mistaken for "Urgent".
export const STOCK_OK_MIN = 10;

export function stockBand(quantity) {
  const n = Number(quantity);
  if (!Number.isFinite(n)) return { key: 'unknown', label: 'Unknown', tone: 'neutral', icon: Minus };
  const q = Math.max(0, Math.floor(n));
  if (q >= STOCK_OK_MIN) return { key: 'ok', label: 'In stock', tone: 'good', icon: CheckCircle2 };
  if (q >= 7) return { key: 'watch', label: 'Watch', tone: 'warning', icon: AlertTriangle };
  if (q >= 4) return { key: 'low', label: 'Low', tone: 'serious', icon: AlertTriangle };
  if (q >= 1) return { key: 'urgent', label: 'Urgent', tone: 'critical', icon: AlertOctagon };
  return { key: 'depleted', label: 'Out of stock', tone: 'critical', icon: CircleSlash, solid: true };
}

export function StockChip({ quantity, size = 'sm' }) {
  const band = stockBand(quantity);
  if (band.solid) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-critical px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white">
        <band.icon size={11} aria-hidden="true" />
        {band.label}
      </span>
    );
  }
  return (
    <Badge tone={band.tone} icon={band.icon} size={size}>
      {band.label}
    </Badge>
  );
}

// ── Roles ────────────────────────────────────────────────────────────────────
const ROLE_TONES = {
  OWNER: 'honey',
  ADMIN: 'series2',
  ANALYST: 'series1',
  STAFF: 'series3',
};

export function RoleBadge({ role, size = 'sm' }) {
  return (
    <Badge tone={ROLE_TONES[role] || 'neutral'} size={size}>
      {role || 'UNKNOWN'}
    </Badge>
  );
}

/** A small dot + label used for live/idle indicators. */
export function LiveDot({ active = true, label, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[11px] text-ink-muted ${className}`}>
      <span className="relative flex h-1.5 w-1.5">
        {active && (
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-good" />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${active ? 'bg-good' : 'bg-ink-faint'}`} />
      </span>
      {label}
    </span>
  );
}

export default Badge;
