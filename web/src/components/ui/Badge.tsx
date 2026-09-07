import { type ReactNode } from 'react';

export type BadgeTone = 'ok' | 'bad' | 'warn' | 'neutral' | 'primary';

const toneClasses: Record<BadgeTone, string> = {
  ok: 'bg-success-50 text-success-700',
  bad: 'bg-danger-50 text-danger-700',
  warn: 'bg-warning-50 text-warning-700',
  neutral: 'bg-neutral-100 text-neutral-700',
  primary: 'bg-primary-600 text-white',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] font-bold ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}
