import type { ReactNode } from 'react';

import { BRAND, ShieldMark, TAGLINE } from './Logo';

// Sign-in and the first password: a card on the canvas with a soft purple
// glow, its top a purple band with the shield.
export function AuthCard({ title, subtitle, children, aside }: { title: string; subtitle?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10" style={{ background: 'radial-gradient(120% 70% at 50% -10%, var(--color-accent-tint) 0%, transparent 60%), var(--color-brand)' }}>
      <div className="rise w-full max-w-[440px] overflow-hidden rounded-panel border border-line bg-surface shadow-[0_24px_60px_-28px_rgba(62,0,142,0.35)]">
        <div className="relative overflow-hidden px-6 pb-6 pt-7 text-white" style={{ background: 'linear-gradient(150deg, #5a12bf, #3e008e 55%, #2a0063)' }}>
          <ShieldMark size={120} className="absolute -right-5 -top-3 text-white/10" />
          <div className="relative flex items-center gap-3">
            <ShieldMark size={40} className="text-white" />
            <div className="leading-tight">
              <p className="text-[22px] font-extrabold tracking-[-0.03em]">{BRAND}</p>
              <p className="text-[12px] font-semibold text-white/75">{TAGLINE}</p>
            </div>
          </div>
          <h1 className="relative mt-6 text-[24px] font-bold leading-7 tracking-[-0.02em]">{title}</h1>
          {subtitle && <p className="relative mt-1 text-[14px] text-white/80">{subtitle}</p>}
        </div>
        <div className="px-6 pb-6 pt-5">{children}</div>
      </div>
      {aside && <div className="mt-5 max-w-[440px] text-center">{aside}</div>}
    </div>
  );
}
