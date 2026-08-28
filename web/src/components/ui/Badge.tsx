import { type ReactNode } from 'react';

export type BadgeTone = 'ok' | 'bad' | 'warn' | 'neutral' | 'primary';

const toneClasses: Record<BadgeTone, string> = {
  ok: 'bg-ok-bg text-ok',
  bad: 'bg-bad-bg text-bad',
  warn: 'bg-warn-bg text-warn',
  neutral: 'bg-line text-muted',
  primary: 'bg-primary text-white',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] font-bold ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}
