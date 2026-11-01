import { Clock, X, type LucideIcon } from 'lucide-react';

import type { AttendanceMark, MarkState } from '@/api/attendance';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { normalCase } from '@/lib/groups';

export const MARK_LABEL: Record<MarkState, string> = { pending: 'Not yet', present: 'Present', late: 'Late', absent: 'Absent' };

type Choice = 'present' | 'late' | 'absent';
const CHOICES: { state: Choice; icon?: LucideIcon; tone?: string }[] = [
  { state: 'present' },
  { state: 'late', icon: Clock, tone: 'text-watch' },
  { state: 'absent', icon: X, tone: 'text-bad' },
];

type MarkSheetProps = {
  mark: AttendanceMark;
  busy: boolean;
  error?: string | null;
  onChoose: (state: Choice) => void;
  onClose: () => void;
};

// A dialog for correcting one student's mark. The current mark is the
// highlighted row with a filled radio dot.
export function MarkSheet({ mark, busy, error, onChoose, onClose }: MarkSheetProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label={`Change the mark of ${normalCase(`${mark.first_name} ${mark.last_name}`)}`} className="flex w-full max-w-md flex-col gap-4 rounded-t-panel bg-surface px-5 pb-6 pt-3 sm:rounded-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1 w-9 rounded-full bg-line-strong sm:hidden" />
        <div className="flex items-center gap-3">
          <Avatar kind="student" firstName={mark.first_name} lastName={mark.last_name} id={mark.client_id} />
          <div className="min-w-0 flex-1">
            <p className="t-title3 truncate text-ink">{normalCase(`${mark.first_name} ${mark.last_name}`)}</p>
            <p className="t-footnote text-ink-3">{MARK_LABEL[mark.state]}</p>
          </div>
        </div>
        <div role="radiogroup" className="-mx-3 flex flex-col gap-0.5">
          {CHOICES.map(({ state, icon, tone }) => {
            const current = mark.state === state;
            return (
              <button
                key={state}
                type="button"
                role="radio"
                aria-checked={current}
                disabled={busy}
                onClick={() => (current ? onClose() : onChoose(state))}
                className={`flex min-h-14 items-center gap-3 rounded-[12px] px-3 text-left ${current ? 'bg-surface-2' : 'active:bg-line'}`}>
                {icon && tone ? <Icon as={icon} size={20} className={tone} /> : <span className="w-5" />}
                <span className={`t-body flex-1 text-ink ${current ? 'font-semibold' : ''}`}>{MARK_LABEL[state]}</span>
                <span className={`flex size-[22px] items-center justify-center rounded-full border-2 ${current ? 'border-accent' : 'border-line-strong'}`}>{current && <span className="size-2.5 rounded-full bg-accent" />}</span>
              </button>
            );
          })}
        </div>
        {error && <Notice tone="error" title="Couldn’t change the mark" message={error} />}
        <Button label="Cancel" variant="secondary" onClick={onClose} />
      </div>
    </div>
  );
}
