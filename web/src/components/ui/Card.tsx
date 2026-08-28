import { type HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement> & { inset?: boolean; small?: boolean };

export function Card({ inset, small, className = '', ...props }: CardProps) {
  const shadow = inset ? 'shadow-inset' : small ? 'shadow-soft-sm' : 'shadow-soft';
  const radius = small ? 'rounded-md' : 'rounded-lg';
  return <div className={`bg-surface ${radius} ${shadow} ${className}`} {...props} />;
}
