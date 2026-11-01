// Copied from makonbook-mobile/src/lib/vocab/scheduler.ts (docs/handoff.md section 5):
// FSRS with ts-fsrs pinned to exactly 5.4.2, no fuzz, 90 % retention, so replaying
// the same log gives the same cards on every device. Keep in step with the phone.

import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';

import type { Deck, Review, VocabWord } from './types';

// FSRS, the same on every phone: default parameters, 90 % retention and no
// fuzz, so replaying the same log always gives the same cards. ts-fsrs is
// pinned to an exact version in package.json for the same reason.
const scheduler = fsrs(generatorParameters({ enable_fuzz: false, request_retention: 0.9 }));

export type Cards = Map<string, Card>;

/** The cards the log adds up to: every review applied in time order. */
export function replay(log: Review[]): Cards {
  const sorted = [...log].sort((a, b) => a.reviewed_at.localeCompare(b.reviewed_at) || a.id.localeCompare(b.id));
  const cards: Cards = new Map();
  for (const r of sorted) {
    const at = new Date(r.reviewed_at);
    const card = cards.get(r.word_id) ?? createEmptyCard<Card>(at);
    cards.set(r.word_id, scheduler.next(card, at, r.rating as Grade).card);
  }
  return cards;
}

/** Rates a card: the log entry, and the card after it. */
export function rate(card: Card | undefined, wordId: string, rating: Grade, now: Date, durationMs: number, id: string) {
  const next = scheduler.next(card ?? createEmptyCard<Card>(now), now, rating).card;
  const review: Review = {
    id,
    word_id: wordId,
    rating: rating as Review['rating'],
    reviewed_at: now.toISOString(),
    duration_ms: Math.max(0, Math.round(durationMs)),
    state: next.state as Review['state'],
    due: next.due.toISOString(),
    stability: next.stability,
    difficulty: next.difficulty,
    scheduled_days: next.scheduled_days,
  };
  return { card: next, review };
}

export const GRADES: { rating: Grade; label: string }[] = [
  { rating: Rating.Again, label: 'Again' },
  { rating: Rating.Hard, label: 'Hard' },
  { rating: Rating.Good, label: 'Good' },
  { rating: Rating.Easy, label: 'Easy' },
];

/** When the card comes back for each rating, as "10m", "1d", "3mo". */
export function preview(card: Card | undefined, now: Date): Record<Grade, string> {
  const p = scheduler.repeat(card ?? createEmptyCard<Card>(now), now);
  const out = {} as Record<Grade, string>;
  for (const g of GRADES) out[g.rating] = formatGap(p[g.rating].card.due.getTime() - now.getTime());
  return out;
}

export function formatGap(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d}d`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo}mo` : `${(d / 365).toFixed(1)}y`;
}

/**
 * The lists turned on. On a phone where the person never changed a setting
 * (a new phone), the lists they already studied count as on, so their
 * progress carries on without setting anything up.
 */
export function activeLists(settings: { active: string[]; saved?: boolean }, deck: Deck, cards: Cards): string[] {
  if (settings.saved !== false) return settings.active;
  return deck.lists.filter((l) => l.words.some((w) => cards.has(w.id))).map((l) => l.slug);
}

/** Learned: the next review is 21 days or more away (Anki's "mature"), as teachers see it. */
export const isLearned = (card: Card) => card.state === State.Review && card.scheduled_days >= 21;

/** A day on the phone's calendar, "2026-10-21". */
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Words first seen today (new cards studied today). */
export function newToday(log: Review[], now: Date): number {
  const first = new Map<string, string>();
  for (const r of log) {
    const seen = first.get(r.word_id);
    if (!seen || r.reviewed_at < seen) first.set(r.word_id, r.reviewed_at);
  }
  const today = localDay(now);
  let n = 0;
  for (const at of first.values()) if (localDay(new Date(at)) === today) n++;
  return n;
}

/** Cards studied ahead when nothing is due: learning cards due this soon (Anki's learn-ahead limit). */
export const LEARN_AHEAD_MS = 20 * 60_000;

/**
 * What to study now, in order: cards due (earliest first), then new words of
 * the lists turned on, in list order, up to what is left of today's new
 * words. Learning cards due within LEARN_AHEAD_MS count as due when nothing
 * else is.
 */
export function queue(deck: Deck, active: string[], cards: Cards, now: Date, newLeft: number) {
  const words = deck.lists.filter((l) => active.includes(l.slug)).flatMap((l) => l.words);
  const due: VocabWord[] = [];
  const soon: VocabWord[] = [];
  const fresh: VocabWord[] = [];
  for (const w of words) {
    const c = cards.get(w.id);
    if (!c) {
      if (fresh.length < newLeft) fresh.push(w);
    } else if (c.due.getTime() <= now.getTime()) due.push(w);
    else if (c.state !== State.Review && c.due.getTime() <= now.getTime() + LEARN_AHEAD_MS) soon.push(w);
  }
  const byDue = (a: VocabWord, b: VocabWord) => cards.get(a.id)!.due.getTime() - cards.get(b.id)!.due.getTime();
  due.sort(byDue);
  soon.sort(byDue);
  return { due, fresh, soon };
}
