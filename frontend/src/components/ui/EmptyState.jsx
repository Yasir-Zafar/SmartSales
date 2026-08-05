import React from 'react';
import { motion } from 'framer-motion';
import { Inbox, ServerCrash, SearchX, PlugZap } from 'lucide-react';
import { EASE, DURATION } from '../../lib/motion';
import { Button } from './Button';

/**
 * Empty and error states.
 *
 * Every dead end explains itself and offers the next move. The ML-service
 * variant matters most: half the screens in this app go blank when the Python
 * service is not running, and "no data" is a much worse message than
 * "start the ML service".
 */

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  actionLabel,
  actionIcon,
  tone = 'neutral',
  className = '',
  children,
}) {
  const iconTone = {
    neutral: 'bg-hairline/8 text-ink-faint',
    honey: 'bg-honey/12 text-honey',
    critical: 'bg-critical/10 text-critical',
    warning: 'bg-warn/12 text-warn',
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE }}
      className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconTone}`}>
        <Icon size={22} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-muted">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
      {action && actionLabel && (
        <Button variant="secondary" size="sm" icon={actionIcon} onClick={action} className="mt-5">
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}

/** Shown when the FastAPI model service cannot be reached. */
export function MlOfflineState({ onRetry, what = 'These insights' }) {
  return (
    <EmptyState
      icon={PlugZap}
      tone="warning"
      title="The AI service is not responding"
      description={`${what} come from the Python model service. Start it with "uvicorn app:app --port 8000" from the ml folder, then retry.`}
      action={onRetry}
      actionLabel="Try again"
    />
  );
}

export function ErrorState({ title = 'Could not load this', description, onRetry }) {
  return (
    <EmptyState
      icon={ServerCrash}
      tone="critical"
      title={title}
      description={description}
      action={onRetry}
      actionLabel="Try again"
    />
  );
}

export function NoResultsState({ query, onClear }) {
  return (
    <EmptyState
      icon={SearchX}
      title={query ? `Nothing matches “${query}”` : 'No results'}
      description="Try a shorter search, or clear the filters to see everything again."
      action={onClear}
      actionLabel="Clear filters"
    />
  );
}

export default EmptyState;
