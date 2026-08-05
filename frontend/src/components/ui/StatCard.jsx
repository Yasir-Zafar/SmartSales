import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { staggerChild, EASE } from '../../lib/motion';
import { Skeleton } from './Skeleton';

/**
 * Headline figures.
 *
 * A stat tile is not a chart, so it carries no series colour — the number wears
 * ink, and only the delta gets a status colour, always with a directional arrow
 * so the sign is never colour-alone.
 */

/** Counts a number up on mount. Skipped entirely under reduced motion. */
function useCountUp(target, { duration = 900, enabled = true } = {}) {
  const [display, setDisplay] = useState(enabled ? 0 : target);
  const frame = useRef();
  const previous = useRef(0);

  useEffect(() => {
    if (!enabled || !Number.isFinite(target)) {
      setDisplay(target);
      return undefined;
    }

    const from = previous.current;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      // Ease-out cubic: fast first, settles gently on the final value.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
      else previous.current = target;
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration, enabled]);

  return display;
}

export function StatCard({
  label,
  value,
  numericValue,
  format,
  hint,
  delta,
  deltaLabel,
  icon: Icon,
  loading = false,
  accent = false,
  className = '',
}) {
  const reduceMotion = useReducedMotion();
  const animatable = numericValue != null && Number.isFinite(Number(numericValue)) && !loading;
  const counted = useCountUp(Number(numericValue), { enabled: animatable && !reduceMotion });

  const shown = loading
    ? null
    : animatable && format
      ? format(reduceMotion ? Number(numericValue) : counted)
      : value;

  const deltaValue = Number(delta);
  const hasDelta = Number.isFinite(deltaValue);
  const DeltaIcon = !hasDelta ? Minus : deltaValue > 0 ? ArrowUpRight : deltaValue < 0 ? ArrowDownRight : Minus;
  const deltaTone = !hasDelta
    ? 'text-ink-faint'
    : deltaValue > 0
      ? 'text-good'
      : deltaValue < 0
        ? 'text-critical'
        : 'text-ink-muted';

  return (
    <motion.div
      variants={staggerChild}
      className={[
        'surface relative overflow-hidden p-5',
        accent ? 'ring-1 ring-inset ring-honey/20' : '',
        className,
      ].join(' ')}
    >
      {accent && (
        <span
          className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-honey/10 blur-2xl"
          aria-hidden="true"
        />
      )}

      <div className="relative flex items-center justify-between gap-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.13em] text-ink-faint">{label}</p>
        {Icon && <Icon size={15} className="shrink-0 text-ink-faint" aria-hidden="true" />}
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-8 w-28" />
      ) : (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="relative mt-2.5 font-display text-[26px] font-semibold leading-none tracking-tight text-ink tabular"
        >
          {shown ?? '—'}
        </motion.p>
      )}

      <div className="relative mt-2.5 flex items-center gap-2">
        {hasDelta && (
          <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${deltaTone}`}>
            <DeltaIcon size={13} aria-hidden="true" />
            {Math.abs(deltaValue).toFixed(1)}%
          </span>
        )}
        {(deltaLabel || hint) && (
          <span className="truncate text-[12px] text-ink-faint">{deltaLabel || hint}</span>
        )}
      </div>
    </motion.div>
  );
}

export default StatCard;
