import { cn } from '../../lib/cn';

export type Tone = 'positive' | 'warn' | 'danger' | 'idle';

const TONES: Record<Tone, string> = {
  positive: 'bg-positive',
  warn: 'bg-warn',
  danger: 'bg-danger',
  idle: 'bg-ink-dim',
};

interface StatusDotProps {
  tone: Tone;
  pulse?: boolean;
  className?: string;
}

export function StatusDot({ tone, pulse = false, className }: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-1.5 shrink-0 rounded-full', TONES[tone], pulse && 'wm-pulse', className)}
    />
  );
}
