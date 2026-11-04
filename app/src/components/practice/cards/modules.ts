import { useQueries, useQueryClient } from '@tanstack/react-query';

import { isCorrect, slotKey } from '@/lib/practice/grade';
import { loadPackage, type LocalAttempt, type Run, type StoredPackage } from '@/lib/practice/local';
import type { CatalogTest, Package, Subject } from '@/lib/practice/types';

// The modules a mock-test card lists. A package this browser already has
// (in memory or in IndexedDB) gives the real times and question counts;
// without one, the catalog's counts split over the Digital SAT's two modules
// a section, at its times. The list never downloads a package itself.

export type ModuleShape = { subject: Subject; module: number; minutes: number; questions: number };

export type ModuleStatus = 'planned' | 'running' | 'finished';

export type ModuleRow = ModuleShape & {
  status: ModuleStatus;
  /** Answered so far (planned, in progress), or right (finished, with the package here). */
  done: number;
  doneMeans: 'answered' | 'right';
};

/** The Digital SAT's module times: 32 min for Reading and Writing, 35 for Math. */
export const SAT_MODULE_MINUTES: Record<Subject, number> = { english: 32, math: 35 };

export function shapeOf(pkg: Package | undefined, test: Pick<CatalogTest, 'english' | 'math'> | undefined): ModuleShape[] {
  if (pkg) {
    return pkg.sections.flatMap((s) => s.modules.map((m) => ({ subject: s.subject, module: m.module, minutes: m.minutes, questions: m.questions.length })));
  }
  if (!test) return [];
  return (['english', 'math'] as const)
    .filter((s) => test[s] > 0)
    .flatMap((s) => [1, 2].map((module) => ({ subject: s, module, minutes: SAT_MODULE_MINUTES[s], questions: module === 1 ? Math.ceil(test[s] / 2) : Math.floor(test[s] / 2) })));
}

/** A test not started: every module planned. */
export function plannedRows(shape: ModuleShape[]): ModuleRow[] {
  return shape.map((m) => ({ ...m, status: 'planned', done: 0, doneMeans: 'answered' }));
}

/** A test in progress: the modules it takes, done before the current one, answered so far in each. */
export function runRows(shape: ModuleShape[], run: Run): ModuleRow[] {
  return shape
    .filter((m) => run.sections.includes(m.subject))
    .map((m, i) => {
      const prefix = `${m.subject}-${m.module}-`;
      const done = Object.entries(run.answers).filter(([k, v]) => k.startsWith(prefix) && v.trim() !== '').length;
      const status: ModuleStatus = i < run.stage ? 'finished' : i === run.stage ? 'running' : 'planned';
      return { ...m, status, done, doneMeans: 'answered' };
    });
}

/** The modules an attempt's answers cover (every question is in them, blank ones too). */
function shapeFromAnswers(answers: LocalAttempt['answers']): ModuleShape[] {
  const out = new Map<string, ModuleShape>();
  for (const a of answers) {
    const k = `${a.subject}-${a.module}`;
    const m = out.get(k) ?? { subject: a.subject, module: a.module, minutes: SAT_MODULE_MINUTES[a.subject], questions: 0 };
    m.questions++;
    out.set(k, m);
  }
  return [...out.values()].sort((a, b) => Number(a.subject === 'math') - Number(b.subject === 'math') || a.module - b.module);
}

/** A finished attempt: right per module when the package is here to grade it, answered otherwise. */
export function attemptRows(shape: ModuleShape[], attempt: Pick<LocalAttempt, 'sections' | 'answers'>, pkg: Package | undefined): ModuleRow[] {
  const given = new Map(attempt.answers.map((a) => [slotKey(a.subject, a.module, a.position), a.answer]));
  return (shape.length ? shape : shapeFromAnswers(attempt.answers))
    .filter((m) => attempt.sections.includes(m.subject))
    .map((m) => {
      const questions = pkg?.sections.find((s) => s.subject === m.subject)?.modules.find((x) => x.module === m.module)?.questions;
      if (questions) {
        const right = questions.filter((q) => isCorrect(q, given.get(slotKey(m.subject, m.module, q.position)))).length;
        return { ...m, status: 'finished', done: right, doneMeans: 'right' };
      }
      const answered = attempt.answers.filter((a) => a.subject === m.subject && a.module === m.module && a.answer?.trim()).length;
      return { ...m, status: 'finished', done: answered, doneMeans: 'answered' };
    });
}

const pkgId = (code: string, version: number) => `${code}@${version}`;

/**
 * The packages this browser already holds for these tests, by "code@version":
 * from what a page fetched this visit, or from IndexedDB. Nothing is downloaded.
 */
export function useLocalPackages(wanted: { code: string; version: number }[]): Map<string, StoredPackage> {
  const queryClient = useQueryClient();
  const unique = [...new Map(wanted.map((w) => [pkgId(w.code, w.version), w])).values()];
  const results = useQueries({
    queries: unique.map(({ code, version }) => ({
      queryKey: ['practice-package-local', code, version] as const,
      queryFn: async (): Promise<StoredPackage | null> => queryClient.getQueryData<StoredPackage>(['practice-package', code, version]) ?? (await loadPackage(code, version)),
      staleTime: 60_000,
    })),
  });
  const out = new Map<string, StoredPackage>();
  results.forEach((r, i) => {
    const w = unique[i]!;
    if (r.data) out.set(pkgId(w.code, w.version), r.data);
  });
  return out;
}

export const localPackage = (packages: Map<string, StoredPackage>, code: string, version: number | null | undefined) =>
  version == null ? undefined : packages.get(pkgId(code, version))?.package;
