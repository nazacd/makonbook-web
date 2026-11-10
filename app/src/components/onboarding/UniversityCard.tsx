import { MapPin, Trophy } from 'lucide-react';
import { useRef, type PointerEvent } from 'react';

import { countryName, satMinimum, satRange, type University } from '@/api/universities';
import { Flag } from '@/screens/roadmap/flags';

import { UniversityBadge } from './Crest';

// The chosen university, as a card that tilts towards the pointer (3D), with
// a sheen that follows it. Still for anyone who asked for less motion.

export function satLine(u: University): string {
  const r = satRange(u.sat);
  if (r) return `Admitted students score ${r.p25}–${r.p75}`;
  const min = satMinimum(u.sat);
  if (min != null) return `Asks for at least ${min} on the SAT`;
  switch (u.sat?.policy) {
    case 'optional':
      return 'The SAT is optional here';
    case 'not_considered':
      return 'Doesn’t look at the SAT';
    case 'accepted':
      return 'Accepts the SAT';
    default:
      return 'SAT details coming soon';
  }
}

export function qsLabel(u: University) {
  // A tie ("=45") reads as its place.
  return u.qs ? `QS #${u.qs.display.replace(/^=/, '')}` : null;
}

export function UniversityCard({ u }: { u: University }) {
  const card = useRef<HTMLDivElement>(null);
  const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function move(e: PointerEvent<HTMLDivElement>) {
    const el = card.current;
    if (!el || still || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 10}deg) rotateY(${(x - 0.5) * 14}deg) translateZ(0)`;
    el.style.setProperty('--sx', `${x * 100}%`);
    el.style.setProperty('--sy', `${y * 100}%`);
  }
  function leave() {
    if (card.current) card.current.style.transform = '';
  }

  const qs = qsLabel(u);
  return (
    <div ref={card} onPointerMove={move} onPointerLeave={leave} className="tilt glass pop relative overflow-hidden rounded-[22px] p-5">
      <div className="sheen pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative flex items-start gap-4" style={{ transform: 'translateZ(30px)' }}>
        <UniversityBadge id={u.id} name={u.name} logo={u.logo_url} size={64} ring="gold" />
        <div className="min-w-0 flex-1">
          {qs && (
            <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-[rgba(246,195,67,0.16)] px-2 py-0.5 text-[11.5px] font-bold tracking-wide text-[var(--onb-gold)]">
              <Trophy size={12} aria-hidden="true" /> {qs}
            </span>
          )}
          <h2 className="text-[20px] font-bold leading-6 text-[var(--onb-ink)]">{u.name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-[var(--onb-ink-2)]">
            <Flag code={u.country} size={16} className="ring-1" />
            <span className="truncate">
              {u.city ? `${u.city}, ` : ''}
              {countryName(u.country)}
            </span>
            <MapPin size={13} className="shrink-0 opacity-60" aria-hidden="true" />
          </p>
        </div>
      </div>
      <p className="relative mt-4 rounded-[12px] bg-[var(--onb-glass-2)] px-3 py-2 text-[13.5px] font-semibold text-[var(--onb-ink)]" style={{ transform: 'translateZ(18px)' }}>
        {satLine(u)}
      </p>
    </div>
  );
}
