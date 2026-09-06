import { forwardRef } from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';

import { cn } from '../../lib/cn';

export const ToggleGroup = forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(function ToggleGroup({ className, ...props }, ref) {
  return (
    <ToggleGroupPrimitive.Root
      ref={ref}
      className={cn('inline-flex gap-1 rounded-lg border border-edge bg-raise p-1', className)}
      {...props}
    />
  );
});

export const ToggleGroupItem = forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(function ToggleGroupItem({ className, ...props }, ref) {
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        'inline-flex h-7 flex-1 items-center justify-center rounded-md px-3 font-display text-sm font-medium tracking-wide uppercase',
        'text-ink-dim transition-colors hover:text-ink',
        'data-[state=on]:bg-gold data-[state=on]:text-bg-solid data-[state=on]:font-semibold',
        className,
      )}
      {...props}
    />
  );
});
