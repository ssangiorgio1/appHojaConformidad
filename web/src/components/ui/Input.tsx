import { forwardRef, type InputHTMLAttributes } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-md bg-surface px-4 py-3 text-sm font-medium text-text shadow-inset outline-none placeholder:text-muted placeholder:font-medium ${className}`}
      {...props}
    />
  );
});
