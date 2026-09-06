import { forwardRef } from 'react';

import { cn } from '../../lib/cn';

type Variant = 'primary' | 'ghost' | 'subtle' | 'icon';
type Size = 'sm' | 'md' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gold text-bg-solid font-semibold hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100',
  ghost:
    'border border-edge text-gold hover:bg-raise hover:border-edge-strong disabled:opacity-40 disabled:hover:bg-transparent',
  subtle: 'text-ink-dim hover:text-ink hover:bg-raise disabled:opacity-40 disabled:hover:bg-transparent',
  icon: 'text-ink-dim hover:text-ink hover:bg-raise disabled:opacity-30 disabled:hover:bg-transparent',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2 text-xs rounded-md gap-1.5',
  md: 'h-8 px-3 text-sm rounded-lg gap-2',
  icon: 'size-7 rounded-md justify-center',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'subtle', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-slot="button"
      className={cn(
        'inline-flex items-center whitespace-nowrap font-medium transition-[background-color,color,filter,transform] duration-100 active:translate-y-px',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
