import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'plain' | 'destructive';

type ButtonProps = {
  label: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: Variant;
  /** Shows a spinner in place of the label and ignores presses. */
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
};

// Primary is SATMAKON purple, the one strong surface on a screen; it lifts a
// little on hover. Secondary is white with a border; plain and destructive
// are text. Responds on press (active), not only on release.
const SURFACE: Record<Variant, string> = {
  primary: 'lift h-[46px] rounded-card bg-primary px-6 text-on-primary hover:bg-primary-hover',
  secondary: 'h-[46px] rounded-card border border-line-strong bg-surface px-6 text-ink hover:bg-surface-2',
  plain: 'h-11 rounded-control px-4 text-accent hover:bg-surface-2',
  destructive: 'h-11 rounded-control px-4 text-bad hover:bg-bad-tint',
};

export function Button({ label, onClick, type = 'button', variant = 'primary', loading = false, disabled = false, className = '', icon }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={inactive}
      aria-busy={loading || undefined}
      className={`relative inline-flex items-center justify-center gap-2 transition-transform duration-150 active:scale-[0.97] motion-reduce:active:scale-100 disabled:cursor-default ${disabled && !loading ? 'opacity-40' : ''} ${SURFACE[variant]} ${className}`}>
      {icon}
      {/* The label keeps its space while loading so the button never changes size. */}
      <span className={`t-headline ${loading ? 'invisible' : ''}`}>{label}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center" aria-label="Loading">
          <Spinner />
        </span>
      )}
    </button>
  );
}

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin motion-reduce:animate-none ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
