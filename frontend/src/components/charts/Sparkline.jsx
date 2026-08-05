import React, { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SERIES } from './ChartFrame';

/**
 * Sparkline — a shape cue inside a stat tile, not a chart.
 *
 * No axes, no ticks, no tooltip: it exists to say "rising", "falling" or
 * "steady" at a glance. Exact values live in the table the tile links to.
 */

export function Sparkline({
  values,
  width = 120,
  height = 34,
  color = SERIES[0],
  showArea = true,
  className = '',
}) {
  const reduceMotion = useReducedMotion();
  const gradientId = useId();

  const numbers = (values || []).map((v) => Number(v) || 0);
  if (numbers.length < 2) return null;

  const max = Math.max(...numbers);
  const min = Math.min(...numbers);
  const range = max - min || 1;
  const stepX = width / (numbers.length - 1);
  // 2px inset top and bottom keeps the 2px stroke from clipping at the extremes.
  const yAt = (value) => 2 + (1 - (value - min) / range) * (height - 4);

  const line = numbers.map((value, index) => `${index === 0 ? 'M' : 'L'} ${index * stepX} ${yAt(value)}`).join(' ');
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      {showArea && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
        </>
      )}
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduceMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      <circle cx={width} cy={yAt(numbers[numbers.length - 1])} r="2.5" fill={color} />
    </svg>
  );
}

export default Sparkline;
