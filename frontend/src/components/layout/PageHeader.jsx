import React from 'react';
import { motion } from 'framer-motion';
import { EASE, DURATION } from '../../lib/motion';

/**
 * Page header.
 *
 * Every screen states in one sentence what it is for. That single habit does
 * more for the learning curve than any tour — a first-time user never has to
 * infer a page's purpose from its controls.
 */

export function PageHeader({ title, description, actions, children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE }}
      className={`mb-6 flex flex-wrap items-start justify-between gap-4 ${className}`}
    >
      <div className="min-w-0 max-w-2xl">
        <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight text-ink">{title}</h2>
        {description && (
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{description}</p>
        )}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

export default PageHeader;
