import React, { useId, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ChartTooltip,
  GridLines,
  Legend,
  SERIES,
  YAxis,
  niceScale,
  useChartSize,
  usePointerIndex,
} from './ChartFrame';

/**
 * Line / area chart for change over time.
 *
 * One y-axis only — a second scale is the single most misleading thing a chart
 * can do, so two measures of different magnitude get two charts instead. The
 * crosshair and tooltip ship by default: an SVG chart in a browser is an
 * interactive chart, and hover is where the exact numbers live.
 */

const BASE_PADDING = { top: 14, right: 14, bottom: 26, left: 46 };

/**
 * Reserve gutter width from the widest tick label. A fixed left padding clips
 * currency ticks like "$1,000.00" the moment the numbers get large.
 */
function gutterFor(ticks, formatY) {
  const widest = ticks.reduce((max, tick) => Math.max(max, String(formatY(tick)).length), 0);
  return Math.min(96, Math.max(38, widest * 6.4 + 14));
}

export function LineArea({
  data,
  series,
  height = 240,
  formatY = (v) => v,
  formatValue = (v) => v,
  formatLabel = (d) => d.label,
  showArea = true,
  className = '',
}) {
  const containerRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const gradientId = useId();
  const { width } = useChartSize(containerRef, { height });

  const points = data || [];
  const allValues = points.flatMap((point) => series.map((s) => Number(point[s.key]) || 0));
  const { max, ticks } = niceScale(Math.max(...allValues, 0));
  const PADDING = { ...BASE_PADDING, left: gutterFor(ticks, formatY) };

  const { index: hovered, onMove, onLeave } = usePointerIndex({
    count: points.length,
    width,
    padding: PADDING,
  });

  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const xAt = (index) => PADDING.left + index * stepX;
  const yAt = (value) => PADDING.top + (1 - (Number(value) || 0) / max) * plotHeight;

  const labelIndices = points.length
    ? [0, Math.floor((points.length - 1) / 2), points.length - 1].filter(
        (value, index, list) => list.indexOf(value) === index
      )
    : [];

  return (
    <div className={className}>
      <div ref={containerRef} className="relative w-full" style={{ height }}>
        <svg
          width={width}
          height={height}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          role="img"
          aria-label={`Chart of ${series.map((s) => s.label).join(' and ')} across ${points.length} points`}
        >
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

          <defs>
            {series.map((s, index) => {
              const color = s.color || SERIES[index % SERIES.length];
              return (
                <linearGradient key={s.key} id={`${gradientId}-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              );
            })}
          </defs>

          {series.map((s, seriesIndex) => {
            const color = s.color || SERIES[seriesIndex % SERIES.length];
            if (!points.length) return null;

            const linePath = points
              .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index)} ${yAt(point[s.key])}`)
              .join(' ');
            const areaPath = `${linePath} L ${xAt(points.length - 1)} ${height - PADDING.bottom} L ${xAt(0)} ${
              height - PADDING.bottom
            } Z`;

            return (
              <g key={s.key}>
                {showArea && (
                  <motion.path
                    d={areaPath}
                    fill={`url(#${gradientId}-${seriesIndex})`}
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                  />
                )}

                <motion.path
                  d={linePath}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  // Draw-on: the line traces itself rather than popping in.
                  initial={reduceMotion ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                />

                {/* Hovered marker, ringed in the surface colour so it stays legible
                    wherever lines overlap. */}
                {hovered != null && points[hovered] && (
                  <circle
                    cx={xAt(hovered)}
                    cy={yAt(points[hovered][s.key])}
                    r="4.5"
                    fill={color}
                    stroke="rgb(var(--panel))"
                    strokeWidth="2"
                  />
                )}
              </g>
            );
          })}

          {hovered != null && (
            <line
              x1={xAt(hovered)}
              x2={xAt(hovered)}
              y1={PADDING.top}
              y2={height - PADDING.bottom}
              stroke="rgb(var(--hairline) / 0.22)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* First / middle / last only — a label per point is unreadable at any
              real data volume. */}
          {labelIndices.map((index) => (
            <text
              key={index}
              x={xAt(index)}
              y={height - 8}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              className="fill-[rgb(var(--ink-faint))] text-[10px]"
            >
              {formatLabel(points[index])}
            </text>
          ))}
        </svg>

        {hovered != null && points[hovered] && (
          <ChartTooltip
            x={xAt(hovered)}
            y={yAt(points[hovered][series[0].key])}
            containerWidth={width}
            visible
          >
            <p className="text-[11px] font-medium text-ink-muted">{formatLabel(points[hovered])}</p>
            <div className="mt-1.5 space-y-1">
              {series.map((s, seriesIndex) => (
                <div key={s.key} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
                    <span
                      className="h-2 w-2 rounded-[2px]"
                      style={{ background: s.color || SERIES[seriesIndex % SERIES.length] }}
                    />
                    {s.label}
                  </span>
                  <span className="text-[12.5px] font-semibold text-ink tabular">
                    {formatValue(points[hovered][s.key])}
                  </span>
                </div>
              ))}
            </div>
          </ChartTooltip>
        )}
      </div>

      <Legend
        items={series.map((s, i) => ({ label: s.label, color: s.color || SERIES[i % SERIES.length] }))}
        className="mt-3 justify-center"
      />
    </div>
  );
}

export default LineArea;
