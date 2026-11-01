import { ArrowDown, ArrowUp } from 'lucide-react';

import { Icon } from '@/components/Icon';

/** "↑160" in green or "↓40" in terracotta, beside a full-test score; nothing when there's no change. */
export function ScoreChange({ change }: { change: number }) {
  if (!change) return null;
  const tone = change > 0 ? 'text-good' : 'text-bad';
  return (
    <span className={`flex items-center ${tone}`} aria-label={`${change > 0 ? 'up' : 'down'} ${Math.abs(change)}`}>
      <Icon as={change > 0 ? ArrowUp : ArrowDown} size={13} strokeWidth={2.75} className="text-current" />
      <span className="font-title tabular text-[14px] font-bold">{Math.abs(change)}</span>
    </span>
  );
}
