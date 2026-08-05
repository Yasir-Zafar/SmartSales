import React, { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChartTooltip, GridLines, SERIES, YAxis, niceScale, useChartSize } from './ChartFrame';

/**
 * Bar charts.
 *
 * Nominal categories (product names, days) are one series in a single hue —
 * colouring each bar differently would spend the identity channel re-encoding
 * what bar length already says. Data-ends are rounded 4px and anchored to the
 * baseline; adjacent bars keep a 2px surface gap.
 */

const BASE_PADDING = { top: 14, right: 12, bottom: 34, left: 46 };

/** Same gutter rule as LineArea — reserve width from the widest tick label. */
function gutterFor(ticks, formatY) {
  const widest = ticks.reduce((max, tick) => Math.max(max, String(formatY(tick)).length), 0);
  return Math.min(96, Math.max(38, widest * 6.4 + 14));
}

export function VerticalBars({
  data,
  height = 250,
  color = SERIES[0],
  formatY = (v) => v,
  formatValue = (v) => v,
  className = '',
  ariaLabel = 'Bar chart',
}) {
  const containerRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const { width } = useChartSize(containerRef, { height });
  const [hovered, setHovered] = useState(null);

  const rows = data || [];
  const { max, ticks } = niceScale(Math.max(...rows.map((d) => Number(d.value) || 0), 0));
  const PADDING = { ...BASE_PADDING, left: gutterFor(ticks, formatY) };

  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const slot = rows.length ? plotWidth / rows.length : 0;
  // 2px of surface between neighbours, and never a hairline-thin bar.
  const barWidth = Math.max(4, Math.min(46, slot - 6));

  return (
    <div className={className}>
      <div ref={containerRef} className="relative w-full" style={{ height }}>
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <GridLines ticks={ticks} max={max} width={width} height={height} padding={PADDING} />
          <YAxis ticks={ticks} max={max} height={height} padding={PADDING} format={formatY} />

          <line
            x1={PADDING.left}
            x2={width - PADDING.right}
            y1={height - PADDING.bottom}
            y2={height - PADDING.bottom}
            stroke="rgb(var(--hairline) / 0.16)"
            strokeWidth="1"
          />

          {rows.map((row, index) => {
            const value = Number(row.value) || 0;
            const barHeight = Math.max(2, (value / max) * plotHeight);
            const x = PADDING.left + index * slot + (slot - barWidth) / 2;
            const y = height - PADDING.bottom - barHeight;
            const active = hovered === index;

            return (
              <g key={row.label ?? index}>
                {/* Full-height hit target: hovering a 4px bar is miserable. */}
                <rect
                  x={PADDING.left + index * slot}
                  y={PADDING.top}
                  width={slot}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                />
                <motion.rect
                  x={x}
                  width={barWidth}
                  rx="4"
                  fill={row.color || color}
                  opacity={hovered == null || active ? 1 : 0.42}
                  initial={reduceMotion ? false : { height: 0, y: height - PADDING.bottom }}
                  animate={{ height: barHeight, y }}
                  transition={{ duration: 0.6, delay: Math.min(index * 0.03, 0.4), ease: [0.22, 1, 0.36, 1] }}
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            );
          })}

          {/* Label every bar only when they comfortably fit; otherwise every
              other one, so the axis never turns into a smear. */}
          {rows.map((row, index) => {
            const showLabel = rows.length <= 8 || index % Math.ceil(rows.length / 8) === 0;
            if (!showLabel) return null;
            return (
              <text
                key={`label-${row.label ?? index}`}
                x={PADDING.left + index * slot + slot / 2}
                y={height - 14}
                textAnchor="middle"
                className="fill-[rgb(var(--ink-faint))] text-[10px]"
              >
                {truncate(row.shortLabel || row.label, 10)}
              </text>
            );
          })}
        </svg>

        {hovered != null && rows[hovered] && (
          <ChartTooltip
            x={PADDING.left + hovered * slot + slot / 2}
            y={height - PADDING.bottom - (Number(rows[hovered].value) / max) * plotHeight}
            containerWidth={width}
            visible
          >
            <p className="max-w-[12rem] break-words text-[11.5px] font-medium text-ink">{rows[hovered].label}</p>
            <p className="mt-1 text-[14px] font-semibold text-ink tabular">
              {formatValue(rows[hovered].value)}
            </p>
            {rows[hovered].meta && <p className="mt-0.5 text-[11px] text-ink-muted">{rows[hovered].meta}</p>}
          </ChartTooltip>
        )}
      </div>
    </div>
  );
}

/**
 * Horizontal bars — the right form for ranked lists with long names, because
 * the label sits on a readable horizontal baseline instead of rotated 90°.
 */
export function HorizontalBars({
  data,
  formatValue = (v) => v,
  color = SERIES[0],
  className = '',
  maxRows = 10,
  ariaLabel = 'Ranked bar chart',
}) {
  const reduceMotion = useReducedMotion();
  const rows = (data || []).slice(0, maxRows);
  const max = Math.max(...rows.map((d) => Number(d.value) || 0), 1);

  return (
    <ul className={`space-y-2.5 ${className}`} aria-label={ariaLabel}>
      {rows.map((row, index) => {
        const value = Number(row.value) || 0;
        const width = Math.max(1.5, (value / max) * 100);

        return (
          <li key={row.label ?? index} className="group">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-[12.5px] text-ink-soft" title={row.label}>
                {row.label}
              </span>
              {/* Direct labels: the value is always readable without hovering. */}
              <span className="shrink-0 text-[12.5px] font-semibold text-ink tabular">
                {formatValue(value)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-hairline/8">
              <motion.div
                className="h-full rounded-full"
                style={{ background: row.color || color }}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.7, delay: Math.min(index * 0.05, 0.5), ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function truncate(value, length) {
  const text = String(value ?? '');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export default VerticalBars;
