import { BookOpenCheck, CalendarClock, ClipboardCheck, Search, SearchX, Signpost, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';

import { KIND, useMyAssignments, useStartAssignment, type AssignmentKind } from '@/api/assignments';
import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { AssignmentCard, AssignmentCardSkeleton } from '@/components/assignments/AssignmentCard';
import { tabOf, type Tab } from '@/components/assignments/format';
import { Notice } from '@/components/Notice';
import { EmptyState, ErrorState } from '@/components/States';
import { PageHeader, Segmented } from '@/components/ui';
import { useTitle } from '@/lib/title';

// Homework, Level Checks and Exams (the design reference's assessment lists):
// what the student's teachers set, as cards under New / In progress / Passed,
// with a search. Homework and level checks open the assessment runner; an
// exam opens its mock test with the sections chosen.

export const KIND_ICON: Record<AssignmentKind, LucideIcon> = { homework: BookOpenCheck, level_check: ClipboardCheck, exam: CalendarClock };

const EMPTY: Record<Tab, string> = {
  new: 'Nothing new. Fresh work from your teachers lands here.',
  run: 'Nothing half-finished. Clean slate.',
  passed: 'Nothing passed yet. Your first result will land here.',
};

export function StudentAssignments({ kind }: { kind: AssignmentKind }) {
  const me = useMe().data;
  const k = KIND[kind];
  useTitle(k.plural);
  const navigate = useNavigate();
  const list = useMyAssignments(me?.kind === 'student');
  const start = useStartAssignment();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Tab | null>(null);
  if (me?.kind === 'teacher') return <Navigate to="/assignments" replace />;

  const mine = (list.data ?? []).filter((a) => a.kind === kind);
  const q = query.trim().toLowerCase();
  const shown = mine.filter((a) => !q || a.title.toLowerCase().includes(q) || a.group_name.toLowerCase().includes(q) || (a.lesson?.title ?? '').toLowerCase().includes(q));
  const by = (t: Tab) => shown.filter((a) => tabOf(a) === t);
  const tab: Tab = picked ?? (by('run').length ? 'run' : by('new').length || !by('passed').length ? 'new' : 'passed');
  const cards = by(tab);
  const noGroups = !!me && (me.status === 'registered' || me.groups.length === 0);

  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <PageHeader
        icon={KIND_ICON[kind]}
        title={k.plural}
        actions={
          !noGroups && (
            <>
              <label className="relative block w-full sm:w-64">
                <span className="sr-only">Search assessments</span>
                <Search size={16} strokeWidth={2} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search assessments"
                  className="h-[38px] w-full rounded-full border border-line bg-surface-2 pl-[38px] pr-4 text-[14px] font-medium text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-accent"
                />
              </label>
              <div className="max-w-full overflow-x-auto no-scrollbar">
                <Segmented
                  label={`Which ${k.plural.toLowerCase()}`}
                  value={tab}
                  onChange={setPicked}
                  options={[
                    { value: 'new', label: 'New', count: list.isPending ? undefined : by('new').length },
                    { value: 'run', label: 'In progress', count: list.isPending ? undefined : by('run').length },
                    { value: 'passed', label: 'Passed', count: list.isPending ? undefined : by('passed').length },
                  ]}
                />
              </div>
            </>
          )
        }
      />

      {start.isError && (
        <div className="mb-4">
          <Notice tone="error" title="Couldn’t start it" message={describeError(start.error)} />
        </div>
      )}

      {noGroups ? (
        <RoadmapPointer kind={kind} />
      ) : list.isPending ? (
        <Grid>
          {[0, 1, 2].map((i) => (
            <AssignmentCardSkeleton key={i} />
          ))}
        </Grid>
      ) : list.isError ? (
        <div className="mx-auto max-w-xl">
          <ErrorState title={`Couldn’t load your ${k.plural.toLowerCase()}`} message={describeError(list.error)} onRetry={() => void list.refetch()} retrying={list.isFetching} />
        </div>
      ) : cards.length === 0 ? (
        q ? <EmptyState icon={SearchX} title={`Nothing here matches “${query.trim()}”.`} message="Try another name, or another tab." /> : <EmptyState icon={KIND_ICON[kind]} title={EMPTY[tab]} />
      ) : (
        <Grid>
          {cards.map((a, i) => (
            <AssignmentCard
              key={a.id}
              a={a}
              index={i}
              starting={start.isPending && start.variables === a.id}
              onStart={() => start.mutate(a.id, { onSuccess: (x) => void navigate(`/assessments/${x.id}`) })}
            />
          ))}
        </Grid>
      )}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-[14px]">{children}</div>;
}

// Not in a SATMAKON group (yet): nobody sets work, so point to the roadmap,
// whose lessons each have a level check and homework.
function RoadmapPointer({ kind }: { kind: AssignmentKind }) {
  const what = kind === 'exam' ? 'Mock tests are open for you any time, and your roadmap checks every lesson.' : 'Meanwhile, every lesson on your roadmap has its own level check and homework.';
  return (
    <section className="rise mx-auto flex max-w-lg flex-col items-center rounded-card border border-line bg-surface px-6 py-10 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-accent-tint text-primary">
        <Signpost size={24} aria-hidden="true" />
      </span>
      <h2 className="t-title3 text-ink">Teachers set {KIND[kind].plural.toLowerCase()} for their groups</h2>
      <p className="t-subhead mt-2 text-ink-2">Once you study in a SATMAKON group, what your teachers set shows up here, with its deadline. {what}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        <Link to="/roadmaps" className="lift inline-flex h-10 items-center rounded-full bg-primary px-5 text-[14px] font-bold text-on-primary hover:bg-primary-hover">
          Open your roadmap
        </Link>
        {kind === 'exam' && (
          <Link to="/practice" className="inline-flex h-10 items-center rounded-full border border-line-strong px-5 text-[14px] font-bold text-ink hover:bg-surface-2">
            Mock tests
          </Link>
        )}
      </div>
    </section>
  );
}
