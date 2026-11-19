import { useMemo, useSyncExternalStore } from 'react';

import { useNow } from '@/lib/clock';

// The season the app wears today, and the holiday if one is on. Platform-wide
// and from the calendar in Tashkent (Dec–Feb winter, Mar–May spring, Jun–Aug
// summer, Sep–Nov autumn), as the old MakonBook did; the API may pin one later
// (then `currentSeason` reads that instead). Holidays are short windows inside
// a season that the decor and Mako celebrate. The moving ones (the two Hayits)
// are dated below, to be updated each year like lib/satDates.ts.
//
// Previewing: open any page with `?season=winter`, `?holiday=new-year`, or
// `?season=auto` to go back; the choice lasts for the tab.

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
export const SEASONS: Season[] = ['winter', 'spring', 'summer', 'autumn'];

export const SEASON_META: Record<Season, { label: string; uz: string; months: string; particles: string }> = {
  winter: { label: 'Winter', uz: 'Qish', months: 'December – February', particles: 'snow' },
  spring: { label: 'Spring', uz: 'Bahor', months: 'March – May', particles: 'peach petals' },
  summer: { label: 'Summer', uz: 'Yoz', months: 'June – August', particles: 'pollen and fireflies' },
  autumn: { label: 'Autumn', uz: 'Kuz', months: 'September – November', particles: 'chinar leaves' },
};

export type HolidayKey = 'new-year' | 'navruz' | 'womens-day' | 'ramazon-hayit' | 'qurbon-hayit' | 'independence' | 'teachers-day' | 'constitution';
export type Holiday = { key: HolidayKey; greeting: string; english: string };

const GREETINGS: Record<HolidayKey, { uz: string; en: string }> = {
  'new-year': { uz: 'Yangi yil muborak!', en: 'Happy New Year!' },
  navruz: { uz: 'Navro‘z muborak!', en: 'Happy Navruz!' },
  'womens-day': { uz: '8-mart bayramingiz muborak!', en: 'Happy Women’s Day!' },
  'ramazon-hayit': { uz: 'Ramazon hayiti muborak!', en: 'Eid Mubarak!' },
  'qurbon-hayit': { uz: 'Qurbon hayiti muborak!', en: 'Eid al-Adha Mubarak!' },
  independence: { uz: 'Mustaqillik kuni muborak!', en: 'Happy Independence Day!' },
  'teachers-day': { uz: 'O‘qituvchilar kuni muborak!', en: 'Happy Teachers’ Day!' },
  constitution: { uz: 'Konstitutsiya kuni muborak!', en: 'Happy Constitution Day!' },
};
export const HOLIDAY_KEYS = Object.keys(GREETINGS) as HolidayKey[];

// Every year, as (month, day) windows, inclusive; one crossing New Year is split.
const EVERY_YEAR: { key: HolidayKey; start: [number, number]; end: [number, number] }[] = [
  { key: 'new-year', start: [12, 25], end: [12, 31] },
  { key: 'new-year', start: [1, 1], end: [1, 3] },
  { key: 'womens-day', start: [3, 7], end: [3, 8] },
  { key: 'navruz', start: [3, 17], end: [3, 25] },
  { key: 'independence', start: [8, 30], end: [9, 2] },
  { key: 'teachers-day', start: [10, 1], end: [10, 1] },
  { key: 'constitution', start: [12, 8], end: [12, 8] },
];
// The Hayits follow the lunar calendar: the day and the one after, per year
// (Uzbekistan's announced dates; confirm each year and add the next).
const DATED: { key: HolidayKey; days: string[] }[] = [
  { key: 'ramazon-hayit', days: ['2026-03-20', '2026-03-21', '2027-03-09', '2027-03-10', '2028-02-26', '2028-02-27'] },
  { key: 'qurbon-hayit', days: ['2026-05-27', '2026-05-28', '2027-05-16', '2027-05-17', '2028-05-05', '2028-05-06'] },
];

const TZ = 'Asia/Tashkent';
let fmt: Intl.DateTimeFormat | null = null;

