import { ChevronLeft, Crown, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { useLeaderboard, type BoardEntry } from '@/api/vocabSocial';
import { Avatar } from '@/components/Avatar';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { PageHeader, Segmented } from '@/components/ui';
import { useTitle } from '@/lib/title';

type Scope = 'groups' | 'all';

/** "November" from "2026-11". */
export function monthName(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
}

// The month's vocabulary leaderboard (spec 11.5). Enrolled students choose
// between their groups and everyone; free accounts see everyone. Points: a
// point for each word reviewed on a day, and 2 for each right answer in a game.
export function Leaderboard() {
  useTitle('Leaderboard');
  const me = useMe().data;
  const enrolled = me?.kind === 'student' && me.status !== 'registered';
  const [scope, setScope] = useState<Scope>(enrolled ? 'groups' : 'all');
  const board = useLeaderboard(enrolled ? scope : 'all');
  const data = board.data;

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <Link to="/words" className="t-subhead -ml-1 mb-3 inline-flex h-10 items-center gap-1 rounded-chip pr-2 text-accent">
        <ChevronLeft size={18} aria-hidden="true" /> Vocabulary
      </Link>
      <PageHeader
        icon={Trophy}
        title="Leaderboard"
        subtitle={data ? `${monthName(data.month)} · ${data.learners} ${data.learners === 1 ? 'learner' : 'learners'}` : 'This month'}
        actions={
          enrolled ? (
            <Segmented<Scope>
              label="Whose board"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'groups', label: 'My groups' },
                { value: 'all', label: 'Everyone' },
              ]}
            />
          ) : undefined
        }
      />
      <p className="t-footnote -mt-2 mb-5 text-ink-2">A point for each word you review in a day, and 2 for each right answer in a game (up to 100 a day from games). It starts again on the 1st.</p>
      {board.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton height={190} radius={20} />
          <Skeleton height={56} radius={12} />
          <Skeleton height={56} radius={12} />
        </div>
      ) : board.isError ? (
        <ErrorState title="Couldn’t load the board" message={describeError(board.error)} onRetry={() => void board.refetch()} retrying={board.isFetching} />
      ) : data!.entries.length === 0 ? (
        <EmptyState icon={Trophy} title="Nobody on the board yet" message="Study a few words or play a game: the first points of the month put you at the top." />
      ) : (
        <>
          <Podium entries={data!.entries.slice(0, 3)} />
          <ol className="mt-4 overflow-hidden rounded-card border border-line bg-surface">
            {data!.entries.slice(3).map((e, i) => (
              <Row key={`${e.rank}-${e.name}-${i}`} entry={e} first={i === 0} />
            ))}
          </ol>
          {data!.me && data!.me.rank > data!.entries.length && (
            <div className="mt-3 overflow-hidden rounded-card border border-primary/40 bg-surface">
              <Row entry={data!.me} first />
            </div>
          )}
          {!data!.me && me?.kind === 'student' && <p className="t-subhead mt-4 text-center text-ink-2">You’re not on the board yet this month. Study a few words to join in.</p>}
        </>
      )}
    </div>
  );
}

function nameParts(name: string) {
  const [first = '', ...rest] = name.split(' ');
  return { first, last: rest.join(' ') };
}

function Row({ entry: e, first }: { entry: BoardEntry; first: boolean }) {
  const n = nameParts(e.name);
  return (
    <li className={`flex min-h-14 items-center gap-3 px-4 py-2 ${first ? '' : 'border-t border-line'} ${e.me ? 'bg-accent-tint' : ''}`} aria-label={`${e.rank}. ${e.name}${e.me ? ' (you)' : ''}, ${e.points} points`}>
      <span className="t-subhead tabular w-7 text-center font-bold text-ink-2">{e.rank}</span>
      <Avatar kind="student" firstName={n.first} lastName={n.last} id={e.rank * 7 + e.name.length} size={34} photo={e.photo_url} />
      <span className={`t-body min-w-0 flex-1 truncate ${e.me ? 'font-bold text-accent' : 'text-ink'}`}>
        {e.name}
        {e.me && ' (you)'}
      </span>
      <span className="t-subhead tabular font-bold text-ink">{e.points.toLocaleString('en-US')}</span>
      <span className="t-footnote text-ink-3">pts</span>
    </li>
  );
}

const PLACE = [
  { h: 'h-[118px]', medal: 'bg-[#e8b923] text-[#3d2c00]', order: 'order-2' },
  { h: 'h-[88px]', medal: 'bg-[#c4ccd6] text-[#253041]', order: 'order-1' },
  { h: 'h-[68px]', medal: 'bg-[#d08a52] text-[#3b1d06]', order: 'order-3' },
];

/** The first three on steps, the winner in the middle. */
function Podium({ entries }: { entries: BoardEntry[] }) {
  return (
    <section aria-label="The top three" className="vocab-hero rounded-panel px-4 pb-0 pt-6 text-white">
      <div className="mx-auto grid max-w-[460px] grid-cols-3 items-end gap-3">
        {entries.map((e, i) => {
          const p = PLACE[i]!;
          const n = nameParts(e.name);
          return (
            <div key={`${e.rank}-${e.name}`} className={`flex flex-col items-center ${p.order}`}>
              {i === 0 && <Crown size={22} className="mb-1 text-[#f5cf4a]" aria-hidden="true" />}
              <span className={`rounded-full p-[3px] ${e.me ? 'bg-white' : 'bg-white/25'}`}>
                <Avatar kind="student" firstName={n.first} lastName={n.last} id={e.rank * 7 + e.name.length} size={i === 0 ? 60 : 48} photo={e.photo_url} />
              </span>
              <span className="mt-1.5 max-w-full truncate text-[14px] font-bold">{e.me ? 'You' : e.name}</span>
              <span className="text-[12px] text-white/75 tabular">{e.points.toLocaleString('en-US')} pts</span>
              <span className={`mt-2 flex w-full items-start justify-center rounded-t-[14px] bg-white/15 pt-2 ${p.h}`}>
                <span className={`flex size-8 items-center justify-center rounded-full text-[15px] font-extrabold ${p.medal}`}>{e.rank}</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
