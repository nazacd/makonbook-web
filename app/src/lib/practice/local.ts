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

function write(k: string, value: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the page keeps working from memory.
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
export const saveRun = (p: Person, run: Run) => write(key(p, `run.${run.code}`), run);
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

export function saveAttempt(p: Person, attempt: LocalAttempt) {
  const rest = loadAttempts(p).filter((a) => a.id !== attempt.id);
  write(key(p, 'attempts'), [...rest, attempt].sort((a, b) => b.finished_at.localeCompare(a.finished_at)));
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

// Packages are the same for everyone, so they are kept once, by code and
// version. The latest fetched version of a code replaces the older ones.
const pkgKey = (code: string, version: number) => `mb.practice.pkg.${code}.v${version}`;

export const loadPackage = (code: string, version: number) => read<StoredPackage | null>(pkgKey(code, version), null);

export function savePackage(stored: StoredPackage) {
  const { code, version } = stored.package;
  for (const k of keysWithPrefix(`mb.practice.pkg.${code}.v`)) if (k !== pkgKey(code, version)) remove(k);
  write(pkgKey(code, version), stored);
}
