import { CalendarClock, ChevronRight, Clock, Gift, ListChecks, Trophy, Users } from 'lucide-react';
import { Link } from 'react-router';

import { describeError } from '@/api/errors';
import { clock, untilWords, useCompetitions, type Competition } from '@/api/competitions';
import { dueLong } from '@/components/assignments/format';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { PageHeader, Pill } from '@/components/ui';
import { useFastNow, useNow } from '@/lib/clock';
import { useTitle } from '@/lib/title';

// "/competitions" (spec 26): what is on now, what is coming and what has
// ended. Every student with a phone can take part, once each.

export const SUBJECT_LABEL: Record<Competition['subject'], string> = { math: 'Math', english: 'Reading & Writing', mixed: 'Math + Reading & Writing' };
export const SUBJECT_TONE = { math: 'math', english: 'english', mixed: 'primary' } as const;

export function Competitions() {
  useTitle('Competitions');
  const q = useCompetitions();
  const now = useNow() + (q.data?.skew ?? 0);
  const list = q.data?.competitions ?? [];
  // The status is worked out here too, so a card moves on when its time comes.
  const status = (c: Competition) => statusAt(c, now);
  const live = list.filter((c) => status(c) === 'live');
  const upcoming = list.filter((c) => status(c) === 'upcoming').sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const ended = list.filter((c) => status(c) === 'ended');

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <PageHeader icon={Trophy} title="Competitions" subtitle="Timed contests on SAT questions. Everyone gets the same questions, and each student has one try." />
      {q.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton height={150} radius={16} />
          <Skeleton height={150} radius={16} />
        </div>
      ) : q.isError ? (
        <ErrorState title="Couldn’t load competitions" message={describeError(q.error)} onRetry={() => void q.refetch()} retrying={q.isFetching} />
      ) : list.length === 0 ? (
        <EmptyState icon={Trophy} title="No competitions yet" message="When SATMAKON announces one, it shows here, with its date and rules." />
      ) : (
        <div className="flex flex-col gap-8">
          {live.length > 0 && <Section title="Live now" list={live} skew={q.data.skew} />}
          {upcoming.length > 0 && <Section title="Coming up" list={upcoming} skew={q.data.skew} />}
          {ended.length > 0 && <Section title="Ended" list={ended} skew={q.data.skew} />}
        </div>
      )}
    </div>
  );
}

export function statusAt(c: Competition, now: number): Competition['status'] {
  if (!c.published) return 'draft';
  if (now < Date.parse(c.starts_at)) return 'upcoming';
  if (now < Date.parse(c.ends_at)) return 'live';
  return 'ended';
}

function Section({ title, list, skew }: { title: string; list: Competition[]; skew: number }) {
  return (
    <section>
      <h2 className="t-headline mb-3 text-ink">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((c) => (
          <CompetitionCard key={c.id} c={c} skew={skew} />
        ))}
      </div>
    </section>
  );
}

function CompetitionCard({ c, skew }: { c: Competition; skew: number }) {
  const now = useNow() + skew;
  const status = statusAt(c, now);
  const mine = c.mine;
  return (
    <Link to={`/competitions/${c.id}`} className="lift group flex flex-col rounded-card border border-line bg-surface p-[18px] hover:border-line-strong">
      <div className="flex items-center gap-2">
        <Pill tone={SUBJECT_TONE[c.subject]}>{SUBJECT_LABEL[c.subject]}</Pill>
        {status === 'live' && (
          <Pill tone="bad" solid>
            <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" /> Live
          </Pill>
        )}
        {mine?.finished && <Pill tone="good">Handed in</Pill>}
        {mine && !mine.finished && status === 'live' && <Pill tone="watch">In progress</Pill>}
      </div>
      <h3 className="mt-3 text-[19px] font-semibold leading-6 text-ink">{c.title}</h3>
      {c.prize && (
        <p className="t-subhead mt-1.5 flex items-start gap-1.5 text-ink-2">
          <Gift size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /> {c.prize}
        </p>
      )}
      <p className="t-footnote mt-3 flex flex-wrap gap-x-3.5 gap-y-1 text-ink-2">
        <span className="inline-flex items-center gap-1">
          <ListChecks size={14} aria-hidden="true" /> {c.questions} questions
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock size={14} aria-hidden="true" /> {c.minutes} min
        </span>
        {status !== 'upcoming' && (
          <span className="inline-flex items-center gap-1">
            <Users size={14} aria-hidden="true" /> {c.participants} taken part
          </span>
        )}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className="t-footnote text-ink-2">
          {status === 'upcoming' ? (
            <StartsIn at={Date.parse(c.starts_at)} skew={skew} />
          ) : status === 'live' ? (
            <>Ends {dueLong(c.ends_at)}</>
          ) : mine?.finished ? (
            <>
              You got <span className="font-bold text-ink">{mine.correct}</span> of {mine.total}
            </>
          ) : (
            <>Ended {dueLong(c.ends_at)}</>
          )}
        </span>
        <span className="t-subhead inline-flex items-center gap-0.5 font-semibold text-accent">
          {status === 'live' && !mine ? 'Take part' : status === 'live' && !mine?.finished ? 'Continue' : status === 'ended' ? 'Results' : 'Details'}
          <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

/** "Starts in 2 days" far off; a ticking clock in the last hour. */
export function StartsIn({ at, skew }: { at: number; skew: number }) {
  const now = useFastNow() + skew;
  const left = at - now;
  return (
    <span className="inline-flex items-center gap-1">
      <CalendarClock size={14} aria-hidden="true" />
      {left <= 0 ? (
        'Starting…'
      ) : left < 3_600_000 ? (
        <span className="tabular">Starts in {clock(left)}</span>
      ) : (
        <>
          Starts in {untilWords(left)} · {dueLong(new Date(at).toISOString())}
        </>
      )}
    </span>
  );
}
