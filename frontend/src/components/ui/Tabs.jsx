import React from 'react';
import { motion } from 'framer-motion';
import { softSpring } from '../../lib/motion';

/**
 * Tabs.
 *
 * The redesign folds twenty flat pages into eight sections with tabs, so this
 * is load-bearing navigation rather than decoration. The active indicator is a
 * single element shared across tabs via layoutId, so it glides instead of
 * blinking between positions.
 */

export function Tabs({ tabs, value, onChange, className = '', layoutId = 'tab-indicator' }) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={`flex flex-wrap items-center gap-1 rounded-2xl border border-hairline/10 bg-panel/70 p-1 backdrop-blur ${className}`}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={[
              'relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-colors duration-200',
              active ? 'text-ink' : 'text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={softSpring}
                className="absolute inset-0 rounded-xl bg-honey/14 ring-1 ring-inset ring-honey/25"
              />
            )}
            <span className="relative flex items-center gap-2">
              {tab.icon && <tab.icon size={14} aria-hidden="true" />}
              {tab.label}
              {tab.count != null && (
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums ${
                    active ? 'bg-honey/20 text-honey' : 'bg-hairline/10 text-ink-faint'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Compact two-to-four-option switch for filters (All / High / Medium / Low). */
export function SegmentedControl({ options, value, onChange, size = 'sm', className = '', layoutId }) {
  const id = layoutId || `segmented-${options.map((o) => o.value).join('-')}`;
  const padding = size === 'xs' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12px]';

  return (
    <div className={`inline-flex items-center gap-0.5 rounded-xl border border-hairline/10 bg-sunken/60 p-0.5 ${className}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={[
              'relative rounded-[10px] font-medium transition-colors duration-200',
              padding,
              active ? 'text-ink' : 'text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {active && (
              <motion.span
                layoutId={id}
                transition={softSpring}
                className="absolute inset-0 rounded-[10px] bg-panel shadow-card"
              />
            )}
            <span className="relative whitespace-nowrap">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
