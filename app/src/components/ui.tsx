import { X, type LucideIcon } from 'lucide-react';
import { useEffect, type CSSProperties, type ReactNode } from 'react';

import { useDialog } from '@/lib/dialog';

// The design system's building blocks (docs/design.md): page headers, cards,
// widget headers, pills, segmented tabs, big-number stats and modals.

/** A list page's header: an icon tile, the title, and actions on the right. */
export function PageHeader({ icon, title, subtitle, actions }: { icon?: LucideIcon; title: string; subtitle?: string; actions?: ReactNode }) {
  const I = icon;
  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 items-center gap-3">
        {I && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-primary">
            <I size={19} strokeWidth={2} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[28px] font-semibold leading-[34px] tracking-[-0.03em] text-title md:text-[32px] md:leading-[38px]">{title}</h1>
          {subtitle && <p className="t-subhead mt-0.5 text-ink-2">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

/** A plain card: white, a light border, radius 16. */
export function Card({ children, className = '', as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={`rounded-card border border-line bg-surface p-[18px] ${className}`}>{children}</As>;
}

/** A dashboard widget: a card tinted from the top by its accent colour. */
export function Widget({ accent, children, className = '' }: { accent: string; children: ReactNode; className?: string }) {
  return (
    <section className={`widget ${className}`} style={{ '--w': accent } as CSSProperties}>
      {children}
    </section>
  );
}

/** A widget's label: a small tinted icon chip and uppercase text in the accent. */
export function WidgetLabel({ icon: I, label, accent, right }: { icon: LucideIcon; label: string; accent: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        <span
          className="flex size-6 items-center justify-center rounded-[7px] border"
          style={{ color: accent, background: `color-mix(in srgb, ${accent} 14%, transparent)`, borderColor: `color-mix(in srgb, ${accent} 26%, transparent)` }}>
          <I size={13} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="t-micro" style={{ color: accent }}>
          {label}
        </span>
      </span>
      {right}
    </div>
  );
}

type Tone = 'neutral' | 'primary' | 'good' | 'watch' | 'bad' | 'info' | 'math' | 'english';
const PILL: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border border-line',
  primary: 'bg-accent-tint text-accent',
  good: 'bg-good-tint text-good',
  watch: 'bg-watch-tint text-watch',
  bad: 'bg-bad-tint text-bad',
  info: 'bg-info-tint text-info',
  math: 'bg-math-tint text-math',
  english: 'bg-english-tint text-english',
};

/** A small rounded label: a status, a subject, a count. */
export function Pill({ tone = 'neutral', children, solid = false, className = '' }: { tone?: Tone; children: ReactNode; solid?: boolean; className?: string }) {
  const solidClass: Partial<Record<Tone, string>> = { primary: 'bg-primary text-on-primary', bad: 'bg-[#b02440] text-white', info: 'bg-[#2563eb] text-white', good: 'bg-fill-good text-white' };
  return <span className={`inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[12px] font-bold ${solid ? (solidClass[tone] ?? PILL[tone]) : PILL[tone]} ${className}`}>{children}</span>;
}

/** Segmented tabs in a pill-shaped track, each with an optional count. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex gap-[3px] rounded-full border border-line bg-surface-2 p-[3px]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150 ${on ? 'bg-accent-tint text-accent' : 'text-ink-2 hover:text-ink'}`}>
            {o.label}
            {o.count != null && <span className={`tabular ${on ? 'text-accent' : 'text-ink-3'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A big number with a small label: dashboards and result headers. */
export function Stat({ value, label, size = 28, className = '' }: { value: ReactNode; label: ReactNode; size?: number; className?: string }) {
  return (
    <div className={className}>
      <p className="t-number leading-none text-ink" style={{ fontSize: size }}>
        {value}
      </p>
      <p className="t-footnote mt-1 text-ink-2">{label}</p>
    </div>
  );
}

/** A thin progress bar (0–1). */
export function Progress({ value, tone = 'primary', className = '' }: { value: number; tone?: 'primary' | 'good' | 'info' | 'watch'; className?: string }) {
  const fill = { primary: 'bg-primary', good: 'bg-fill-good', info: 'bg-[#2563eb]', watch: 'bg-fill-watch' }[tone];
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-track ${className}`} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${fill} transition-[width] duration-500`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

/** A centred modal over a dimmed, blurred page; Escape or the × closes it. */
export function Modal({ title, subtitle, onClose, children, footer, width = 560 }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  const dialog = useDialog<HTMLDivElement>(onClose);
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
  }, []);
  return (
    <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-[8px] sm:items-center" onClick={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="pop flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden rounded-panel bg-surface outline-none"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5">
          <div>
            <h2 className="text-[22px] font-semibold leading-7 tracking-[-0.02em] text-title">{title}</h2>
            {subtitle && <p className="t-subhead mt-1 text-ink-2">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-chip text-ink-2 hover:bg-surface-2 hover:text-ink">
            <X size={19} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pb-5 pt-2">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2.5 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

/** A pill-shaped action: the primary purple CTA ("Let’s start!") or an outline one. */
export function Action({ children, onClick, variant = 'primary', className = '', disabled, type = 'button', icon: I }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'outline' | 'dark'; className?: string; disabled?: boolean; type?: 'button' | 'submit'; icon?: LucideIcon }) {
  const look = {
    primary: 'lift bg-primary text-on-primary hover:bg-primary-hover',
    outline: 'border border-line-strong bg-surface text-ink hover:bg-surface-2',
    dark: 'lift bg-ink text-surface',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex h-10 items-center justify-center gap-2 rounded-control px-4 text-[14px] font-bold disabled:cursor-default disabled:opacity-45 ${look} ${className}`}>
      {children}
      {I && <I size={16} strokeWidth={2.2} aria-hidden="true" />}
    </button>
  );
}
