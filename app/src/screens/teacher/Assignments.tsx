import { FileStack, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { useTeacherAssignments, type Assignment, type AssignmentKind } from '@/api/assignments';
import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { TeacherAssignmentRow } from '@/components/assignments/TeacherAssignmentRow';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { groupTitle } from '@/components/TeacherGroupRow';
import { PageHeader, Segmented } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { useTitle } from '@/lib/title';

// The teacher's Assignments: everything set for their groups, by state,
// with a filter per group and kind, and "New assignment".

type Tab = 'active' | 'past' | 'closed';
const TAB_OF = (a: Assignment): Tab => (a.status === 'closed' ? 'closed' : a.status === 'overdue' ? 'past' : 'active');
const EMPTY: Record<Tab, string> = {
  active: 'Nothing open. Set homework, a level check or an exam for a group.',
  past: 'Nothing past its deadline.',
  closed: 'Nothing closed yet.',
};

export function TeacherAssignments() {
  useTitle('Assignments');
  const me = useMe().data;
  const now = useNow();
  const list = useTeacherAssignments();
  const [tab, setTab] = useState<Tab>('active');
  const [group, setGroup] = useState<number | 'all'>('all');
  const [kind, setKind] = useState<AssignmentKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const all = (list.data ?? []).filter((a) => (group === 'all' || a.group_id === group) && (kind === 'all' || a.kind === kind) && (!q || a.title.toLowerCase().includes(q)));
  const by = (t: Tab) => all.filter((a) => TAB_OF(a) === t);
  // Open ones by deadline, soonest first; the rest newest first.
  const shown = by(tab).sort((a, b) => (tab === 'active' ? a.due_at.localeCompare(b.due_at) : b.due_at.localeCompare(a.due_at)));
  const groups = me?.groups ?? [];

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <PageHeader
        icon={FileStack}
        title="Assignments"
        subtitle="Homework, level checks and exams for your groups, with deadlines."
        actions={
          <Link to={`/assignments/new${group !== 'all' ? `?group=${group}` : ''}`} className="lift inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-[14px] font-bold text-on-primary hover:bg-primary-hover">
            <Plus size={17} strokeWidth={2.4} aria-hidden="true" /> New assignment
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="max-w-full overflow-x-auto no-scrollbar">
          <Segmented
            label="Which assignments"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'active', label: 'Open', count: list.isPending ? undefined : by('active').length },
              { value: 'past', label: 'Past deadline', count: list.isPending ? undefined : by('past').length },
              { value: 'closed', label: 'Closed', count: list.isPending ? undefined : by('closed').length },
            ]}
          />
        </div>
        <select value={group} onChange={(e) => setGroup(e.target.value === 'all' ? 'all' : Number(e.target.value))} aria-label="Group" className="h-[38px] max-w-full rounded-full border border-line bg-surface px-3.5 text-[14px] font-medium text-ink outline-none focus:border-accent">
          <option value="all">All groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {groupTitle(g)}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value as AssignmentKind | 'all')} aria-label="Kind" className="h-[38px] rounded-full border border-line bg-surface px-3.5 text-[14px] font-medium text-ink outline-none focus:border-accent">
          <option value="all">All kinds</option>
          <option value="homework">Homework</option>
          <option value="level_check">Level checks</option>
          <option value="exam">Exams</option>
        </select>
        <label className="relative block w-full sm:ml-auto sm:w-56">
          <span className="sr-only">Search assignments</span>
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="h-[38px] w-full rounded-full border border-line bg-surface-2 pl-[38px] pr-4 text-[14px] font-medium text-ink outline-none placeholder:text-ink-3 focus:border-accent" />
        </label>
      </div>

      {list.isPending ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={74} radius={16} />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState title="Couldn’t load the assignments" message={describeError(list.error)} onRetry={() => void list.refetch()} retrying={list.isFetching} />
      ) : shown.length === 0 ? (
        <EmptyState icon={FileStack} title={q ? `Nothing matches “${query.trim()}”.` : EMPTY[tab]} message={groups.length ? undefined : 'Your groups appear once you teach one in HolliHop.'} />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shown.map((a) => (
            <TeacherAssignmentRow key={a.id} a={a} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}
