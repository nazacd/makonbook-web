import { Bell, ChevronLeft, ChevronRight, Inbox, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import type { Group, Profile } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { ScoreChange } from '@/components/practice/ScoreChange';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { groupTitle, TeacherGroupRow } from '@/components/TeacherGroupRow';
import { ScreenTitle } from '@/layouts/AppShell';
import { useNow } from '@/lib/clock';
import { normalCase } from '@/lib/groups';
import { SUBJECT_LABEL, SUBJECT_SHORT, testName } from '@/lib/practice/run';
import { practicedSince, useGroupPractice, useLastVisit, useMarkVisited, usePracticeSummary, type FreshResult, type GroupSummary } from '@/lib/practice/summary';
import type { GroupStudent, ServerAttempt } from '@/lib/practice/types';
import { addDays, formatDate, lastClass, pastDay, relativeDay, schoolClock, schoolDate } from '@/lib/schedule';
import { useTitle } from '@/lib/title';

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "since 14:20", "since yesterday", "since Monday", "since Mon, 12 Oct". */
function sinceLabel(since: number, now: number): string {
  const day = schoolDate(since);
  const today = schoolDate(now);
  if (day === today) return `since ${schoolClock(since)}`;
  if (day === addDays(today, -1)) return 'since yesterday';
  if (day >= addDays(today, -6)) return `since ${WEEKDAY[new Date(`${day}T00:00:00Z`).getUTCDay()]}`;
  return `since ${formatDate(day)}`;
}

// The teacher's Practice tab (the phone's TeacherPractice): what came in
// since the last visit, then each group with how many of its students have
// practised. "New" is new since the tab was last left for another tab, so
// results stay marked until they've been seen.
export function TeacherPractice() {
  useTitle('Practice');
  const profile = useMe().data as Profile;
  const now = useNow();
  const since = useLastVisit();
  const markVisited = useMarkVisited();
  const summary = usePracticeSummary(profile.groups, since, now);
  useEffect(() => () => markVisited(), [markVisited]);
  const fresh = summary.fresh.length;
  return (
    <div className="mx-auto w-full max-w-xl">
      {fresh > 0 && since != null && (
        <Link to="/practice/new" className="-mx-5 mb-2 flex min-h-[52px] items-center gap-3 px-5 active:bg-surface-2">
          <Icon as={Bell} size={20} className="text-accent" />
          <span className="t-body flex-1 font-medium text-ink">
            {fresh} new {fresh === 1 ? 'result' : 'results'} {sinceLabel(since, now)}
          </span>
          <Icon as={ChevronRight} size={18} className="text-ink-3" />
        </Link>
      )}
      {profile.groups.length === 0 ? (
        <EmptyState icon={Users} title="No groups yet" message="Your groups appear here once you teach one in HolliHop." />
      ) : (
        profile.groups.map((g, i) => <GroupRow key={g.id} group={g} summary={summary.groups[g.id]} now={now} first={i === 0} />)
      )}
    </div>
  );
}

function GroupRow({ group, summary, now, first }: { group: Group; summary?: GroupSummary; now: number; first: boolean }) {
  const fresh = summary?.fresh.length ?? 0;
  const practiced = summary?.practiced && summary.since != null ? { count: summary.practiced, day: pastDay(summary.since, now) } : null;
  return (
    <TeacherGroupRow
      group={group}
      first={first}
      to={`/practice/group/${group.id}`}
      details={[practiced && summary && `${practiced.count} of ${summary.students} practiced since ${pastDay(summary.since!, now, true)}`, fresh > 0 && `${fresh} new`].filter(Boolean).join(', ')}
      right={
        summary &&
        (practiced || fresh > 0) && (
          <span className="flex flex-col items-end gap-1">
            {practiced && (
              <span className="t-subhead tabular font-semibold text-ink">
                {practiced.count}/{summary.students}
                <span className="t-footnote font-normal text-ink-3"> since {practiced.day}</span>
              </span>
            )}
            {fresh > 0 && <span className="t-subhead font-semibold text-accent">{fresh} new</span>}
          </span>
        )
      }
    />
  );
}

// The results that came in since the teacher last left the Practice tab,
// newest first; each opens its group with the student's attempts open.
export function NewResults() {
  useTitle('New results');
  const profile = useMe().data as Profile;
  const now = useNow();
  const since = useLastVisit();
  const summary = usePracticeSummary(profile.groups, since, now);
  const titles = new Map(profile.groups.map((g) => [g.id, groupTitle(g)]));
  return (
    <div className="mx-auto w-full max-w-xl">
      <BackLink to="/practice" label="Practice" />
      <ScreenTitle title="New results" />
      {summary.fresh.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing new" message="New practice results from your groups show up here." />
      ) : (
        <ul>
          {summary.fresh.map((r, i) => (
            <ResultRow key={r.attempt.id} result={r} group={titles.get(r.groupId) ?? ''} now={now} first={i === 0} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultRow({ result, group, now, first }: { result: FreshResult; group: string; now: number; first: boolean }) {
  const { student, attempt, previousTotal } = result;
  const name = normalCase(`${student.first_name} ${student.last_name}`);
  const at = Date.parse(attempt.finished_at);
  const when = schoolDate(at) === schoolDate(now) ? schoolClock(at) : formatDate(schoolDate(at));
  const section = attempt.total == null ? attempt.sections[0] : null;
  const score = section ? attempt.scores[section]?.score : attempt.total;
  const change = attempt.total != null && previousTotal != null ? attempt.total - previousTotal : 0;
  const what = testName(attempt.title);
  return (
    <li className={first ? '' : 'border-t border-line'}>
      <Link to={`/practice/group/${result.groupId}?student=${student.client_id}`} className="-mx-5 flex min-h-[68px] items-center gap-3 px-5 py-2.5 active:bg-surface-2" aria-label={`${name}, ${group}, ${what}, ${section ? `${SUBJECT_SHORT[section]} ${score}` : score}${change ? `, ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}` : ''}, ${when}`}>
        <Avatar kind="student" firstName={student.first_name} lastName={student.last_name} id={student.client_id} size={36} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="t-body truncate text-ink">{name}</span>
          <span className="t-footnote truncate text-ink-3">
            {group} · {what} · {when}
          </span>
        </span>
        {section ? (
          <span className="t-subhead tabular text-ink-2">
            {SUBJECT_SHORT[section]} {score}
          </span>
        ) : (
          <span className="flex items-baseline gap-2">
            <ScoreChange change={change} />
            <span className="font-title tabular text-[22px] font-bold leading-7 text-ink">{score}</span>
          </span>
        )}
      </Link>
    </li>
  );
}

const isFull = (a: ServerAttempt) => a.total != null;

/** What a student's row shows: their latest full test (with the change since the one before), else their latest section. */
function standing(s: GroupStudent) {
  const fulls = s.attempts.filter(isFull); // newest first
  const latest = s.attempts[0];
  if (fulls[0]) return { latest, full: fulls[0].total!, change: fulls[1] ? fulls[0].total! - fulls[1].total! : 0, section: null };
  const subject = latest?.sections[0];
  return { latest, full: null, change: 0, section: latest && subject ? `${SUBJECT_SHORT[subject]} ${latest.scores[subject]?.score}` : null };
}

// A group's practice: how many practised since the last lesson, then every
// student by their latest result.
export function GroupPractice() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const query = useGroupPractice(id);
  const [open, setOpen] = useState<number | null>(params.get('student') ? Number(params.get('student')) : null);
  const students = query.data ?? [];
  const now = useNow();
  const visit = useLastVisit();
  const group = useMe().data?.groups.find((g) => String(g.id) === id);
  const title = group ? groupTitle(group) : 'Practice';
  useTitle(`${title} · Practice`);
  const lesson = group ? lastClass(group, now) : null;
  const tried = students.filter((s) => s.attempts.length > 0).sort((a, b) => b.attempts[0]!.finished_at.localeCompare(a.attempts[0]!.finished_at));
  const untried = students.filter((s) => s.attempts.length === 0);
  return (
    <div className="mx-auto w-full max-w-xl">
      <BackLink to="/practice" label="Practice" />
      <ScreenTitle title={title} />
      {query.isPending ? (
        <RowsSkeleton />
      ) : query.isError ? (
        <ErrorState title="Couldn’t load the results" message={describeError(query.error)} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : students.length === 0 ? (
        <EmptyState icon={Users} title="No students yet" message="Students show up here once the office adds them to this group." />
      ) : (
        <>
          {lesson && (
            <p className="mb-4 flex items-baseline gap-3" aria-label={`${practicedSince(students, lesson.end)} of ${students.length} practiced since ${pastDay(lesson.end, now, true)}’s lesson`}>
              <span className="font-title tabular text-[44px] font-bold leading-[50px] text-ink">
                {practicedSince(students, lesson.end)}
                <span className="text-[24px] font-semibold text-ink-3"> / {students.length}</span>
              </span>
              <span className="t-subhead flex-1 text-ink-2">practiced since {pastDay(lesson.end, now, true)}’s lesson</span>
            </p>
          )}
          <ul>
            {tried.map((s, i) => (
              <StudentRow key={s.client_id} student={s} now={now} fresh={visit != null && Date.parse(s.attempts[0]!.finished_at) > visit} first={i === 0} open={open === s.client_id} onToggle={() => setOpen(open === s.client_id ? null : s.client_id)} />
            ))}
          </ul>
          {untried.length > 0 && (
            <div className={tried.length ? 'mt-6' : ''}>
              <p className="t-subhead mb-0.5 text-ink-3">No tests yet</p>
              <ul>
                {untried.map((s, i) => (
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

function StudentRow({ student: s, now, fresh, first, open, onToggle }: { student: GroupStudent; now: number; fresh: boolean; first: boolean; open: boolean; onToggle: () => void }) {
  const name = normalCase(`${s.first_name} ${s.last_name}`);
  const { latest, full, change, section } = standing(s);
  const latestLine = latest ? `${testName(latest.title)} · ${relativeDay(Date.parse(latest.finished_at), now)}` : '';
  return (
    <li className={first ? '' : 'border-t border-line'}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${name}${fresh ? ', new' : ''}, ${latestLine}, ${full != null ? `${full}${change ? `, ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}` : ''}` : section}`} className="-mx-5 flex min-h-16 w-[calc(100%+40px)] items-center gap-3 px-5 py-2 text-left active:bg-surface-2">
        <Avatar kind="student" firstName={s.first_name} lastName={s.last_name} id={s.client_id} size={36} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="t-body truncate text-ink">{name}</span>
            {fresh && <span className="size-2 shrink-0 rounded-full bg-accent" />}
          </span>
          <span className="t-footnote truncate text-ink-3">{latestLine}</span>
        </span>
        {full != null ? (
          <span className="flex items-baseline gap-2">
            <ScoreChange change={change} />
            <span className="font-title tabular text-[22px] font-bold leading-7 text-ink">{full}</span>
          </span>
        ) : (
          <span className="t-subhead tabular text-ink-2">{section}</span>
        )}
      </button>
      {open && <History attempts={s.attempts} now={now} />}
    </li>
  );
}

// Every attempt, hanging from the avatar on a thin rail like the student's
// path: a filled node for a full test, a ring for one section.
function History({ attempts, now }: { attempts: ServerAttempt[]; now: number }) {
  return (
    <ul className="relative -mt-1 mb-2 ml-[17px] pl-[31px]">
      <span className="absolute bottom-[26px] left-0 top-0 w-0.5 bg-line-strong" />
      {attempts.map((a) => {
        const full = isFull(a);
        const subject = a.sections[0]!;
        const when = relativeDay(Date.parse(a.finished_at), now);
        const detail = full ? `${when} · ${a.sections.map((x) => `${SUBJECT_SHORT[x]} ${a.scores[x]?.score}`).join(' · ')}` : `${when} · ${a.scores[subject]?.raw} of ${a.scores[subject]?.questions} right`;
        return (
          <li key={a.id} className="relative flex min-h-[52px] items-center gap-3" aria-label={`${testName(a.title)}, ${full ? 'full test' : SUBJECT_LABEL[subject]}, ${detail}, ${full ? a.total : `${SUBJECT_SHORT[subject]} ${a.scores[subject]?.score}`}`}>
            <span className={`absolute -left-[35px] size-2.5 rounded-full ${full ? 'bg-primary' : 'border-2 border-line-strong bg-brand'}`} />
            <span className="flex flex-1 flex-col">
              <span className="t-subhead text-ink">
                {testName(a.title)} · {full ? 'Full test' : SUBJECT_LABEL[subject]}
              </span>
              <span className="t-caption tabular font-normal text-ink-3">{detail}</span>
            </span>
            {full ? <span className="font-title tabular text-[18px] font-bold text-ink">{a.total}</span> : <span className="t-subhead tabular text-ink-2">{a.scores[subject]?.score}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="t-subhead -ml-1 mb-4 inline-flex h-10 items-center gap-1 rounded-chip pr-2 text-accent">
      <Icon as={ChevronLeft} size={18} className="text-accent" />
      {label}
    </Link>
  );
}

export function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton width={140} height={44} />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton width={36} height={36} radius={18} />
          <div className="flex-1">
            <Skeleton height={18} />
          </div>
        </div>
      ))}
    </div>
  );
}
