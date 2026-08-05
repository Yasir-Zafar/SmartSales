import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { itemsForRole } from '../../lib/nav';
import { DURATION, EASE } from '../../lib/motion';

/**
 * Command palette (Cmd/Ctrl + K).
 *
 * Two jobs at once: it gives power users a keyboard route to anything, and it
 * doubles as a discoverability surface — opening it lists every feature the
 * signed-in role has, each with a plain-language description. That is a large
 * part of why the app no longer needs a tour to be learnable.
 */

function score(item, query) {
  if (!query) return 1;
  const q = query.toLowerCase();
  const label = item.label.toLowerCase();
  const description = (item.description || '').toLowerCase();
  const keywords = (item.keywords || []).join(' ').toLowerCase();

  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.includes(q)) return 60;
  if (keywords.includes(q)) return 40;
  if (description.includes(q)) return 20;

  // Subsequence match, so "cmp prd" still finds "Compare periods".
  let index = 0;
  for (const char of q) {
    index = label.indexOf(char, index);
    if (index === -1) return 0;
    index += 1;
  }
  return 10;
}

export function CommandPalette({ open, onClose, role, actions = [] }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();

  const entries = useMemo(() => {
    const pages = itemsForRole(role).map((item) => ({
      id: item.to,
      kind: 'page',
      label: item.label,
      description: item.description,
      keywords: item.keywords,
      icon: item.icon,
      run: () => navigate(item.to),
    }));

    const available = actions.filter((action) => !action.roles || action.roles.includes(role));

    return [...pages, ...available]
      .map((entry) => ({ entry, rank: score(entry, query) }))
      .filter(({ rank }) => rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .map(({ entry }) => entry);
  }, [role, query, actions, navigate]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % Math.max(1, entries.length));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + entries.length) % Math.max(1, entries.length));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const entry = entries[activeIndex];
        if (entry) {
          entry.run();
          onClose();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, entries, activeIndex, onClose]);

  // Keep the highlighted row inside the scroll viewport during arrow-key travel.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast }}
            className="absolute inset-0 bg-canvas/72 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -6 }}
            transition={{ duration: DURATION.base, ease: EASE }}
            className="relative w-full max-w-xl overflow-hidden rounded-panel bg-panel shadow-lift"
            style={{ border: '1px solid rgb(var(--hairline) / 0.12)' }}
          >
            <div className="flex items-center gap-3 border-b border-hairline/8 px-4">
              <Search size={17} className="shrink-0 text-ink-faint" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages and actions…"
                aria-label="Search pages and actions"
                className="h-14 w-full bg-transparent text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <kbd className="hidden shrink-0 rounded-md border border-hairline/12 px-1.5 py-0.5 text-[10px] text-ink-faint sm:block">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {entries.length === 0 ? (
                <p className="px-3 py-8 text-center text-[13px] text-ink-muted">
                  Nothing matches “{query}”.
                </p>
              ) : (
                entries.map((entry, index) => {
                  const Icon = entry.icon;
                  const active = index === activeIndex;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      data-active={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => {
                        entry.run();
                        onClose();
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        active ? 'bg-honey/12' : ''
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          active ? 'bg-honey/18 text-honey' : 'bg-hairline/8 text-ink-muted'
                        }`}
                      >
                        {Icon && <Icon size={15} aria-hidden="true" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ink">{entry.label}</span>
                        {entry.description && (
                          <span className="block truncate text-[12px] text-ink-muted">{entry.description}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-faint">
                        {entry.kind === 'page' ? 'Page' : 'Action'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-hairline/8 bg-sunken/40 px-4 py-2.5 text-[11px] text-ink-faint">
              <span className="flex items-center gap-1">
                <ArrowUp size={11} />
                <ArrowDown size={11} /> navigate
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft size={11} /> open
              </span>
              <span className="ml-auto hidden sm:block">{entries.length} results</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default CommandPalette;