/** The calendar date in Tashkent: year, month (1–12), day, and the hour there. */
export function tashkentDate(at: number): { year: number; month: number; day: number; hour: number; iso: string } {
  fmt ??= new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' });
  const parts: Record<string, number> = {};
  for (const p of fmt.formatToParts(new Date(at))) if (p.type !== 'literal') parts[p.type] = Number(p.value);
  const { year, month, day } = parts;
  return { year: year!, month: month!, day: day!, hour: parts.hour ?? 0, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

export function seasonForMonth(month: number): Season {
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'autumn';
}

function holiday(key: HolidayKey): Holiday {
  return { key, greeting: GREETINGS[key].uz, english: GREETINGS[key].en };
}

export function holidayForDate(d: { month: number; day: number; iso: string }): Holiday | null {
  for (const h of DATED) if (h.days.includes(d.iso)) return holiday(h.key);
  const md = d.month * 100 + d.day;
  for (const h of EVERY_YEAR) if (md >= h.start[0] * 100 + h.start[1] && md <= h.end[0] * 100 + h.end[1]) return holiday(h.key);
  return null;
}

export type SeasonState = { season: Season; holiday: Holiday | null; /** The calendar date in Tashkent, yyyy-mm-dd. */ date: string; preview: boolean };

// ---- previewing (this tab only) ----
const PREVIEW_KEY = 'mb.season-preview';
type Preview = { season?: Season; holiday?: HolidayKey | 'none' };

function readPreview(): Preview {
  let p: Preview;
  try {
    p = JSON.parse(sessionStorage.getItem(PREVIEW_KEY) || '{}') as Preview;
  } catch {
    p = {};
  }
  try {
    const q = new URLSearchParams(window.location.search);
    const s = q.get('season');
    const h = q.get('holiday');
    if (s === 'auto') p = {};
    else if (s && (SEASONS as string[]).includes(s)) p.season = s as Season;
    if (h === 'none') p.holiday = 'none';
    else if (h && (HOLIDAY_KEYS as string[]).includes(h)) p.holiday = h as HolidayKey;
    if (s || h) sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(p));
  } catch {
    // No storage, no preview.
  }
  return p;
}
const preview = typeof window === 'undefined' ? {} : readPreview();

export function currentSeason(at: number = Date.now()): SeasonState {
  const d = tashkentDate(at);
  const season = preview.season ?? seasonForMonth(d.month);
  const h = preview.holiday === 'none' ? null : preview.holiday ? holiday(preview.holiday) : holidayForDate(d);
  return { season, holiday: h, date: d.iso, preview: !!(preview.season || preview.holiday) };
}

/** Today's season and holiday; re-read as the day turns. */
export function useSeason(): SeasonState {
  const now = useNow();
  const date = tashkentDate(now).iso;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the date is what matters, not the minute
  return useMemo(() => currentSeason(now), [date]);
}

// ---- "Seasonal effects" (the particles and the scenes), per viewer ----
const FX_KEY = 'mb.season-fx';
const FX_EVENT = 'mb:season-fx';

export function fxEnabled(): boolean {
  try {
    return localStorage.getItem(FX_KEY) !== 'off';
  } catch {
    return true;
  }
}
export function setFxEnabled(on: boolean) {
  try {
    if (on) localStorage.removeItem(FX_KEY);
    else localStorage.setItem(FX_KEY, 'off');
  } catch {
    // Not kept: lasts as long as the page.
  }
  window.dispatchEvent(new Event(FX_EVENT));
}
function subscribeFx(cb: () => void) {
  const storage = (e: StorageEvent) => e.key === FX_KEY && cb();
  window.addEventListener(FX_EVENT, cb);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(FX_EVENT, cb);
    window.removeEventListener('storage', storage);
  };
}
export function useSeasonFx(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribeFx, fxEnabled, () => true);
  return [on, setFxEnabled];
}

const REDUCE = '(prefers-reduced-motion: reduce)';
function subscribeReduce(cb: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE).matches, () => false);
}

// ---- bursts: Mako's celebrations throw a handful of the season's particles ----
export type BurstOrigin = { x: number; y: number };
let sink: ((count: number, origin?: BurstOrigin) => void) | null = null;
/** The particle layer registers here; one at a time. */
export function onBurst(fn: (count: number, origin?: BurstOrigin) => void): () => void {
  sink = fn;
  return () => {
    if (sink === fn) sink = null;
  };
}
export function burst(count = 24, origin?: BurstOrigin) {
  sink?.(count, origin);
}
/** A burst from the middle of an element (the panda). */
export function burstFrom(el: Element | null, count = 24) {
  if (!el) return burst(count);
  const r = el.getBoundingClientRect();
  burst(count, { x: r.left + r.width / 2, y: r.top + r.height / 3 });
}
