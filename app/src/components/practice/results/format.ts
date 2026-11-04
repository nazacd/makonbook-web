import type { PackageQuestion, Subject } from '@/lib/practice/types';

// Words and numbers the mock-test pages share: section names as the list and
// the results say them, difficulty, time spent, dates at the school.

/** "Reading & Writing" where space is short but an abbreviation would be too short. */
export const SECTION_LABEL: Record<Subject, string> = { english: 'Reading & Writing', math: 'Math' };

/**
 * The design reference's status colours, kept as they are there (only its
 * brand crimson became SATMAKON purple): the navy, green and red chips, the
 * Planned blue, the slate table header, the grey "Omitted".
 */
export const REF = {
  navy: '#0e1a4f',
  green: '#3fb62a',
  red: '#aa233b',
  deadline: '#b02440',
  planned: '#2563eb',
  finished: '#15803d',
  slate: '#9199b1',
  omitted: '#8c93a6',
  easy: '#16a34a',
  medium: '#f0a03c',
  /** Red as text (a wrong answer, "Wrong 3"): the reference's red, lighter in dark mode so it stays legible. */
  redText: 'var(--color-bad)',
} as const;

type Difficulty = NonNullable<PackageQuestion['difficulty']>;

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const DIFFICULTY_COLOR: Record<Difficulty, string> = { easy: REF.easy, medium: REF.medium, hard: REF.redText };

/** Time spent on a question: "1:05", or "—" when none was recorded. */
export function clock(seconds: number | undefined): string {
  if (!seconds || seconds < 1) return '—';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The same, read aloud: "1 minute 5 seconds". */
export function clockWords(seconds: number | undefined): string {
  if (!seconds || seconds < 1) return 'no time recorded';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const parts = [m && `${m} ${m === 1 ? 'minute' : 'minutes'}`, s % 60 && `${s % 60} ${s % 60 === 1 ? 'second' : 'seconds'}`].filter(Boolean);
  return parts.join(' ');
}

/** "32 m", "1 h 4 m": a module's or a test's length, as the cards show it. */
export function minutesShort(minutes: number): string {
  if (minutes < 60) return `${minutes} m`;
  return minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} m` : `${minutes / 60} h`;
}

/** "2 h 14 min", or "64 min" under an hour. */
export function minutesLong(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`;
}

const SCHOOL_OFFSET_MS = 5 * 60 * 60 * 1000; // Tashkent, UTC+5 all year
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const two = (n: number) => String(n).padStart(2, '0');

/** The school's wall clock for an instant (read with getUTC…). */
function school(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t + SCHOOL_OFFSET_MS);
}

/** "November 3", as the cards date things. */
export function formatDay(iso: string | null | undefined): string {
  const d = school(iso);
  return d ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}` : '—';
}

/** "14:42 03.11.2026", as a passed card stamps its attempt. */
export function formatStamp(iso: string): string {
  const d = school(iso);
  return d ? `${two(d.getUTCHours())}:${two(d.getUTCMinutes())} ${two(d.getUTCDate())}.${two(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}` : '—';
}

/** "November 3, 2026 · 14:42" for lists of attempts. */
export function formatWhen(iso: string): string {
  const d = school(iso);
  return d ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}` : '—';
}

/** "29.05%" of students who got a question right. */
export const percent = (rate: number) => `${(rate * 100).toFixed(2)}%`;
