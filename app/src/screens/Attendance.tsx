import { CalendarX, Check, ChevronLeft, Clock, X, type LucideIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { describeError } from '@/api/errors';
import { useMyAttendance } from '@/api/queries';
import type { DayState, GroupAttendance } from '@/api/types';
import { attendanceBand, FILL, TONE } from '@/components/AttendanceBar';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { ScreenTitle } from '@/layouts/AppShell';
import { parseClassName } from '@/lib/groups';
import { formatDate } from '@/lib/schedule';
import { useTitle } from '@/lib/title';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const MARK_LABEL: Record<DayState, string> = { present: 'Present', late: 'Late', absent: 'Absent' };
const MARK: Record<DayState, { icon: LucideIcon; tone: string }> = {
  present: { icon: Check, tone: 'text-ink-3' },
  late: { icon: Clock, tone: 'text-watch' },
  absent: { icon: X, tone: 'text-bad' },
};

// Days grouped by month, newest first, as they come from the API.
function byMonth(days: GroupAttendance['days']) {
  const out: { title: string; days: GroupAttendance['days'] }[] = [];
  for (const d of days) {
    const title = `${MONTHS[Number(d.date.slice(5, 7)) - 1]} ${d.date.slice(0, 4)}`;
    if (out.at(-1)?.title !== title) out.push({ title, days: [] });
    out.at(-1)!.days.push(d);
  }
  return out;
}

// A class's own screen: how attendance adds up, then every lesson. The figure
// is coloured by its band; only lateness and absences get a line of their own.
export function Attendance() {
  const { groupId } = useParams();
  const query = useMyAttendance();
  const group = query.data?.groups.find((g) => String(g.group_id) === groupId);
  const title = group ? parseClassName(group.group_name, group.discipline).title : 'Attendance';
  useTitle(`${title} · Attendance`);

  return (
    <div>
      <Link to="/classes" className="t-subhead -ml-1 mb-4 inline-flex h-10 items-center gap-1 rounded-chip pr-2 text-accent">
        <Icon as={ChevronLeft} size={18} className="text-accent" />
        Classes
      </Link>
      <ScreenTitle title={title} />
      {query.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton width={120} height={40} />
          <Skeleton width="60%" />
          <div className="h-6" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={20} />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState title="Couldn’t load your attendance" message={describeError(query.error)} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : !group || group.days.length === 0 ? (
        <EmptyState icon={CalendarX} title="No lessons yet" message="Your lessons in this group appear here once they have taken place." />
      ) : (
        <div className="flex flex-col gap-9">
          <Overview group={group} />
          {byMonth(group.days).map((month) => (
            <section key={month.title}>
              <h2 className="t-title3 mb-1.5 text-ink">{month.title}</h2>
              <ul>
                {month.days.map((d, i) => {
                  const mark = MARK[d.state];
                  return (
                    <li key={d.date} className={`flex min-h-12 items-center gap-3 ${i > 0 ? 'border-t border-line' : ''}`} aria-label={`${formatDate(d.date)}: ${MARK_LABEL[d.state]}`}>
                      <span className="t-body flex-1 text-ink">{formatDate(d.date)}</span>
                      <Icon as={mark.icon} size={16} className={mark.tone} strokeWidth={2} />
                      <span className={`t-subhead ${d.state === 'present' ? 'text-ink-2' : `font-semibold ${mark.tone}`}`}>{MARK_LABEL[d.state]}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <p className="t-footnote text-ink-3">Something wrong? Ask your teacher.</p>
        </div>
      )}
    </div>
  );
}

// Only the figure, in its band colour, with the Classes bar under it, larger.
function Overview({ group }: { group: GroupAttendance }) {
  const { lessons, present, late } = group.summary;
  const rate = (present + late) / lessons;
  const band = attendanceBand(rate);
  const pct = Math.round(rate * 100);
  return (
    <div>
      <p className={`font-title tabular text-[56px] font-bold leading-[62px] ${TONE[band]}`} aria-label={`Attendance ${pct}%`}>
        {pct}%
      </p>
      <div className="mt-2.5 h-2.5 w-40 overflow-hidden rounded-full bg-track" aria-hidden="true">
        <div className={`h-2.5 rounded-full ${FILL[band]}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="t-caption mt-3.5 text-ink-3">{group.group_name}</p>
    </div>
  );
}
