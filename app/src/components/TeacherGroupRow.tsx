import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { Group } from '@/api/types';
import { dayLetters, parseClassName, teacherTitle } from '@/lib/groups';

/** How a teacher's tab names a group: "Pre-SAT Math", "IV · Diyora Adilova". */
export const groupTitle = (group: Group) => teacherTitle(parseClassName(group.name, group.discipline));

// One of a teacher's groups on a tab: its name, a subject dot and when it
// meets, and on the right whatever the tab counts (nothing while that's none).
export function TeacherGroupRow({ group, first, to, details, right }: { group: Group; first: boolean; to: string; details?: string | false | null; right?: ReactNode }) {
  const name = parseClassName(group.name, group.discipline);
  const title = teacherTitle(name);
  const slot = group.schedule[0];
  const time = slot ? `${slot.begin_time} · ${dayLetters(slot.weekdays)}` : null;
  const dot = name.subject === 'Math' ? 'bg-ink' : name.subject === 'English' ? 'bg-bad' : 'bg-ink-3';
  return (
    <Link to={to} aria-label={[title, time, details].filter(Boolean).join(', ')} className="-mx-5 flex px-5 active:bg-surface-2">
      <span className={`flex min-h-[72px] flex-1 items-center gap-3 py-3 ${first ? '' : 'border-t border-line'}`}>
        <span className="flex flex-1 flex-col gap-1">
          <span className="t-title3 text-ink">{title}</span>
          {time && (
            <span className="t-subhead tabular flex items-center gap-2 text-ink-2">
              <span className={`size-2 rounded-full ${dot}`} />
              {time}
            </span>
          )}
        </span>
        {right}
      </span>
    </Link>
  );
}
