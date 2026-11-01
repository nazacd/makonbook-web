import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

import { Icon } from './Icon';

type PageRowProps = {
  icon: LucideIcon;
  label: string;
  value?: string;
  /** Opens a screen (a link), or does something (a button). */
  to?: string;
  onClick?: () => void;
  destructive?: boolean;
  /** Draws the hairline above this row (every row but the first in a run). */
  separator?: boolean;
};

// A row set straight on the page, no box: an icon, the label, an optional
// value, and a chevron when it opens a screen.
export function PageRow({ icon, label, value, to, onClick, destructive = false, separator = false }: PageRowProps) {
  const className = `-mx-2 flex min-h-[52px] w-[calc(100%+16px)] items-center gap-3.5 px-2 text-left active:bg-surface-2 ${separator ? 'border-t border-line' : 'rounded-chip'}`;
  const body = (
    <>
      <Icon as={icon} size={20} className={destructive ? 'text-bad' : 'text-ink-2'} />
      <span className={`t-body flex-1 ${destructive ? 'text-bad' : 'text-ink'}`}>{label}</span>
      {value !== undefined && <span className="t-subhead truncate text-ink-3">{value}</span>}
      {to && <Icon as={ChevronRight} size={18} className="text-ink-3" />}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}
