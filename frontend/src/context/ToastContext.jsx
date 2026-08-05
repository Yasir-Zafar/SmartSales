import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { EASE, DURATION } from '../lib/motion';

const ToastContext = createContext(null);

/**
 * Transient feedback.
 *
 * The old build wrote outcomes into ad-hoc `message` strings rendered inline on
 * each page, which meant "saved!" could scroll off screen. Toasts put every
 * confirmation and failure in one predictable place.
 */

const TONES = {
  success: { icon: CheckCircle2, className: 'text-good', ring: 'rgb(var(--status-good) / 0.35)' },
  error: { icon: XCircle, className: 'text-critical', ring: 'rgb(var(--status-critical) / 0.35)' },
  warning: { icon: AlertTriangle, className: 'text-warn', ring: 'rgb(var(--status-warning) / 0.35)' },
  info: { icon: Info, className: 'text-ink-soft', ring: 'rgb(var(--hairline) / 0.18)' },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const entry = { id, tone: 'info', duration: 5000, ...toast };
      setToasts((current) => [...current.slice(-3), entry]);

      if (entry.duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), entry.duration));
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      toast: push,
      success: (title, description) => push({ tone: 'success', title, description }),
      error: (title, description) => push({ tone: 'error', title, description, duration: 8000 }),
      warning: (title, description) => push({ tone: 'warning', title, description, duration: 7000 }),
      info: (title, description) => push({ tone: 'info', title, description }),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2.5"
        role="region"
        aria-label="Notifications"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const tone = TONES[toast.tone] || TONES.info;
            const Icon = tone.icon;
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 28, scale: 0.97 }}
                transition={{ duration: DURATION.base, ease: EASE }}
                className="pointer-events-auto rounded-card bg-panel p-3.5 shadow-lift"
                style={{ border: `1px solid ${tone.ring}` }}
                role="status"
              >
                <div className="flex gap-3">
                  <Icon className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${tone.className}`} size={18} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{toast.title}</p>
                    {toast.description && (
                      <p className="mt-0.5 break-words text-[13px] leading-relaxed text-ink-muted">
                        {toast.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    className="-m-1 h-6 w-6 shrink-0 rounded-md p-1 text-ink-faint transition hover:bg-hairline/10 hover:text-ink"
                    aria-label="Dismiss notification"
                  >
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};

export default ToastContext;
