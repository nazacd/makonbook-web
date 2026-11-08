import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import { KIND, type Assignment } from '@/api/assignments';
import { REF } from '@/components/practice/results/format';
import { SolidPill, ToneBar } from '@/components/practice/cards/TestCard';
import { parseClassName, teacherTitle } from '@/lib/groups';
import { testName } from '@/lib/practice/run';
import { KIND_ICON } from '@/screens/StudentAssignments';

import { dueShort, KIND_COLOR } from './format';

export const STATUS_PILL: Record<Assignment['status'], { text: string; color: string }> = {
  scheduled: { text: 'Scheduled', color: REF.omitted },
  open: { text: 'Open', color: REF.planned },
  overdue: { text: 'Past deadline', color: REF.deadline },
  closed: { text: 'Closed', color: REF.slate },
};

/** "Average 74%", "Average 1180", or nothing yet. */
export function average(a: Assignment): string | null {
  const s = a.summary;
  if (a.kind === 'exam') return s.average_score != null ? `avg ${Math.round(s.average_score)}` : null;
  return s.average_percent != null ? `avg ${Math.round(s.average_percent)}%` : null;
}

// One assignment in the teacher's lists: what, which group, when due, and
// how many of the group are done.
export function TeacherAssignmentRow({ a, now, showGroup = true }: { a: Assignment; now: number; showGroup?: boolean }) {
  const I = KIND_ICON[a.kind];
  const s = a.summary;
  const pill = STATUS_PILL[a.status];
  const group = teacherTitle(parseClassName(a.group_name));
  const avg = average(a);
  return (
    <li>
      <Link to={`/assignments/${a.id}`} className="group flex items-center gap-3.5 rounded-card border border-line bg-surface p-3.5 transition-colors hover:bg-surface-2 sm:p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px]" style={{ color: KIND_COLOR[a.kind], background: `color-mix(in srgb, ${KIND_COLOR[a.kind]} 13%, transparent)` }}>
          <I size={19} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="t-headline min-w-0 truncate text-ink">{testName(a.title)}</span>
            <SolidPill color={pill.color}>{pill.text}</SolidPill>
          </span>
          <span className="t-footnote mt-0.5 block truncate text-ink-2">
            {[KIND[a.kind].label, showGroup && group, `${a.questions} q`, a.status === 'scheduled' ? `opens ${dueShort(a.opens_at, now)}` : `due ${dueShort(a.due_at, now)}`].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="hidden w-40 shrink-0 flex-col gap-1.5 sm:flex">
          <span className="flex items-baseline justify-between text-[12.5px]">
            <span className="font-semibold text-ink tabular">
              {s.done}/{s.students} done
            </span>
            <span className="text-ink-3 tabular">{avg ?? (s.in_progress ? `${s.in_progress} working` : '')}</span>
          </span>
          <ToneBar value={s.students ? s.done / s.students : 0} color={KIND_COLOR[a.kind]} />
          {s.late > 0 && <span className="text-[11.5px] font-semibold text-bad tabular">{s.late} late</span>}
        </span>
        <span className="t-caption shrink-0 font-semibold text-ink-2 tabular sm:hidden">
          {s.done}/{s.students}
        </span>
        <ChevronRight size={17} className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </li>
  );
}
