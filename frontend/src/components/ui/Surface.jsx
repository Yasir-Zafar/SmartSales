import React from 'react';
import { motion } from 'framer-motion';
import { staggerChild } from '../../lib/motion';

/**
 * Panels and their headers.
 *
 * Card no longer means "a box with a border" — it carries an optional header
 * with a title, a plain-language explanation and a slot for controls, so every
 * panel in the app answers "what is this?" without the user guessing.
 */

export function Card({
  children,
  className = '',
  padded = true,
  interactive = false,
  animate = true,
  as: Component = 'div',
  ...rest
}) {
  const Element = animate ? motion(Component) : Component;
  const motionProps = animate ? { variants: staggerChild } : {};

  return (
    <Element
      className={[
        'surface',
        padded ? 'p-5' : '',
        interactive
          ? 'transition-[transform,box-shadow,border-color] duration-300 ease-smooth hover:-translate-y-0.5 hover:border-honey/30 hover:shadow-lift'
          : '',
        className,
      ].join(' ')}
      {...motionProps}
      {...rest}
    >
      {children}
    </Element>
  );
}

export function CardHeader({ title, description, icon: Icon, actions, className = '' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-honey/12 text-honey">
            <Icon size={16} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight text-ink">{title}</h3>
          {description && (
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A quieter container for nested content inside a Card. */
export function Inset({ children, className = '', ...rest }) {
  return (
    <div className={`surface-inset p-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Small uppercase label that groups a run of content. */
export function SectionLabel({ children, className = '' }) {
  return (
    <p className={`text-2xs font-semibold uppercase tracking-[0.13em] text-ink-faint ${className}`}>
      {children}
    </p>
  );
}

export function Divider({ className = '' }) {
  return <div className={`h-px w-full bg-hairline/8 ${className}`} />;
}

export default Card;
