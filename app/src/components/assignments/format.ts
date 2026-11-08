import type { AssignmentKind, StudentAssignment } from '@/api/assignments';

// Deadlines as the cards and lists say them, in school time (Tashkent, UTC+5).

const SCHOOL_OFFSET_MS = 5 * 60 * 60 * 1000;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const two = (n: number) => String(n).padStart(2, '0');
const school = (iso: string) => new Date(Date.parse(iso) + SCHOOL_OFFSET_MS);

/** "November 12, 18:00". */
export function dueLong(iso: string): string {
  const d = school(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

/** "Tue 18:00" within a week, else "12 Nov". */
export function dueShort(iso: string, now: number): string {
  const d = school(iso);
  const days = (Date.parse(iso) - now) / 86_400_000;
  if (days > -6 && days < 6) return `${WEEKDAYS[d.getUTCDay()]} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]!.slice(0, 3)}`;
}

/** "in 3 days", "in 5 hours", "2 days ago". */
export function dueRelative(iso: string, now: number): string {
  const ms = Date.parse(iso) - now;
  const abs = Math.abs(ms);
  const h = Math.round(abs / 3_600_000);
  const d = Math.round(abs / 86_400_000);
  const amount = abs < 3_600_000 ? 'less than an hour' : h < 36 ? `${h} ${h === 1 ? 'hour' : 'hours'}` : `${d} ${d === 1 ? 'day' : 'days'}`;
  return ms >= 0 ? `in ${amount}` : `${amount} ago`;
}

/** For `<input type="datetime-local">`: school time, "2026-11-12T18:00". */
export function toLocalInput(iso: string): string {
  const d = school(iso);
  return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}T${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

/** Back from the input: school time to an instant. */
export function fromLocalInput(value: string): string {
  return new Date(Date.parse(`${value}:00Z`) - SCHOOL_OFFSET_MS).toISOString();
}

export type Tab = 'new' | 'run' | 'passed';

/** Which tab a student's assignment sits on. */
export const tabOf = (a: StudentAssignment): Tab => (a.mine.finished_at ? 'passed' : a.mine.status === 'in_progress' ? 'run' : 'new');

/** The kind's colour (a soft hue per kind, as the dashboard's categories). */
export const KIND_COLOR: Record<AssignmentKind, string> = {
  homework: 'var(--color-green)',
  level_check: 'var(--color-blue)',
  exam: 'var(--color-orange)',
};
