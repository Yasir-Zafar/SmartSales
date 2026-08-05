import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ORDINAL } from './ChartFrame';

/**
 * Donut for a part-to-whole mix.
 *
 * Customer segments are *ordered* (Champions → Lost), so they take a single-hue
 * ordinal ramp rather than eight unrelated colours — the reader sees the ranking
 * in the shading itself. Every arc is separated by a 2px surface-coloured gap,
 * and the legend carries the name, count and share so nothing depends on colour.
 */

export function Donut({
  data,
  size = 190,
  thickness = 26,
  centerLabel,
  centerValue,
  colors = ORDINAL,
  className = '',
  formatValue = (v) => v,
}) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(null);

  const slices = (data || []).filter((slice) => Number(slice.value) > 0);
  const total = slices.reduce((sum, slice) => sum + Number(slice.value), 0);

  if (!total) return null;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={`flex flex-col items-center gap-6 sm:flex-row sm:items-center ${className}`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label="Share of customers by segment">
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {slices.map((slice, index) => {
              const share = Number(slice.value) / total;
              // 2px of surface between arcs, expressed in stroke-dash units.
              const gap = 2;
              const length = Math.max(0, share * circumference - gap);
              const dash = `${length} ${circumference - length}`;
              const rotation = offset;
              offset += share * circumference;
              const active = hovered === index;

              return (
                <motion.circle
                  key={slice.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={colors[index % colors.length]}
                  strokeWidth={active ? thickness + 4 : thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={-rotation}
                  opacity={hovered == null || active ? 1 : 0.45}
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer transition-[stroke-width,opacity] duration-200"
                  initial={reduceMotion ? false : { strokeDasharray: `0 ${circumference}` }}
                  animate={{ strokeDasharray: dash }}
                  transition={{ duration: 0.8, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                />
              );
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {hovered != null && slices[hovered] ? (
            <>
              <span className="font-display text-xl font-semibold text-ink tabular">
                {((Number(slices[hovered].value) / total) * 100).toFixed(1)}%
              </span>
              <span className="mt-0.5 max-w-[6.5rem] text-[11px] leading-tight text-ink-muted">
                {slices[hovered].label}
              </span>
            </>
          ) : (
            <>
              <span className="font-display text-xl font-semibold text-ink tabular">
                {centerValue ?? formatValue(total)}
              </span>
              <span className="mt-0.5 text-[11px] text-ink-muted">{centerLabel ?? 'total'}</span>
            </>
          )}
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1.5">
        {slices.map((slice, index) => {
          const share = (Number(slice.value) / total) * 100;
          return (
            <li
              key={slice.label}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] transition-colors ${
                hovered === index ? 'bg-hairline/8' : ''
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ background: colors[index % colors.length] }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-ink-soft">{slice.label}</span>
              <span className="shrink-0 text-ink-faint tabular">{formatValue(slice.value)}</span>
              <span className="w-12 shrink-0 text-right font-semibold text-ink tabular">
                {share.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default Donut;
