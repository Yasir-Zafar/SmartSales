import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { EASE, DURATION } from '../../lib/motion';
import { IconButton } from './Button';

/**
 * Dialog.
 *
 * Handles the things hand-rolled modals usually forget: Escape closes it, the
 * page behind stops scrolling, focus moves into the dialog and returns to the
 * trigger on close, and the backdrop click is ignored while work is in flight.
 */

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  busy = false,
  icon: Icon,
}) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);

    // Let the entrance animation start before stealing focus.
    const focusTimer = setTimeout(() => {
      const target = panelRef.current?.querySelector(
        'input, select, textarea, button:not([aria-label="Close dialog"])'
      );
      (target || panelRef.current)?.focus?.();
    }, 60);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      clearTimeout(focusTimer);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose, busy]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast }}
            className="absolute inset-0 bg-canvas/70 backdrop-blur-md"
            onClick={busy ? undefined : onClose}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: DURATION.base, ease: EASE }}
            className={`relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-panel bg-panel shadow-lift ${WIDTHS[size]}`}
            style={{ border: '1px solid rgb(var(--hairline) / 0.1)' }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-hairline/8 p-5">
              <div className="flex min-w-0 gap-3">
                {Icon && (
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-honey/12 text-honey">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-ink">{title}</h2>
                  {description && (
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{description}</p>
                  )}
                </div>
              </div>
              <IconButton icon={X} label="Close dialog" onClick={onClose} disabled={busy} size="sm" />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>

            {footer && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline/8 bg-sunken/40 p-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default Modal;
