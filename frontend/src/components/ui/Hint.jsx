import React, { useState, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { DURATION, EASE } from '../../lib/motion';

/**
 * Jargon buster.
 *
 * This app is full of terms a shop owner has no reason to know — MAE, RMSE,
 * MAPE, RFM, ensemble, CV. Rather than dumbing the metrics down, every one of
 * them carries a Hint that explains it in a sentence, which is most of what
 * flattens the learning curve.
 */

export const GLOSSARY = {
  mae: {
    term: 'MAE',
    text: 'Mean Absolute Error — on average, how many units the forecast misses by. Lower is better.',
  },
  rmse: {
    term: 'RMSE',
    text: 'Root Mean Squared Error — like MAE, but punishes big misses harder. Lower is better.',
  },
  mape: {
    term: 'MAPE',
    text: 'Mean Absolute Percentage Error — the average miss as a percentage of actual sales.',
  },
  ensemble: {
    term: 'Ensemble',
    text: 'Two models blended together: an LSTM that learns recent patterns and a seasonal model that learns repeating cycles.',
  },
  lstm: {
    term: 'LSTM',
    text: 'A neural network that reads the recent sales sequence to predict what comes next.',
  },
  seasonal: {
    term: 'Seasonal model',
    text: 'A simpler model that captures repeating weekly and monthly rhythms in demand.',
  },
  rfm: {
    term: 'RFM',
    text: 'Recency, Frequency, Monetary value — the three signals used to group customers into segments.',
  },
  confidence: {
    term: 'Confidence',
    text: 'How trustworthy this forecast is, based on how large its historical error is compared with the product’s typical daily sales.',
  },
  baseline: {
    term: 'Baseline',
    text: 'What five days of sales normally look like for this product, from its historical daily average.',
  },
  dropPct: {
    term: 'Drop %',
    text: 'How far the 5-day forecast sits below the historical baseline. Higher means a bigger predicted fall.',
  },
  threshold: {
    term: 'Threshold',
    text: 'The drop percentage at which a product starts counting as an anomaly. Raise it for fewer, more serious alerts.',
  },
  trendDriver: {
    term: 'Trend driver',
    text: '“Recent spikes” means the short-term model disagrees sharply with the seasonal baseline. “Cycles” means both models agree.',
  },
  riskLevel: {
    term: 'Risk level',
    text: 'How likely this product is to run short, based on predicted demand and how volatile its sales are.',
  },
  anchorDate: {
    term: 'Anchor date',
    text: 'Figures are measured against the most recent date in your uploaded sales data, not today’s calendar date.',
  },
};

export function Hint({ children, term, text, side = 'top', className = '' }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      {children}
      <button
        type="button"
        aria-label={`What is ${term}?`}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="ml-1 inline-flex text-ink-faint transition-colors hover:text-honey"
      >
        <HelpCircle size={12} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: side === 'bottom' ? -4 : 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: DURATION.fast, ease: EASE }}
            className={`absolute z-50 w-56 rounded-xl border border-hairline/12 bg-panel p-3 text-left text-[12px] font-normal leading-relaxed text-ink-soft shadow-lift ${positions[side]}`}
          >
            <span className="mb-1 block font-semibold text-ink">{term}</span>
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Shorthand: <Glossary k="mae">MAE</Glossary> */
export function Glossary({ k, children, side, className }) {
  const entry = GLOSSARY[k];
  if (!entry) return <>{children}</>;
  return (
    <Hint term={entry.term} text={entry.text} side={side} className={className}>
      {children ?? entry.term}
    </Hint>
  );
}

export default Hint;
