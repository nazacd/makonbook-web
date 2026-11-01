// Copied from makonbook-mobile/src/lib/schedule.ts (docs/handoff.md section 5):
// the school's dates and times. If it changes there, change it here. The only
// differences are type-level (weekdayOf, defaults) for this repo's
// noUncheckedIndexedAccess; the logic is the same.

import type { Group, Slot, Weekday } from '@/api/types';

// Class times from the API are wall-clock times at the school. Tashkent is
// UTC+5 all year (no daylight saving), so the arithmetic below works in that
// offset directly and gives the right answer whatever the phone's time zone.
const SCHOOL_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const satisfies readonly Weekday[];
/** getUTCDay() is always 0–6, so the lookup never misses. */
const weekdayOf = (utcDay: number): Weekday => WEEKDAYS[utcDay]!;
const SHORT: Record<Weekday, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};
const LONG: Record<Weekday, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};
const ORDER: Record<Weekday, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

export function formatWeekdays(days: Weekday[]): string {
  return [...days].sort((a, b) => ORDER[a] - ORDER[b]).map((d) => SHORT[d]).join(' · ');
}

function minutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Midnight at the school, as a UTC timestamp, for the school-day containing t.
function schoolMidnight(t: number): number {
  const local = t + SCHOOL_UTC_OFFSET_MS;
  return local - (local % DAY_MS) - SCHOOL_UTC_OFFSET_MS;
}

function dateKey(midnight: number): string {
  return new Date(midnight + SCHOOL_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

export type Occurrence = {
  group: Group;
  slot: Slot;
  start: number;
  end: number;
};

// The class happening now or next, looking a week ahead.
export function nextClass(groups: Group[], now: number): Occurrence | null {
  let best: Occurrence | null = null;
  const today = schoolMidnight(now);
  for (let offset = 0; offset < 8; offset++) {
    const day = today + offset * DAY_MS;
    const weekday = weekdayOf(new Date(day + SCHOOL_UTC_OFFSET_MS).getUTCDay());
    const key = dateKey(day);
    for (const group of groups) {
      for (const slot of group.schedule) {
        if (!slot.weekdays.includes(weekday)) continue;
        if (slot.begin_date && key < slot.begin_date) continue;
        if (slot.end_date && key > slot.end_date) continue;
        const start = day + minutes(slot.begin_time) * 60_000;
        const end = day + minutes(slot.end_time) * 60_000;
        if (end <= now) continue;
        if (!best || start < best.start) best = { group, slot, start, end };
      }
    }
    if (best) return best;
  }
  return null;
}

// The group's most recent class that has ended, looking a week back.
export function lastClass(group: Group, now: number): Occurrence | null {
  const today = schoolMidnight(now);
  for (let offset = 0; offset < 8; offset++) {
    const day = today - offset * DAY_MS;
    const weekday = weekdayOf(new Date(day + SCHOOL_UTC_OFFSET_MS).getUTCDay());
    const key = dateKey(day);
    let best: Occurrence | null = null;
    for (const slot of group.schedule) {
      if (!slot.weekdays.includes(weekday)) continue;
      if (slot.begin_date && key < slot.begin_date) continue;
      if (slot.end_date && key > slot.end_date) continue;
      const start = day + minutes(slot.begin_time) * 60_000;
      const end = day + minutes(slot.end_time) * 60_000;
      if (end > now) continue;
      if (!best || end > best.end) best = { group, slot, start, end };
    }
    if (best) return best;
  }
  return null;
}

/** "today", or the weekday of an instant in the past week ("Tue", or "Tuesday" when long). */
export function pastDay(t: number, now: number, long = false): string {
  if (schoolMidnight(t) === schoolMidnight(now)) return 'today';
  const weekday = weekdayOf(new Date(t + SCHOOL_UTC_OFFSET_MS).getUTCDay());
  return long ? LONG[weekday] : SHORT[weekday];
}

/** "Now", "Today", "Tomorrow" or the weekday name. */
export function describeDay(start: number, now: number): string {
  if (start <= now) return 'Now';
  const days = Math.round((schoolMidnight(start) - schoolMidnight(now)) / DAY_MS);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return LONG[weekdayOf(new Date(start + SCHOOL_UTC_OFFSET_MS).getUTCDay())];
}

/** Today's date at the school, "YYYY-MM-DD". */
export function schoolDate(now: number): string {
  return dateKey(schoolMidnight(now));
}

/** A "YYYY-MM-DD" date moved by n days. */
export function addDays(date: string, n: number): string {
  const t = Date.parse(`${date}T00:00:00Z`) + n * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/** "Mon, 12 Oct" for a "YYYY-MM-DD" date. */
export function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return `${SHORT[weekdayOf(d.getUTCDay())]}, ${d.getUTCDate()} ${month}`;
}

/** "today", "yesterday" or "12 Oct" for an instant in the past. */
export function relativeDay(t: number, now: number): string {
  const days = Math.round((schoolMidnight(now) - schoolMidnight(t)) / DAY_MS);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return formatDate(schoolDate(t)).slice(5);
}

/** "14:05" at the school for an instant. */
export function schoolClock(ms: number): string {
  const d = new Date(ms + SCHOOL_UTC_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
