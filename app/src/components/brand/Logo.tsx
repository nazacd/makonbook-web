import { useId } from 'react';

import { SHIELD_INNER, SHIELD_LETTERS, SHIELD_LOWER, SHIELD_RING, SHIELD_VIEWBOX } from './shield';

/** The shield alone, in the current text colour. */
export function ShieldMark({ size = 32, className = '', title }: { size?: number; className?: string; title?: string }) {
  const clip = useId();
  return (
    <svg viewBox={SHIELD_VIEWBOX} height={size} width={(size * 1669) / 2000} className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <clipPath id={clip}>
          <path d={SHIELD_INNER} />
        </clipPath>
      </defs>
      <g fill="currentColor">
        <path fillRule="evenodd" d={SHIELD_RING} />
        <path fillRule="evenodd" d={SHIELD_LETTERS} />
        <path fillRule="evenodd" clipPath={`url(#${clip})`} d={SHIELD_LOWER} />
      </g>
    </svg>
  );
}

export const BRAND = 'SATMAKON';
export const TAGLINE = 'Your road to 1600';

/** The shield, the name and the tagline, as at the top of the sidebar. */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 text-primary">
      <ShieldMark size={compact ? 30 : 34} />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[21px] font-extrabold tracking-[-0.03em]">{BRAND}</span>
          <span className="mt-1 text-[9.5px] font-bold tracking-[0.02em] text-ink-2">{TAGLINE}</span>
        </span>
      )}
    </span>
  );
}
