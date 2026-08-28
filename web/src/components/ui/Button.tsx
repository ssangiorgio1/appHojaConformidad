import { type ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' };

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  if (variant === 'ghost') {
    return (
      <button
        className={`inline-flex items-center gap-2 rounded-md px-4 py-3 text-sm font-bold text-muted transition hover:text-text disabled:opacity-50 ${className}`}
        {...props}
      />
    );
  }
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-accent to-primary px-5 py-3 text-sm font-bold text-white shadow-soft-sm transition disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
