import { type HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement> & { inset?: boolean; small?: boolean };

export function Card({ inset, small, className = '', ...props }: CardProps) {
  const shadow = inset ? 'shadow-inset' : small ? 'shadow-soft-sm' : 'shadow-soft';
  // Cards = Radio L (12px) en design.md, sin distinción por tamaño.
  return <div className={`bg-surface rounded-lg ${shadow} ${className}`} {...props} />;
}
