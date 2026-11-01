// Copied from makonbook-mobile/src/lib/vocab/progress.ts.

import { isLearned, type Cards } from './scheduler';
import type { Deck, VocabList } from './types';

/** "SAT Words: Unit 1" -> "Unit 1": the screens are about SAT words already. Display only. */
export function listName(title: string): string {
  return title.replace(/^SAT Words:\s*/i, '');
}

export type ListProgress = { total: number; started: number; learned: number; fresh: number };

/** How far a list has got, from the cards (derived from the log, as everywhere). */
export function listProgress(list: VocabList, cards: Cards): ListProgress {
  let started = 0;
  let learned = 0;
  for (const w of list.words) {
    const c = cards.get(w.id);
    if (!c) continue;
    started++;
    if (isLearned(c)) learned++;
  }
  return { total: list.words.length, started, learned, fresh: list.words.length - started };
}

/**
 * When the lists being studied have fewer new words left than one day's
 * amount: the one nearly finished (the last with new words left) and the
 * next list not yet on, to offer it. Null when there's no need or no list.
 */
export function almostDone(deck: Deck, active: string[], cards: Cards, newPerDay: number) {
  const on = deck.lists.filter((l) => active.includes(l.slug));
  if (on.length === 0) return null;
  const left = on.reduce((n, l) => n + listProgress(l, cards).fresh, 0);
  if (left >= newPerDay) return null;
  const next = deck.lists.find((l) => !active.includes(l.slug));
  if (!next) return null;
  const ending = [...on].reverse().find((l) => listProgress(l, cards).fresh > 0) ?? on[on.length - 1]!;
  return { ending, next };
}
