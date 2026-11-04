import { describeError } from '@/api/errors';
import { parkReasonLabel, useGroupParked } from '@/api/learning';
import { Skeleton } from '@/components/States';
import { useNow } from '@/lib/clock';
import { relativeDay, schoolClock, schoolDate } from '@/lib/schedule';

import { questionPlace } from './AskLater';

/** "14:05" today, "yesterday", or "12 Oct". */
function when(iso: string, now: number): string {
  const t = Date.parse(iso);
  return schoolDate(t) === schoolDate(now) ? schoolClock(t) : relativeDay(t, now);
}

// The teacher's view of "Ask later": what the group's students parked and
// haven't sorted out yet, newest first, with what went wrong and their note,
// so the class can go over it. For the group's page.
export function GroupParked({ groupId }: { groupId: number }) {
  const parked = useGroupParked(groupId);
  const now = useNow();
  const waiting = (parked.data ?? []).filter((p) => p.status === 'waiting').sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <section aria-labelledby={`parked-${groupId}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id={`parked-${groupId}`} className="t-headline text-ink">
          Problem questions
        </h2>
        {waiting.length > 0 && <span className="t-caption tabular font-semibold text-ink-3">{waiting.length} waiting</span>}
      </div>
      {parked.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton height={56} radius={12} />
          <Skeleton height={56} radius={12} />
        </div>
      ) : parked.isError ? (
        <p className="t-subhead text-ink-2" role="alert">
          {describeError(parked.error)}{' '}
          <button type="button" onClick={() => void parked.refetch()} className="font-semibold text-accent underline">
            Try again
          </button>
        </p>
      ) : waiting.length === 0 ? (
        <p className="t-subhead text-ink-3">Nothing waiting. Questions students park with Ask later during a test show here.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {waiting.map((p) => (
            <li key={p.id} className="flex flex-col gap-0.5 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="t-subhead min-w-0 truncate font-bold text-ink">
                  {p.student.first_name} {p.student.last_name}
                </p>
                <span className="t-caption tabular shrink-0 font-medium text-ink-3">{when(p.created_at, now)}</span>
              </div>
              <p className="t-footnote text-ink">
                {parkReasonLabel(p.reason)}
                <span className="text-ink-3"> · {questionPlace({ title: p.test, subject: p.subject, module: p.module, position: p.position }, true)}</span>
              </p>
              {p.note && <p className="t-footnote line-clamp-2 text-ink-2">“{p.note}”</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
