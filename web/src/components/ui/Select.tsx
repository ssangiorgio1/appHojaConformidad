import { forwardRef, type SelectHTMLAttributes } from 'react';
import { IconChevronDown } from './Icons';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = '', children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={`w-full appearance-none rounded-md bg-surface px-4 py-3 pr-9 text-sm font-semibold text-text shadow-inset outline-none ${className}`}
        {...props}
      >
        {children}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
    </div>
  );
});
