import { CalendarDays, CalendarX, Clock, DoorOpen, User, type LucideIcon } from 'lucide-react';
import { lazy, type CSSProperties, type ReactNode } from 'react';

import { useMe, useMyAttendance } from '@/api/queries';
import type { Group, GroupAttendance, Profile } from '@/api/types';
import { AttendanceBar } from '@/components/AttendanceBar';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/States';
import { Card, PageHeader } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { dayLetters, daysSpoken, normalCase, parseClassName, roomNumber } from '@/lib/groups';
import { describeDay, nextClass, type Occurrence } from '@/lib/schedule';
import { needsPhone } from '@/api/accounts';
import { LockedHome } from '@/screens/LockedHome';
import { useTitle } from '@/lib/title';

const TeacherToday = lazy(() => import('./TeacherToday').then((m) => ({ default: m.TeacherToday })));
const Dashboard = lazy(() => import('./Dashboard').then((m) => ({ default: m.Dashboard })));

// "/": students see their dashboard, teachers their lessons for the day.
export function Home() {
  const me = useMe().data;
  if (me?.kind === 'teacher') return <TeacherToday />;
  return needsPhone(me) ? <LockedHome /> : <Dashboard />;
}

// "/classes": the student's classes, built around the next lesson.
export function StudentClasses() {
  useTitle('Classes');
  const profile = useMe().data as Profile; // RequireAuth only renders with a profile
  const now = useNow();
  const attendance = useMyAttendance();
  const next = nextClass(profile.groups, now);

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <PageHeader icon={CalendarDays} title="Classes" subtitle="Your groups, their times and your attendance." />
      {next && <NextClass next={next} now={now} />}
      {profile.groups.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarX} title="No classes yet" message="When the office adds you to a group, it shows up here with its schedule." />
        </Card>
      ) : (
        <div className="mt-4 grid gap-3.5 md:grid-cols-2">
          {profile.groups.map((group) => (
            <ClassBlock key={group.id} group={group} attendance={attendance.data?.groups.find((g) => g.group_id === group.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Day and time set large, with the class and room beneath.
function NextClass({ next, now }: { next: Occurrence; now: number }) {
  const name = parseClassName(next.group.name, next.group.discipline);
  const happening = next.start <= now;
  const what = [name.title, name.teacher].filter(Boolean).join(' · ');
  const where = [next.slot.classroom && `Room ${roomNumber(next.slot.classroom)}`, `until ${next.slot.end_time}`].filter(Boolean).join(' · ');
  return (
    <section className="widget" style={{ '--w': 'var(--color-orange)' } as CSSProperties} aria-label={`${happening ? 'Happening now' : 'Next class'}: ${happening ? `until ${next.slot.end_time}` : `${describeDay(next.start, now)}, ${next.slot.begin_time}`}. ${what}. ${where}`}>
      <p className="t-micro text-orange">{happening ? 'Happening now' : 'Next class'}</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-3">
        {happening ? (
          <>
            <span className="t-large-title text-ink">{capital('until')}</span>
            <span className="t-large-title tabular text-accent">{next.slot.end_time}</span>
          </>
        ) : (
          <>
            <span className="t-large-title text-ink">{describeDay(next.start, now)}</span>
            <span className="t-large-title tabular text-accent">{next.slot.begin_time}</span>
          </>
        )}
      </p>
      <p className="t-callout mt-2.5 font-medium text-ink">{what}</p>
      {!happening && <p className="t-subhead text-ink-2">{where}</p>}
    </section>
  );
}

// A class, set on the page as type: its name, then teacher, time with days,
// and room, each on its own line. The attendance bar sits at its bottom right.
function ClassBlock({ group, attendance }: { group: Group; attendance?: GroupAttendance }) {
  const name = parseClassName(group.name, group.discipline);
  const teacher = name.teacher ?? (group.schedule[0]?.teachers[0] ? normalCase(group.schedule[0].teachers[0]) : null);
  // One time line per distinct slot; rooms listed once.
  const times = [...new Map(group.schedule.map((s) => [`${s.begin_time}|${s.weekdays.join()}`, s])).values()];
  const rooms = [...new Set(group.schedule.map((s) => s.classroom).filter(Boolean).map(roomNumber))];
  const s = attendance?.summary;
  const rate = s && s.lessons > 0 ? (s.present + s.late) / s.lessons : null;
  return (
    <section className="flex items-end gap-3 rounded-card border border-line bg-surface p-[18px]">
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <h2 className="t-title3 text-ink">{name.title}</h2>
          {name.isPrivate && <span className="t-caption rounded-lg border-[1.5px] border-ink-2 px-1.5 py-px text-ink-2">1:1</span>}
        </div>
        <div className="flex flex-col gap-1">
          {teacher && (
            <Line icon={User}>
              <span className="t-subhead text-ink-2">{teacher}</span>
            </Line>
          )}
          {times.map((slot, i) => (
            <Line key={i} icon={Clock} label={`${slot.begin_time}, ${daysSpoken(slot.weekdays)}`}>
              <span className="t-subhead tabular text-ink-2">{slot.begin_time}</span>
              <span className="t-caption text-ink-2" style={{ letterSpacing: 0.6 }}>
                {dayLetters(slot.weekdays)}
              </span>
            </Line>
          ))}
          {rooms.length > 0 && (
            <Line icon={DoorOpen} label={`Room ${rooms.join(', ')}`}>
              <span className="t-subhead text-ink-2">{rooms.join(', ')}</span>
            </Line>
          )}
        </div>
      </div>
      {rate !== null && <AttendanceBar rate={rate} to={`/attendance/group/${group.id}`} />}
    </section>
  );
}

function Line({ icon, label, children }: { icon: LucideIcon; label?: string; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2" aria-label={label}>
      <Icon as={icon} size={16} className="text-ink-3" />
      {children}
    </p>
  );
}
