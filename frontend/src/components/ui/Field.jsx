import React, { forwardRef, useId } from 'react';
import { ChevronDown, Search } from 'lucide-react';

/**
 * Form controls.
 *
 * Every input is wrapped in a Field so it always has a real <label>, optional
 * helper text, and an error message wired up with aria-describedby — the old
 * build used bare placeholders, which vanish the moment you start typing.
 */

const CONTROL_BASE =
  'w-full bg-sunken/60 text-ink placeholder:text-ink-faint border border-hairline/12 ' +
  'rounded-xl transition-[border-color,box-shadow,background-color] duration-200 ease-smooth ' +
  'focus:outline-none focus:border-honey/55 focus:bg-panel focus:ring-4 focus:ring-honey/12 ' +
  'disabled:opacity-55 disabled:cursor-not-allowed';

const SIZES = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-11 px-3.5 text-sm',
};

export function Field({ label, htmlFor, hint, error, required, children, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink-soft">
          {label}
          {required && <span className="ml-0.5 text-critical">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[12px] text-critical">{error}</p>
      ) : (
        hint && <p className="text-[12px] text-ink-faint">{hint}</p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { label, hint, error, required, size = 'md', icon: Icon, className = '', containerClassName = '', id, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const describedBy = hint || error ? `${inputId}-help` : undefined;

  const control = (
    <div className="relative">
      {Icon && (
        <Icon
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
      )}
      <input
        ref={ref}
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? 'true' : undefined}
        className={[
          CONTROL_BASE,
          SIZES[size],
          Icon ? 'pl-9' : '',
          error ? 'border-critical/50 focus:border-critical/60 focus:ring-critical/12' : '',
          className,
        ].join(' ')}
        {...rest}
      />
    </div>
  );

  if (!label && !hint && !error) return control;

  return (
    <Field label={label} htmlFor={inputId} required={required} className={containerClassName}>
      {control}
      {(hint || error) && (
        <p id={describedBy} className={`text-[12px] ${error ? 'text-critical' : 'text-ink-faint'}`}>
          {error || hint}
        </p>
      )}
    </Field>
  );
});

export const Select = forwardRef(function Select(
  { label, hint, error, required, size = 'md', children, className = '', containerClassName = '', id, ...rest },
  ref
) {
  const generatedId = useId();
  const selectId = id || generatedId;

  const control = (
    <div className="relative">
      <select
        ref={ref}
        id={selectId}
        className={[
          CONTROL_BASE,
          SIZES[size],
          'cursor-pointer appearance-none pr-9',
          error ? 'border-critical/50' : '',
          className,
        ].join(' ')}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint"
        aria-hidden="true"
      />
    </div>
  );

  if (!label && !hint && !error) return control;

  return (
    <Field label={label} htmlFor={selectId} hint={hint} error={error} required={required} className={containerClassName}>
      {control}
    </Field>
  );
});

/** Search box with a clear affordance — used above every long table. */
export function SearchInput({ value, onChange, placeholder = 'Search…', className = '', ...rest }) {
  return (
    <Input
      icon={Search}
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      size="sm"
      className={className}
      {...rest}
    />
  );
}

/** Paired start/end date inputs — the app asks for a range in five places. */
export function DateRange({ start, end, onStartChange, onEndChange, labels = ['From', 'To'], size = 'md' }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Input label={labels[0]} type="date" value={start} onChange={onStartChange} size={size} />
      <Input label={labels[1]} type="date" value={end} onChange={onEndChange} size={size} />
    </div>
  );
}

export default Input;
