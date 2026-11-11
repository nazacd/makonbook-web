import { Gamepad2, Library, ShieldAlert, Users } from 'lucide-react';
import { Link } from 'react-router';
import { useParams } from 'react-router';

import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { useDecksToCheck, useGroupGames } from '@/api/vocabSocial';
import { GAMES, clock } from '@/lib/vocab/games';
import type { Profile } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { EmptyState, ErrorState } from '@/components/States';
import { groupTitle, TeacherGroupRow } from '@/components/TeacherGroupRow';
import { ScreenTitle } from '@/layouts/AppShell';
import { useNow } from '@/lib/clock';
import { normalCase } from '@/lib/groups';
import { relativeDay } from '@/lib/schedule';
import { useTitle } from '@/lib/title';
import { useGroupVocab, useVocabSummary } from '@/lib/vocab/summary';
import type { GroupVocabStudent } from '@/lib/vocab/types';

import { BackLink, RowsSkeleton } from './TeacherPractice';

// The teacher's Words tab: each group with how many of its students studied
// words this week, each opening the group's progress.
export function TeacherWords() {
  useTitle('Words');
  const profile = useMe().data as Profile;
  const summary = useVocabSummary(profile.groups.map((g) => g.id));
  const toCheck = useDecksToCheck();
  const waiting = toCheck.data?.filter((d) => !d.hidden).length ?? 0;
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-5 grid gap-2.5 sm:grid-cols-2">
        <Link to="/words/decks" className="flex items-center gap-3 rounded-card border border-line bg-surface p-3.5 hover:border-primary/40">
          <span className="flex size-10 items-center justify-center rounded-[12px] bg-accent-tint text-accent">
            <Library size={19} aria-hidden="true" />
          </span>
          <span>
            <span className="t-headline block text-ink">Students’ decks</span>
            <span className="t-footnote text-ink-2">What students made and shared</span>
          </span>
        </Link>
        <Link to="/words/decks?tab=moderation" className="flex items-center gap-3 rounded-card border border-line bg-surface p-3.5 hover:border-primary/40">
          <span className={`flex size-10 items-center justify-center rounded-[12px] ${waiting ? 'bg-bad-tint text-bad' : 'bg-surface-2 text-ink-3'}`}>
            <ShieldAlert size={19} aria-hidden="true" />
          </span>
          <span>
            <span className="t-headline block text-ink">To check {waiting > 0 && <span className="tabular text-bad">{waiting}</span>}</span>
            <span className="t-footnote text-ink-2">{waiting ? 'Reported decks wait for a look' : 'No reported decks'}</span>
          </span>
        </Link>
      </div>
      {profile.groups.length === 0 ? (
        <EmptyState icon={Users} title="No groups yet" message="Your groups appear here once you teach one in HolliHop." />
      ) : (
        profile.groups.map((g, i) => {
          const s = summary.groups[g.id];
          return (
            <TeacherGroupRow
              key={g.id}
              group={g}
              first={i === 0}
              to={`/words/group/${g.id}`}
              details={s && s.studied > 0 && `${s.studied} of ${s.students} studied this week`}
              right={
                s &&
                s.studied > 0 && (
                  <span className="flex flex-col items-end">
                    <span className="t-subhead tabular font-semibold text-ink">
                      {s.studied}/{s.students}
                    </span>
                    <span className="t-footnote text-ink-3">this week</span>
                  </span>
                )
              }
            />
          );
        })
      )}
    </div>
  );
}

