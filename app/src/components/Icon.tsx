import type { LucideIcon } from 'lucide-react';

// Lucide only, 1.75 stroke, ink by default (MOBILE-DESIGN.md); colour comes
// from the surrounding text unless a class says otherwise.
export function Icon({ as: As, size = 20, className, strokeWidth = 1.75 }: { as: LucideIcon; size?: number; className?: string; strokeWidth?: number }) {
  return <As size={size} strokeWidth={strokeWidth} className={className ?? 'text-ink'} aria-hidden="true" />;
}
