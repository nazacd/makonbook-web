import { Users } from 'lucide-react';
import { useParams } from 'react-router';

import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
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
  return (
    <div className="mx-auto w-full max-w-xl">
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
  const line = `${day[0]!.toUpperCase()}${day.slice(1)} · ${s.reviews_week ? `${s.reviews_week} ${s.reviews_week === 1 ? 'review' : 'reviews'} this week` : 'none this week'}`;
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
