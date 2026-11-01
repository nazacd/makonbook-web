import { CalendarX, ChevronLeft, ChevronRight, DoorOpen, Users, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useOpenSession, useTeacherLessons, type TeacherLesson } from '@/api/attendance';
import { describeError } from '@/api/errors';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { useNow } from '@/lib/clock';
import { parseClassName, roomNumber, teacherTitle } from '@/lib/groups';
import { addDays, formatDate, schoolClock, schoolDate } from '@/lib/schedule';
import { useTitle } from '@/lib/title';

// The server keeps lesson days from 7 days back to 14 ahead.
const MIN_OFFSET = -7;
const MAX_OFFSET = 14;
const OPENS_BEFORE_MS = 15 * 60_000;

type Phase = 'open' | 'finished' | 'disabled' | 'upcoming' | 'startable' | 'missed';

function phaseOf(lesson: TeacherLesson, now: number): Phase {
  if (lesson.session) return lesson.session.status;
  if (!lesson.attendance_enabled) return 'disabled';
  const start = Date.parse(lesson.starts_at);
  if (now < start - OPENS_BEFORE_MS) return 'upcoming';
  if (now <= Date.parse(lesson.ends_at)) return 'startable';
  return 'missed';
}

function relativeDay(offset: number): string | null {
  if (offset === 0) return 'Today';
  if (offset === -1) return 'Yesterday';
  if (offset === 1) return 'Tomorrow';
  return null;
}

