import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { softSpring } from '../../lib/motion';

/**
 * One button, five intents.
 *
 * The old build hand-wrote Tailwind strings per button, so "primary" looked
 * different on six pages. Everything routes through here now, and a busy button
 * always shows a spinner and disables itself rather than letting a user
 * double-submit an upload or a retrain.
 */

const VARIANTS = {
  primary:
    'bg-honey text-[rgb(var(--honey-ink))] hover:bg-honey-strong shadow-[0_1px_0_rgb(255_255_255/0.18)_inset] disabled:hover:bg-honey',
  secondary:
    'bg-raised text-ink hover:bg-hairline/10 border border-hairline/12 disabled:hover:bg-raised',
  ghost: 'text-ink-soft hover:bg-hairline/8 hover:text-ink disabled:hover:bg-transparent',
  danger:
    'bg-critical/12 text-critical border border-critical/30 hover:bg-critical/20 disabled:hover:bg-critical/12',
  outline:
    'border border-honey/45 text-honey hover:bg-honey/10 disabled:hover:bg-transparent',
};

const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-lg',
  sm: 'h-9 px-3.5 text-[13px] gap-2 rounded-[10px]',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-xl',
};

export const Button = forwardRef(function Button(
  {
    children,
    variant = 'secondary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    disabled = false,
    className = '',
    type = 'button',
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      // A press should feel physical; the spring keeps it from looking snappy-cheap.
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      whileHover={isDisabled ? undefined : { y: -1 }}
      transition={softSpring}
      className={[
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
        'transition-colors duration-200 ease-smooth',
        'disabled:cursor-not-allowed disabled:opacity-55',
        SIZES[size],
        VARIANTS[variant] || VARIANTS.secondary,
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={size === 'xs' ? 13 : 15} aria-hidden="true" />
      ) : (
        Icon && <Icon size={size === 'xs' ? 13 : size === 'lg' ? 18 : 15} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight size={size === 'xs' ? 13 : 15} aria-hidden="true" />}
    </motion.button>
  );
});

/** Square icon-only button. Requires a label for screen readers. */
export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, size = 'md', variant = 'ghost', className = '', ...rest },
  ref
) {
  const box = { sm: 'h-8 w-8', md: 'h-9 w-9', lg: 'h-10 w-10' }[size] || 'h-9 w-9';
  const glyph = { sm: 14, md: 16, lg: 18 }[size] || 16;

  return (
    <motion.button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.92 }}
      transition={softSpring}
      className={[
        'inline-flex items-center justify-center rounded-[10px] transition-colors duration-200',
        box,
        VARIANTS[variant] || VARIANTS.ghost,
        className,
      ].join(' ')}
      {...rest}
    >
      <Icon size={glyph} aria-hidden="true" />
    </motion.button>
  );
});

export default Button;
