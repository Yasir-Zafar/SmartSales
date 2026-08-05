import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Shared chart chrome.
 *
 * Grid and axes are deliberately recessive — a hairline grid, muted tick text,
 * no chart junk — so the data marks are the only thing with weight. Everything
 * here is plain SVG; the app ships no charting library.
 */

export const SERIES = ['rgb(var(--series-1))', 'rgb(var(--series-2))', 'rgb(var(--series-3))'];

/** Ordinal ramp for ordered tiers (RFM segments, stock bands). */
export const ORDINAL = [
  'var(--ordinal-1)',
  'var(--ordinal-2)',
  'var(--ordinal-3)',
  'var(--ordinal-4)',
  'var(--ordinal-5)',
];

/** Measures its container so charts fill whatever space they are given. */
export function useChartSize(ref, { height = 240 } = {}) {
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect?.width;
      // Compare inside the updater so `width` stays out of the effect deps —
      // otherwise every resize tears down and re-creates the observer.
      if (next) setWidth((current) => (Math.abs(next - current) > 1 ? next : current));
    });
    observer.observe(element);
    setWidth(element.clientWidth || 640);
    return () => observer.disconnect();
  }, [ref]);

  return { width, height };
}

/**
 * Produces round axis ticks (10, 20, 50, 100…) rather than raw data extremes,
 * so the gridlines land on numbers a person would actually choose.
 */
export function niceScale(max, tickCount = 4) {
  if (!Number.isFinite(max) || max <= 0) return { max: 1, ticks: [0, 1] };

  const roughStep = max / tickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  const step = (normalized >= 5 ? 10 : normalized >= 2 ? 5 : normalized >= 1 ? 2 : 1) * magnitude;

  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let value = 0; value <= niceMax + step / 2; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }
  return { max: niceMax || 1, ticks };
}

export function GridLines({ ticks, max, width, height, padding }) {
  return (
    <g aria-hidden="true">
      {ticks.map((tick) => {
        const y = padding.top + (1 - tick / max) * (height - padding.top - padding.bottom);
        return (
          <line
            key={tick}
            x1={padding.left}
            x2={width - padding.right}
            y1={y}
            y2={y}
            stroke="rgb(var(--hairline) / 0.08)"
            strokeWidth="1"
          />
        );
      })}
    </g>
  );
}

export function YAxis({ ticks, max, height, padding, format = (v) => v }) {
  return (
    <g aria-hidden="true">
      {ticks.map((tick) => {
        const y = padding.top + (1 - tick / max) * (height - padding.top - padding.bottom);
        return (
          <text
            key={tick}
            x={padding.left - 8}
            y={y + 3.5}
            textAnchor="end"
            className="fill-[rgb(var(--ink-faint))] text-[10px] tabular"
          >
            {format(tick)}
          </text>
        );
      })}
    </g>
  );
}

/** Floating tooltip. Flips sides near the right edge so it never clips. */
export function ChartTooltip({ x, y, containerWidth, children, visible }) {
  const flip = x > containerWidth - 150;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.14 }}
          className="pointer-events-none absolute z-20 min-w-[8.5rem] rounded-xl border border-hairline/12 bg-panel/97 p-2.5 shadow-lift backdrop-blur"
          style={{
            left: flip ? undefined : x + 12,
            right: flip ? containerWidth - x + 12 : undefined,
            top: Math.max(4, y - 18),
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Tracks the pointer over the plot area and reports the nearest data index. */
export function usePointerIndex({ count, width, padding }) {
  const [index, setIndex] = useState(null);

  const onMove = useCallback(
    (event) => {
      if (!count) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const plotWidth = width - padding.left - padding.right;
      const ratio = (x - padding.left) / plotWidth;
      const next = Math.round(ratio * (count - 1));
      setIndex(Math.max(0, Math.min(count - 1, next)));
    },
    [count, width, padding]
  );

  const onLeave = useCallback(() => setIndex(null), []);

  return { index, onMove, onLeave };
}

/**
 * Legend. Present whenever there are two or more series — identity must never
 * be carried by colour alone.
 */
export function Legend({ items, className = '' }) {
  if (!items || items.length < 2) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
          <span
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ background: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export default GridLines;
