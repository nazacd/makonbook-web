// The word games (Pairs, Unscramble, Fill the gap): practice on top of the
// flashcards, in this browser only. They never write to the review log, so
// the schedule stays what the ratings made it on every device.

import { State } from 'ts-fsrs';

import { addDays, schoolDate } from '@/lib/schedule';

import type { Cards } from './scheduler';
import type { Deck, Review, VocabWord } from './types';

export type GameId = 'pairs' | 'unscramble' | 'gap';

export const GAMES: Record<GameId, { title: string; blurb: string; path: string }> = {
  pairs: { title: 'Pairs', blurb: 'Join each word to its meaning, against the clock', path: '/words/play/pairs' },
  unscramble: { title: 'Unscramble', blurb: 'Read the meaning, build the word from its letters', path: '/words/play/unscramble' },
  gap: { title: 'Fill the gap', blurb: 'Choose the word the sentence is missing', path: '/words/play/gap' },
};

/** A game needs this many words to be worth playing (four choices, five pairs). */
export const MIN_WORDS = 5;

export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * The words a game draws from: those of the lists turned on. Words already
 * met in the flashcards come first, the shakiest of them first (still being
 * learned, then the least stable); words not met yet only fill what is left.
 */
export function pool(deck: Deck, active: string[], cards: Cards): { met: VocabWord[]; unmet: VocabWord[] } {
  const words = deck.lists.filter((l) => active.includes(l.slug)).flatMap((l) => l.words);
  const met = words.filter((w) => cards.has(w.id));
  const weight = (w: VocabWord) => {
    const c = cards.get(w.id)!;
    return (c.state === State.Review ? 1000 : 0) + c.stability;
  };
  met.sort((a, b) => weight(a) - weight(b));
  return { met, unmet: words.filter((w) => !cards.has(w.id)) };
}

/**
 * A round of up to n words that pass `fits`: mostly from the shakier half of
 * the words met, shuffled so two rounds in a row differ; topped up with
 * words not met yet.
 */
export function pickRound(from: { met: VocabWord[]; unmet: VocabWord[] }, n: number, fits: (w: VocabWord) => boolean = () => true): VocabWord[] {
  const met = from.met.filter(fits);
  const shaky = shuffle(met.slice(0, Math.max(n * 2, Math.ceil(met.length / 2))));
  const round = shaky.slice(0, n);
  if (round.length < n) round.push(...from.unmet.filter(fits).slice(0, n - round.length));
  return shuffle(round);
}

/** Words Unscramble can use: one run of 4 to 12 letters. */
export const spellable = (w: VocabWord) => /^[a-z]{4,12}$/i.test(w.word);

/** A word's letters in another order (never the word itself, when it can be helped). */
export function scramble(word: string): string[] {
  const letters = word.toLowerCase().split('');
  for (let i = 0; i < 8; i++) {
    const mixed = shuffle(letters);
    if (mixed.join('') !== word.toLowerCase()) return mixed;
  }
  return letters.reverse();
}

/**
 * The example sentence with the word taken out: "abate" also leaves a gap
 * for "abated". Null when the sentence doesn't show the word.
 */
export function gapOf(w: VocabWord): { before: string; after: string; shown: string } | null {
  const stem = w.word.toLowerCase().replace(/(e|y)$/, '');
  if (stem.length < 3) return null;
  const m = new RegExp(`(^|[^a-z])(${stem.replace(/[^a-z]/g, '')}[a-z]*)`, 'i').exec(w.example);
  if (!m || !m[2]) return null;
  const at = m.index + m[1]!.length;
  return { before: w.example.slice(0, at), after: w.example.slice(at + m[2].length), shown: m[2] };
}

/** Three wrong choices for a word: the same part of speech when there are enough. */
export function distractors(word: VocabWord, all: VocabWord[], n = 3): VocabWord[] {
  const others = all.filter((w) => w.id !== word.id && w.word.toLowerCase() !== word.word.toLowerCase());
  const alike = shuffle(others.filter((w) => w.part_of_speech && w.part_of_speech === word.part_of_speech));
  const rest = shuffle(others.filter((w) => !alike.includes(w)));
  return [...alike, ...rest].slice(0, n);
}

/** Days in a row with at least one review, ending today (or yesterday, so the day isn't lost before studying). */
export function streak(log: Review[], now: number): number {
  const days = new Set(log.map((r) => schoolDate(Date.parse(r.reviewed_at))));
  let day = schoolDate(now);
  if (!days.has(day)) day = addDays(day, -1);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** Reviews made today (school time). */
export function reviewsToday(log: Review[], now: number): number {
  const today = schoolDate(now);
  let n = 0;
  for (const r of log) if (schoolDate(Date.parse(r.reviewed_at)) === today) n++;
  return n;
}

const MILESTONES = [25, 50, 100, 250, 500, 750, 1000, 1500, 2000];

/** The next round number of words learned to aim for. */
export function nextMilestone(learned: number): number {
  return MILESTONES.find((m) => m > learned) ?? Math.ceil((learned + 1) / 500) * 500;
}

// Best results, per person, in this browser.

export type Best = { plays: number; best: number | null };
export type Bests = Record<GameId, Best>;

const key = (person: string) => `mb.vocab.${person}.games`;
const EMPTY: Bests = { pairs: { plays: 0, best: null }, unscramble: { plays: 0, best: null }, gap: { plays: 0, best: null } };

export function loadBests(person: string): Bests {
  try {
    const raw = localStorage.getItem(key(person));
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Bests>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

/**
 * Counts a finished game and keeps the best result: the shortest time for
 * Pairs (`lower`), the highest score for the others. Says whether it's a new best.
 */
export function saveResult(person: string, game: GameId, value: number, lower = false): boolean {
  const all = loadBests(person);
  const was = all[game].best;
  const better = was == null || (lower ? value < was : value > was);
  const next: Bests = { ...all, [game]: { plays: all[game].plays + 1, best: better ? value : was } };
  try {
    localStorage.setItem(key(person), JSON.stringify(next));
  } catch {
    // Storage blocked: the result just isn't remembered.
  }
  return better && was != null;
}

/** "1:05" from milliseconds. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