// A group's vocabulary: how many studied this week, then every student by
// when they last studied, with the words they've learned.
export function GroupVocab({ groupId }: { groupId?: string } = {}) {
  const now = useNow();
  const params = useParams();
  const id = groupId ?? params.id ?? '';
  const embedded = groupId != null;
  const query = useGroupVocab(id);
  const group = useMe().data?.groups.find((g) => String(g.id) === id);
  const title = group ? groupTitle(group) : 'Words';
  useTitle(embedded ? null : `${title} · Words`);
  const students = query.data?.students ?? [];
  const started = students.filter((s) => s.last_review).sort((a, b) => b.last_review!.localeCompare(a.last_review!));
  const notStarted = students.filter((s) => !s.last_review);
  const studied = students.filter((s) => s.reviews_week > 0).length;
  return (
    <div className={embedded ? 'w-full max-w-xl' : 'mx-auto w-full max-w-xl'}>
      {!embedded && <BackLink to="/words" label="Words" />}
      {!embedded && <ScreenTitle title={title} />}
      {query.isPending ? (
        <RowsSkeleton />
      ) : query.isError ? (
        <ErrorState title="Couldn’t load the progress" message={describeError(query.error)} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : students.length === 0 ? (
        <EmptyState icon={Users} title="No students yet" message="Students show up here once the office adds them to this group." />
      ) : (
        <>
          <p className="mb-4 flex items-baseline gap-3" aria-label={`${studied} of ${students.length} studied this week`}>
            <span className="font-title tabular text-[44px] font-bold leading-[50px] text-ink">
              {studied}
              <span className="text-[24px] font-semibold text-ink-3"> / {students.length}</span>
            </span>
            <span className="t-subhead flex-1 text-ink-2">studied this week</span>
          </p>
          <ul>
            {started.map((s, i) => (
              <StudentRow key={s.client_id} student={s} now={now} first={i === 0} />
            ))}
          </ul>
          <RecentGames groupId={id} />
          {notStarted.length > 0 && (
            <div className={started.length ? 'mt-6' : ''}>
              <p className="t-subhead mb-0.5 text-ink-3">Hasn’t started</p>
              <ul>
                {notStarted.map((s, i) => (
                  <li key={s.client_id} className={`flex min-h-14 items-center gap-3 ${i ? 'border-t border-line' : ''}`}>
                    <span className="opacity-70">
                      <Avatar kind="student" firstName={s.first_name} lastName={s.last_name} id={s.client_id} size={36} />
                    </span>
                    <span className="t-body text-ink-2">{normalCase(`${s.first_name} ${s.last_name}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StudentRow({ student: s, now, first }: { student: GroupVocabStudent; now: number; first: boolean }) {
  const name = normalCase(`${s.first_name} ${s.last_name}`);
  const day = relativeDay(Date.parse(s.last_review!), now);
  const extra = s as GroupVocabStudent & { games_week?: number; points_month?: number };
  const games = extra.games_week ? ` · ${extra.games_week} ${extra.games_week === 1 ? 'game' : 'games'}` : '';
  const points = extra.points_month ? ` · ${extra.points_month} pts this month` : '';
  const line = `${day[0]!.toUpperCase()}${day.slice(1)} · ${s.reviews_week ? `${s.reviews_week} ${s.reviews_week === 1 ? 'review' : 'reviews'} this week` : 'none this week'}${games}${points}`;
  return (
    <li className={`flex min-h-16 items-center gap-3 py-2 ${first ? '' : 'border-t border-line'}`} aria-label={`${name}, last studied ${day}, ${s.reviews_week} reviews this week, ${s.learned} words learned`}>
      <Avatar kind="student" firstName={s.first_name} lastName={s.last_name} id={s.client_id} size={36} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="t-body truncate text-ink">{name}</span>
        <span className="t-footnote truncate text-ink-3">{line}</span>
      </span>
      <span className="flex flex-col items-end">
        <span className="font-title tabular text-[22px] font-bold leading-[26px] text-ink">{s.learned}</span>
        <span className="t-caption font-normal text-ink-3">learned</span>
      </span>
    </li>
  );
}

// The latest word games the group's students played, each with the words they missed.
function RecentGames({ groupId }: { groupId: string }) {
  const games = useGroupGames(groupId);
  const list = games.data ?? [];
  if (list.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="t-subhead mb-1 flex items-center gap-1.5 text-ink-3">
        <Gamepad2 size={15} aria-hidden="true" /> Recent games
      </h2>
      <ul>
        {list.slice(0, 15).map((g, i) => {
          const name = normalCase(`${g.first_name} ${g.last_name}`);
          const result = g.game === 'pairs' ? `${clock(g.duration_ms + g.mistakes * 5000)}, ${g.mistakes} wrong` : `${g.score}/${g.total}`;
          return (
            <li key={g.id} className={`py-2.5 ${i ? 'border-t border-line' : ''}`}>
              <p className="flex items-baseline justify-between gap-3">
                <span className="t-body truncate text-ink">
                  {name} <span className="t-footnote text-ink-3">· {GAMES[g.game].title}</span>
                </span>
                <span className="t-subhead tabular shrink-0 font-semibold text-ink">{result}</span>
              </p>
              {g.missed.length > 0 && <p className="t-footnote mt-0.5 text-ink-2">Missed: {g.missed.map((w) => w.word).join(', ')}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
