import { ArrowLeft, Check, ChevronRight, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { useGroupRoadmap, useTeacherAssignments, type GroupRoadmap } from '@/api/assignments';
import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import type { Group } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { TeacherAssignmentRow } from '@/components/assignments/TeacherAssignmentRow';
import { Notice } from '@/components/Notice';
import { GroupParked } from '@/components/practice/GroupParked';
import { ToneBar } from '@/components/practice/cards/TestCard';
import { EmptyState, Skeleton } from '@/components/States';
import { groupTitle } from '@/components/TeacherGroupRow';
import { PageHeader, Segmented } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { dayLetters, normalCase, parseClassName } from '@/lib/groups';
import { useGroupPractice } from '@/lib/practice/summary';
import { useTitle } from '@/lib/title';
import { GroupPractice } from '@/screens/TeacherPractice';
import { GroupVocab } from '@/screens/TeacherWords';

// The teacher's groups, and each group's hub: its students, assignments,
// roadmap progress, mock tests, vocabulary and problem questions.

export function TeacherGroups() {
  useTitle('Groups');
  const groups = useMe().data?.groups ?? [];
  const assignments = useTeacherAssignments();
  const open = (g: Group) => (assignments.data ?? []).filter((a) => a.group_id === g.id && (a.status === 'open' || a.status === 'overdue')).length;
  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <PageHeader icon={Users} title="Groups" subtitle="Each group’s students, work and progress." />
      {groups.length === 0 ? (
        <EmptyState icon={Users} title="No groups yet" message="Your groups appear here once you teach one in HolliHop." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => {
            const name = parseClassName(g.name, g.discipline);
            const slot = g.schedule[0];
            const n = open(g);
            return (
              <li key={g.id}>
                <Link to={`/groups/${g.id}`} className="group flex h-full items-center gap-3.5 rounded-card border border-line bg-surface p-4 transition-colors hover:bg-surface-2">
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-[12px] text-[15px] font-bold ${name.subject === 'Math' ? 'bg-math-tint text-math' : name.subject === 'English' ? 'bg-english-tint text-english' : 'bg-surface-2 text-ink-2'}`}>
                    {name.subject === 'Math' ? 'M' : name.subject === 'English' ? 'RW' : '·'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="t-headline block truncate text-ink">{groupTitle(g)}</span>
                    <span className="t-footnote block truncate text-ink-2">{[g.office, slot && `${slot.begin_time} · ${dayLetters(slot.weekdays)}`].filter(Boolean).join(' · ')}</span>
                    {n > 0 && <span className="t-caption mt-1 block text-accent">{n} open {n === 1 ? 'assignment' : 'assignments'}</span>}
                  </span>
                  <ChevronRight size={17} className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type Tab = 'students' | 'assignments' | 'roadmap' | 'tests' | 'vocab' | 'parked';
const TABS: { value: Tab; label: string }[] = [
  { value: 'students', label: 'Students' },
  { value: 'assignments', label: 'Assignments' },
  { value: 'roadmap', label: 'Roadmap' },
  { value: 'tests', label: 'Mock tests' },
  { value: 'vocab', label: 'Vocabulary' },
  { value: 'parked', label: 'Problem questions' },
];

export function GroupHub() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const group = useMe().data?.groups.find((g) => String(g.id) === id);
  const tab = (TABS.find((t) => t.value === params.get('tab'))?.value ?? 'students') as Tab;
  useTitle(group ? groupTitle(group) : 'Group');
  if (!group)
    return (
      <div className="mx-auto max-w-xl">
        <Notice tone="error" message="This isn’t one of your groups." />
      </div>
    );
  const slot = group.schedule[0];
  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <Link to="/groups" className="t-subhead mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> Groups
      </Link>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.03em] text-title">{groupTitle(group)}</h1>
          <p className="t-subhead text-ink-2">{[group.discipline, group.office, slot && `${slot.begin_time}–${slot.end_time} · ${dayLetters(slot.weekdays)}`].filter(Boolean).join(' · ')}</p>
        </div>
        <Link to={`/assignments/new?group=${group.id}`} className="lift inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-[14px] font-bold text-on-primary hover:bg-primary-hover">
          <Plus size={17} strokeWidth={2.4} aria-hidden="true" /> New assignment
        </Link>
      </header>
      <div className="mb-5 max-w-full overflow-x-auto no-scrollbar">
        <Segmented label="Group sections" value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} options={TABS} />
      </div>
      {tab === 'students' && <Students groupId={group.id} />}
      {tab === 'assignments' && <GroupAssignments groupId={group.id} />}
      {tab === 'roadmap' && <RoadmapProgress groupId={group.id} />}
      {tab === 'tests' && <GroupPractice groupId={String(group.id)} />}
      {tab === 'vocab' && <GroupVocab groupId={String(group.id)} />}
      {tab === 'parked' && (
        <div className="max-w-2xl">
          <GroupParked groupId={group.id} />
        </div>
      )}
    </div>
  );
}

// Every student at a glance: the latest mock, and how far along the roadmap.
function Students({ groupId }: { groupId: number }) {
  const practice = useGroupPractice(String(groupId));
  const roadmap = useGroupRoadmap(groupId);
  if (practice.isPending) return <Skeleton height={240} radius={16} />;
  if (practice.isError) return <Notice tone="error" message={describeError(practice.error)} />;
  const students = practice.data ?? [];
  if (students.length === 0) return <EmptyState icon={Users} title="No students yet" message="Students show up here once the office adds them to this group." />;
  const progress = new Map((roadmap.data?.students ?? []).map((s) => [s.client_id, Object.values(s.courses)[0]]));
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {students.map((s) => {
        const full = s.attempts.find((a) => a.total != null);
        const latest = s.attempts[0];
        const p = progress.get(s.client_id);
        return (
          <li key={s.client_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="flex min-w-0 flex-1 basis-56 items-center gap-3">
              <Avatar kind="student" firstName={s.first_name} lastName={s.last_name} id={s.client_id} size={36} />
              <span className="t-subhead truncate font-semibold text-ink">{normalCase(`${s.first_name} ${s.last_name}`)}</span>
            </span>
            <span className="w-32">
              <span className="t-caption block font-normal text-ink-3">Latest mock</span>
              <span className="t-headline text-ink tabular">{full ? full.total : latest ? `${latest.sections[0] === 'math' ? 'Math' : 'R&W'} ${latest.scores[latest.sections[0]!]?.score}` : '—'}</span>
            </span>
            <span className="w-44">
              <span className="t-caption flex justify-between font-normal text-ink-3">
                <span>Roadmap</span>
                {p && (
                  <span className="tabular">
                    {p.lessons_done}/{p.lessons_total}
                  </span>
                )}
              </span>
              {p ? <ToneBar className="mt-1.5" value={p.lessons_total ? p.lessons_done / p.lessons_total : 0} color="var(--color-teal)" /> : <span className="t-footnote text-ink-3">—</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function GroupAssignments({ groupId }: { groupId: number }) {
  const list = useTeacherAssignments(groupId);
  const now = useNow();
  if (list.isPending) return <Skeleton height={200} radius={16} />;
  if (list.isError) return <Notice tone="error" message={describeError(list.error)} />;
  const all = [...(list.data ?? [])].sort((a, b) => Number(a.status === 'closed') - Number(b.status === 'closed') || b.due_at.localeCompare(a.due_at));
  if (all.length === 0) return <EmptyState icon={Users} title="Nothing set for this group yet" message="New assignment sets homework, a level check or an exam." />;
  return (
    <ul className="flex flex-col gap-2.5">
      {all.map((a) => (
        <TeacherAssignmentRow key={a.id} a={a} now={now} showGroup={false} />
      ))}
    </ul>
  );
}

// Students × lessons: who passed what, and where each one stands now.
function RoadmapProgress({ groupId }: { groupId: number }) {
  const q = useGroupRoadmap(groupId);
  const [courseIdx, setCourseIdx] = useState(0);
  if (q.isPending) return <Skeleton height={300} radius={16} />;
  if (q.isError) return <Notice tone="error" message={describeError(q.error)} />;
  const data: GroupRoadmap = q.data;
  if (data.courses.length === 0) return <EmptyState icon={Users} title="No roadmap for this group" message="Its discipline doesn’t name a curriculum course, or the course isn’t loaded yet." />;
  const course = data.courses[Math.min(courseIdx, data.courses.length - 1)]!;
  // Units as column groups.
  const units: { id: string; title: string; university: string; span: number }[] = [];
  for (const l of course.lessons) {
    const last = units[units.length - 1];
    if (last && last.id === l.unit_id) last.span++;
    else units.push({ id: l.unit_id, title: l.unit_title, university: l.university, span: 1 });
  }
  return (
    <div className="flex flex-col gap-3">
      {data.courses.length > 1 && <Segmented label="Course" value={String(courseIdx)} onChange={(v) => setCourseIdx(Number(v))} options={data.courses.map((c, i) => ({ value: String(i), label: c.title }))} />}
      <p className="t-footnote flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-2">
        <b className="text-ink">{course.title}</b>
        <Legend className="bg-fill-good" text="Done" />
        <Legend className="bg-watch-tint ring-1 ring-inset ring-fill-watch" text="Started (best %)" />
        <Legend className="bg-accent-tint ring-1 ring-inset ring-primary/40" text="Current" />
        <Legend className="bg-surface-2" text="Not yet" />
      </p>
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[180px] border-b border-line bg-surface px-3 py-2 text-left font-semibold text-ink-2">Unit</th>
              {units.map((u) => (
                <th key={u.id} colSpan={u.span} title={u.university} className="border-b border-l border-line px-2 py-2 text-left font-semibold text-ink-2">
                  <span className="block max-w-[200px] truncate">{u.title}</span>
                </th>
              ))}
              <th className="border-b border-l border-line px-3 py-2 text-right font-semibold text-ink-2">Done</th>
            </tr>
            <tr>
              <th className="sticky left-0 z-10 border-b border-line bg-surface px-3 py-1.5 text-left font-medium text-ink-3">Lesson</th>
              {course.lessons.map((l, i) => (
                <th key={l.id} title={l.title} className="border-b border-line px-1 py-1.5 text-center font-medium text-ink-3 tabular">
                  {i + 1}
                </th>
              ))}
              <th className="border-b border-l border-line" />
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => {
              const p = s.courses[course.id];
              return (
                <tr key={s.client_id}>
                  <td className="sticky left-0 z-10 border-b border-line bg-surface px-3 py-1.5">
                    <span className="t-footnote block max-w-[170px] truncate font-semibold text-ink">{normalCase(`${s.first_name} ${s.last_name}`)}</span>
                  </td>
                  {course.lessons.map((l, i) => {
                    const c = p?.lessons[i];
                    const current = p?.current_lesson_id === l.id;
                    const cls = !c ? 'bg-surface-2' : c.status === 'done' ? 'bg-fill-good text-white' : current ? 'bg-accent-tint text-accent ring-1 ring-inset ring-primary/40' : c.best != null || c.homework_done > 0 ? 'bg-watch-tint text-watch ring-1 ring-inset ring-fill-watch' : 'bg-surface-2 text-ink-3';
                    const label = !c ? 'no data' : c.status === 'done' ? 'done' : `${c.passed ? 'level check passed' : c.best != null ? `level check best ${c.best}%` : 'level check not taken'}, homework ${c.homework_done}/${l.homework_sets}`;
                    return (
                      <td key={l.id} className="border-b border-line p-[3px]">
                        <span title={`${l.title}: ${label}`} aria-label={`${l.title}: ${label}`} className={`flex size-7 items-center justify-center rounded-[6px] text-[10.5px] font-bold tabular ${cls}`}>
                          {c?.status === 'done' ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : c?.best != null ? c.best : ''}
                        </span>
                      </td>
                    );
                  })}
                  <td className="border-b border-l border-line px-3 py-1.5 text-right font-bold text-ink tabular">{p ? `${p.lessons_done}/${p.lessons_total}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="t-caption font-normal text-ink-3">A lesson is done when its level check is passed at 70% and every homework set is finished. Assigned level checks and homework from the curriculum count here too.</p>
    </div>
  );
}

function Legend({ className, text }: { className: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block size-3 rounded-[3px] ${className}`} aria-hidden="true" />
      {text}
    </span>
  );
}
