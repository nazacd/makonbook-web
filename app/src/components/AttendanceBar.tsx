import { Link } from 'react-router';

/** Under 70 %, 70–89 %, 90 % and above. */
export function attendanceBand(rate: number): 'bad' | 'watch' | 'good' {
  return rate < 0.7 ? 'bad' : rate < 0.9 ? 'watch' : 'good';
}

export const FILL: Record<ReturnType<typeof attendanceBand>, string> = { bad: 'bg-fill-bad', watch: 'bg-fill-watch', good: 'bg-fill-good' };
export const TONE: Record<ReturnType<typeof attendanceBand>, string> = { bad: 'text-bad', watch: 'text-watch', good: 'text-good' };

// A short horizontal bar under an "Attendance" label: its length and colour
// are the whole message, with no number. The percentage, absences and lesson
// history live on the class screen it opens. Not rendered before a class has
// had a lesson.
export function AttendanceBar({ rate, to }: { rate: number; to: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, rate)) * 100);
  return (
    <Link
      to={to}
      aria-label={`Attendance ${pct}%, opens class details`}
      className="flex min-h-11 min-w-16 flex-col items-center justify-end gap-1.5 rounded-[12px] px-1 pb-[7px] pt-1 active:bg-surface-2">
      <span className="t-caption text-ink-2" style={{ fontSize: 11 }}>
        Attendance
      </span>
      <span className="block h-1.5 w-16 overflow-hidden rounded-full bg-track">
        <span className={`block h-1.5 rounded-full ${FILL[attendanceBand(rate)]}`} style={{ width: `${pct}%` }} />
      </span>
    </Link>
  );
}
