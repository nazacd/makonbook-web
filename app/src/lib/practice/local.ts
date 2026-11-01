import type { TextHighlight } from '@/components/practice/Annotations';
import { idbGet, idbSet } from '@/lib/idb';

import { calculatorStateKey } from './calculator-state';

import type { AnswerInput, OwnAttempt, Package, Score, ServerAttempt, Subject } from './types';

// What this browser keeps about practice tests, per person (a shared computer
// keeps each student's tests apart), in localStorage: the test in progress,
// and finished attempts with every answer until they are uploaded (and after,
// so the review works without another request). The shapes are the phone's
// (makonbook-mobile/src/lib/practice/local.ts); the storage differs.

export type Person = string; // "student-123"

/** A test being taken. Modules run one after another; time is kept as time used, so leaving pauses it. */
export type Run = {
  id: string;
  code: string;
  title: string;
  version: number;
  sections: Subject[];
  startedAt: string;
  /** Which module (in the order taken); `ready` until its timer is started. */
  stage: number;
  ready: boolean;
  elapsedMs: number;
  index: number;
  answers: Record<string, string>;
  seconds: Record<string, number>;
  marked: string[];
  eliminated: Record<string, string[]>;
  /** Highlights and notes per block ("<question key>/p" the passage, "/q" the question); the browser's own, not uploaded. */
  highlights?: Record<string, TextHighlight[]>;
  /**
   * The break between a full test's sections, while it's on: time left as of
   * `since` (when it last ran on), or paused (`since` null).
   */
  brk?: { leftMs: number; since: string | null };
};

export type LocalAttempt = {
  id: string;
  code: string;
  title: string;
  version: number;
  sections: Subject[];
  started_at: string;
  finished_at: string;
  answers: AnswerInput[];
  /** Graded here; replaced by the server's once uploaded. */
  scores: Partial<Record<Subject, Score>>;
  total: number | null;
  uploaded: boolean;
  /** The server refused it (it won't be sent again). */
  rejected?: string;
};

/** A downloaded package with its image links, which expire. */
export type StoredPackage = { package: Package; images: Record<string, string>; expires_at: string };

const key = (person: Person, what: string) => `mb.practice.${person}.${what}`;

function read<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** False when it couldn't be kept (storage full or blocked): the page keeps working from memory. */
function write(k: string, value: unknown): boolean {
  try {
    localStorage.setItem(k, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {
    // Nothing to do.
  }
}

function keysWithPrefix(prefix: string): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) out.push(k);
    }
  } catch {
    // No storage.
  }
  return out;
}

export const loadRun = (p: Person, code: string) => read<Run | null>(key(p, `run.${code}`), null);
/** Where a run is kept; another tab writing it means the test went on there. */
export const runKey = (p: Person, code: string) => key(p, `run.${code}`);
export const saveRun = (p: Person, run: Run): boolean => write(runKey(p, run.code), run);
export const clearRun = (p: Person, code: string) => remove(key(p, `run.${code}`));

/** Every test in progress, by code. */
export function loadRuns(p: Person): Record<string, Run> {
  const out: Record<string, Run> = {};
  for (const k of keysWithPrefix(key(p, 'run.'))) {
    const run = read<Run | null>(k, null);
    if (run) out[run.code] = run;
  }
  return out;
}

/** Finished attempts, latest first. */
export const loadAttempts = (p: Person) => read<LocalAttempt[]>(key(p, 'attempts'), []);

/** False when it couldn't be kept, even after making room. */
export function saveAttempt(p: Person, attempt: LocalAttempt): boolean {
  const k = key(p, 'attempts');
  const save = () => {
    const rest = loadAttempts(p).filter((a) => a.id !== attempt.id);
    return write(k, [...rest, attempt].sort((a, b) => b.finished_at.localeCompare(a.finished_at)));
  };
  if (save()) return true;
  freeSpace();
  return save();
}

/** Records the server's grading of an uploaded attempt. */
export function markUploaded(p: Person, server: ServerAttempt) {
  const a = loadAttempts(p).find((x) => x.id === server.id);
  if (a) saveAttempt(p, { ...a, uploaded: true, scores: server.scores, total: server.total });
}

export function markRejected(p: Person, id: string, reason: string) {
  const a = loadAttempts(p).find((x) => x.id === id);
  if (a) saveAttempt(p, { ...a, rejected: reason });
}

const fromServer = (s: OwnAttempt): LocalAttempt => ({
  id: s.id,
  code: s.test,
  title: s.title,
  version: s.version,
  sections: s.sections,
  started_at: s.started_at,
  finished_at: s.finished_at,
  answers: s.answers,
  scores: s.scores,
  total: s.total,
  uploaded: true,
});

const sections: Subject[] = ['english', 'math'];

/**
 * Brings this browser's attempts in line with the server's (the phone's
 * mergeFromServer): keeps the ones it doesn't have, takes the server's copy of
 * uploaded ones, leaves unsent ones alone. Returns how many changed.
 */
export function mergeFromServer(p: Person, server: OwnAttempt[]): number {
  const all = loadAttempts(p);
  const byId = new Map(server.map((s) => [s.id, fromServer(s)]));
  let changed = 0;
  const next = all.map((a) => {
    const s = byId.get(a.id);
    byId.delete(a.id);
    const same =
      s &&
      s.finished_at === a.finished_at &&
      s.started_at === a.started_at &&
      s.version === a.version &&
      s.total === a.total &&
      s.answers.length === a.answers.length &&
      sections.every((sub) => s.scores[sub]?.score === a.scores[sub]?.score);
    if (!s || !a.uploaded || same) return a;
    changed++;
    return s;
  });
  for (const s of byId.values()) {
    next.push(s);
    changed++;
  }
  if (changed === 0) return 0;
  next.sort((a, b) => b.finished_at.localeCompare(a.finished_at));
  write(key(p, 'attempts'), next);
  return changed;
}

// Packages are the same for everyone, so they are kept once, by code, in
// IndexedDB (a full test's text runs to a few hundred kB; localStorage holds
// about 5 MB in all). The latest fetched version of a code replaces the
// older one.
const pkgKey = (code: string) => `practice.pkg.${code}`;

export async function loadPackage(code: string, version: number): Promise<StoredPackage | null> {
  dropOldPackages();
  try {
    const stored = await idbGet<StoredPackage>(pkgKey(code));
    return stored?.package.version === version ? stored : null;
  } catch {
    return null;
  }
}

export async function savePackage(stored: StoredPackage): Promise<void> {
  try {
    await idbSet(pkgKey(stored.package.code), stored);
  } catch {
    // Not kept: fetched again next time.
  }
}

// Packages used to be kept in localStorage, where they filled it up.
let droppedOld = false;
function dropOldPackages() {
  if (droppedOld) return;
  droppedOld = true;
  for (const k of keysWithPrefix('mb.practice.pkg.')) remove(k);
}

/**
 * Makes room in localStorage: packages from before they moved, and the
 * calculator work of tests no longer in progress (for anyone).
 */
export function freeSpace() {
  dropOldPackages();
  const running = new Set<string>();
  for (const k of keysWithPrefix('mb.practice.')) {
    if (!k.includes('.run.')) continue;
    const run = read<Run | null>(k, null);
    if (run) running.add(run.id);
  }
  for (const k of keysWithPrefix(calculatorStateKey(''))) {
    if (!running.has(k.slice(calculatorStateKey('').length))) remove(k);
  }
}