// The teacher's home (the phone's TeacherToday): the day as a timeline, each
// lesson a stop on the rail, with attendance started from here.
export function TeacherToday() {
  useTitle('Today');
  const navigate = useNavigate();
  const now = useNow();
  const [offset, setOffset] = useState(0);
  const [startError, setStartError] = useState<{ groupId: number; message: string } | null>(null);
  const date = addDays(schoolDate(now), offset);
  const lessons = useTeacherLessons(date, offset === 0);
  const open = useOpenSession();
  const relative = relativeDay(offset);

  function start(lesson: TeacherLesson) {
    setStartError(null);
    open.mutate(
      { group_id: lesson.group_id, date },
      {
        onSuccess: (s) => void navigate(`/attendance/${s.id}`),
        onError: (e) => setStartError({ groupId: lesson.group_id, message: describeError(e) }),
      },
    );
  }

  const list = lessons.data?.lessons ?? [];
  // "Now" sits before the first lesson that hasn't ended, on today only.
  const nowIndex = offset === 0 ? list.findIndex((l) => Date.parse(l.ends_at) > now) : -1;
  const inProgress = nowIndex >= 0 && Date.parse(list[nowIndex]!.starts_at) <= now;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-7">
      <div className="flex flex-col gap-1">
        <h1 className="t-large-title text-ink">{relative ?? formatDate(date)}</h1>
        <div className="flex items-center justify-between gap-3">
          <p className="t-subhead text-ink-2">{relative ? formatDate(date) : ''}</p>
          <div className="flex items-center gap-1">
            <DayButton icon={ChevronLeft} hint="Previous day" disabled={offset <= MIN_OFFSET} onClick={() => setOffset(offset - 1)} />
            {offset !== 0 && <DayButton label="Today" hint="Back to today" onClick={() => setOffset(0)} />}
            <DayButton icon={ChevronRight} hint="Next day" disabled={offset >= MAX_OFFSET} onClick={() => setOffset(offset + 1)} />
          </div>
        </div>
      </div>

      {lessons.isPending ? (
        <div className="flex flex-col gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton width={44} height={20} />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton width="70%" height={20} />
                <Skeleton width="45%" />
              </div>
            </div>
          ))}
        </div>
      ) : lessons.isError ? (
        <ErrorState title="Couldn’t load your lessons" message={describeError(lessons.error)} onRetry={() => void lessons.refetch()} retrying={lessons.isFetching} />
      ) : list.length === 0 ? (
        <EmptyState icon={CalendarX} title="No lessons" message="Nothing on your HolliHop schedule for this day." />
      ) : (
        <ol>
          {list.map((lesson, i) => (
            <li key={lesson.group_id}>
              {i === nowIndex && !inProgress && <NowMarker now={now} />}
              <Stop
                lesson={lesson}
                phase={phaseOf(lesson, now)}
                last={i === list.length - 1}
                starting={open.isPending && open.variables?.group_id === lesson.group_id}
                error={startError?.groupId === lesson.group_id ? startError.message : null}
                onStart={() => start(lesson)}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DayButton({ icon, label, hint, disabled, onClick }: { icon?: LucideIcon; label?: string; hint: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={hint} className={`flex h-11 min-w-11 items-center justify-center rounded-[12px] bg-surface-2 active:bg-line disabled:opacity-35 ${label ? 'px-3.5' : ''}`}>
      {icon ? <Icon as={icon} size={20} strokeWidth={2} /> : <span className="t-subhead font-semibold text-ink">{label}</span>}
    </button>
  );
}

function NowMarker({ now }: { now: number }) {
  return (
    <div className="flex h-7 items-center" aria-label={`Now, ${schoolClock(now)}`}>
      <span className="t-caption tabular w-14 font-bold text-accent">{schoolClock(now)}</span>
      <span className="-ml-1 size-[9px] rounded-full bg-accent" />
      <span className="h-[1.5px] flex-1 bg-accent opacity-60" />
    </div>
  );
}

const DOT: Record<Phase, string> = { open: 'bg-accent', startable: 'bg-accent', finished: 'bg-fill-good', missed: 'bg-watch', upcoming: 'bg-line-strong', disabled: 'bg-line-strong' };

function Stop({ lesson, phase, last, starting, error, onStart }: { lesson: TeacherLesson; phase: Phase; last: boolean; starting: boolean; error: string | null; onStart: () => void }) {
  const name = parseClassName(lesson.group_name, lesson.discipline);
  const title = teacherTitle(name);
  const status: Partial<Record<Phase, { text: string; tone: string }>> = {
    open: { text: 'In progress', tone: 'font-semibold text-accent' },
    finished: { text: 'Done', tone: 'font-semibold text-good' },
    missed: { text: 'Not taken', tone: 'font-semibold text-watch' },
    upcoming: { text: `Opens at ${schoolClock(Date.parse(lesson.starts_at) - OPENS_BEFORE_MS)}`, tone: 'text-ink-3' },
    disabled: { text: 'No attendance in the app', tone: 'text-ink-3' },
  };
  const s = status[phase];
  const sessionLink = lesson.session ? `/attendance/${lesson.session.id}` : null;
  const body = (
    <div className={`flex flex-1 flex-col gap-1.5 ${last ? '' : 'pb-8'}`}>
      <p className="t-title3 text-ink">{title}</p>
      <p className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
        <Meta icon={Users} text={String(lesson.students)} label={`${lesson.students} ${lesson.students === 1 ? 'student' : 'students'}`} />
        {lesson.classroom ? <Meta icon={DoorOpen} text={roomNumber(lesson.classroom)} label={`Room ${roomNumber(lesson.classroom)}`} /> : null}
        {s && <span className={`t-subhead ${s.tone}`}>{s.text}</span>}
      </p>
      {phase === 'startable' && <Button label="Start attendance" onClick={onStart} loading={starting} className="mt-2 max-w-xs" />}
      {phase === 'open' && sessionLink && (
        <Link to={sessionLink} className="t-headline mt-2 flex h-[52px] max-w-xs items-center justify-center rounded-control bg-primary px-6 text-on-primary active:scale-[0.97]">
          Continue attendance
        </Link>
      )}
      {error && (
        <div className="mt-2">
          <Notice tone="error" title="Couldn’t start attendance" message={error} />
        </div>
      )}
    </div>
  );
  return (
    <div className="flex">
      <div className="w-14 pt-0.5">
        <p className="font-title tabular text-[17px] font-semibold leading-[22px] text-ink">{lesson.begin_time}</p>
        <p className="t-caption tabular text-ink-3">{lesson.end_time}</p>
      </div>
      <div className="flex w-5 flex-col items-center">
        <span className={`mt-1.5 size-[11px] rounded-full ${DOT[phase]}`} />
        {!last && <span className="mt-1 w-[1.5px] flex-1 bg-line" />}
      </div>
      {phase === 'finished' && sessionLink ? (
        <Link to={sessionLink} className="flex flex-1 pl-2.5 active:opacity-60" aria-label={`${title}, done. Shows the marks; you can correct them for 24 hours`}>
          {body}
          <span className="pt-1">
            <Icon as={ChevronRight} size={18} className="text-ink-3" />
          </span>
        </Link>
      ) : (
        <div className="flex flex-1 pl-2.5">{body}</div>
      )}
    </div>
  );
}

function Meta({ icon, text, label }: { icon: LucideIcon; text: string; label: string }) {
  return (
    <span className="t-subhead flex items-center gap-1.5 text-ink-2" aria-label={label}>
      <Icon as={icon} size={15} className="text-ink-3" />
      {text}
    </span>
  );
}
