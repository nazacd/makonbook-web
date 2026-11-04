import { ClipboardList, CloudUpload, Search, SearchX, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { Icon } from '@/components/Icon';
import { attemptRows, localPackage, plannedRows, runRows, shapeOf, useLocalPackages } from '@/components/practice/cards/modules';
import { LockedTestCard, NewTestCard, PassedTestCard, RunTestCard, TestCardSkeleton } from '@/components/practice/cards/TestCard';
import { EmptyState, ErrorState } from '@/components/States';
import { Segmented } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { useCatalog, useLocalAttempts, useRuns, useRunStore, useServerAttempts, useUploadAttempts } from '@/lib/practice/hooks';
import type { LocalAttempt, Run } from '@/lib/practice/local';
import { testName } from '@/lib/practice/run';
import type { CatalogTest, OwnAttempt } from '@/lib/practice/types';
import { useTitle } from '@/lib/title';

import { TeacherPractice } from './TeacherPractice';

// The Practice tab: mock tests for students, the groups' results for teachers.
export function Practice() {
  const kind = useMe().data?.kind;
  return kind === 'teacher' ? <TeacherPractice /> : <StudentPractice />;
}

type Tab = 'new' | 'run' | 'passed';

type Card =
  | { kind: 'new'; code: string; title: string; test: CatalogTest }
  | { kind: 'locked'; code: string; title: string; test: CatalogTest }
  | { kind: 'run'; code: string; title: string; test?: CatalogTest; run: Run }
  | { kind: 'passed'; code: string; title: string; test?: CatalogTest; latest: LocalAttempt; attempts: number };

const TAB_KEY = 'mb.practice.tab';
const EMPTY: Record<Tab, { icon: LucideIcon; title: string }> = {
  new: { icon: ClipboardList, title: 'Nothing announced yet — the first one will land here.' },
  run: { icon: ClipboardList, title: 'Nothing half-finished. Clean slate.' },
  passed: { icon: ClipboardList, title: 'Nothing passed yet — your first result will land here.' },
};

function readTab(): Tab | null {
  try {
    const v = sessionStorage.getItem(TAB_KEY);
    return v === 'new' || v === 'run' || v === 'passed' ? v : null;
  } catch {
    return null;
  }
}

/** The server's copy of an attempt this browser doesn't have, in this browser's shape. */
const asLocal = (s: OwnAttempt): LocalAttempt => ({ ...s, code: s.test, uploaded: true });

// Mock tests (the design reference's assessment lists): a search, tabs for
// New / In progress / Passed, and a grid of cards. A test in progress
// continues straight into the test; a passed one leads to its results or a
// retake; tests whose questions are still being checked are dimmed under New.
function StudentPractice() {
  useTitle('Mock tests');
  const catalog = useCatalog();
  const runs = useRuns();
  const local = useLocalAttempts();
  // Whatever the upload pass last brought from the server (no request of its own).
  const server = useServerAttempts(false);
  useUploadAttempts(true);
  const runStore = useRunStore();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Tab | null>(readTab);

  const tests = catalog.data ?? [];
  const runMap = runs.data ?? {};
  const known = new Set(tests.map((t) => t.code));

  // Finished attempts, this browser's and the server's, newest first.
  const mine = local.data ?? [];
  const ids = new Set(mine.map((a) => a.id));
  const finished = [...mine, ...(server.data ?? []).filter((s) => !ids.has(s.id)).map(asLocal)].sort((a, b) => b.finished_at.localeCompare(a.finished_at));
  const byCode = new Map<string, LocalAttempt[]>();
  for (const a of finished) byCode.set(a.code, [...(byCode.get(a.code) ?? []), a]);
  const pending = mine.filter((a) => !a.uploaded && !a.rejected).length;

  const q = query.trim().toLowerCase();
  const matches = (c: Card) => !q || testName(c.title).toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);

  const fresh: Card[] = tests
    .filter((t) => !runMap[t.code] && !byCode.has(t.code))
    .map((t): Card => ({ kind: t.version == null ? 'locked' : 'new', code: t.code, title: t.title, test: t }))
    .sort((a, b) => Number(a.kind === 'locked') - Number(b.kind === 'locked'));
  const running: Card[] = [
    ...tests.filter((t) => runMap[t.code]).map((t): Card => ({ kind: 'run', code: t.code, title: t.title, test: t, run: runMap[t.code]! })),
    ...Object.values(runMap)
      .filter((r) => !known.has(r.code))
      .map((r): Card => ({ kind: 'run', code: r.code, title: r.title, run: r })),
  ];
  const passedCodes = [...tests.map((t) => t.code).filter((c) => byCode.has(c)), ...[...byCode.keys()].filter((c) => !known.has(c))];
  const passed: Card[] = passedCodes.map((code) => {
    const list = byCode.get(code)!;
    return { kind: 'passed', code, title: list[0]!.title, test: tests.find((t) => t.code === code), latest: list[0]!, attempts: list.length };
  });

  const lists: Record<Tab, Card[]> = { new: fresh.filter(matches), run: running.filter(matches), passed: passed.filter(matches) };
  // Until a tab is chosen: a test in progress first, then what's new, then the results.
  const tab: Tab = picked ?? (running.length ? 'run' : fresh.some((c) => c.kind === 'new') ? 'new' : passed.length ? 'passed' : 'new');
  const choose = (t: Tab) => {
    setPicked(t);
    try {
      sessionStorage.setItem(TAB_KEY, t);
    } catch {
      // Not kept: the tab is chosen again next time.
    }
  };
  const shown = lists[tab];

  const packages = useLocalPackages(
    shown.flatMap((c) =>
      c.kind === 'new' ? [{ code: c.code, version: c.test.version! }] : c.kind === 'run' ? [{ code: c.code, version: c.run.version }] : c.kind === 'passed' ? [{ code: c.code, version: c.latest.version }] : [],
    ),
  );

  const discard = (code: string, name: string) =>
    confirm({ title: `Discard your progress in ${name}?`, message: 'The answers you gave in this attempt are deleted.', onConfirm: () => runStore.clear(code) });

  const loading = catalog.isPending || runs.isPending || local.isPending;

  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-primary">
            <ClipboardList size={19} strokeWidth={2} aria-hidden="true" />
          </span>
          <h1 className="truncate text-[28px] font-semibold leading-[34px] tracking-[-0.03em] text-title md:text-[32px] md:leading-[38px]">Mock tests</h1>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Search assessments</span>
            <Search size={16} strokeWidth={2} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assessments"
              className="h-[38px] w-full rounded-full border border-line bg-surface-2 pl-[38px] pr-4 text-[14px] font-medium text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-accent"
            />
          </label>
          <div className="max-w-full overflow-x-auto no-scrollbar">
            <Segmented
              label="Which tests"
              value={tab}
              onChange={choose}
              options={[
                { value: 'new', label: 'New', count: loading ? undefined : lists.new.length },
                { value: 'run', label: 'In progress', count: loading ? undefined : lists.run.length },
                { value: 'passed', label: 'Passed', count: loading ? undefined : lists.passed.length },
              ]}
            />
          </div>
        </div>
      </header>

      {pending > 0 && (
        <p className="t-subhead mb-4 flex items-center gap-2 text-ink-2" role="status">
          <Icon as={CloudUpload} size={17} className="text-ink-3" />
          {pending} {pending === 1 ? 'result' : 'results'} waiting to send to your teachers
        </p>
      )}

      {loading ? (
        <Grid>
          {[0, 1, 2].map((i) => (
            <TestCardSkeleton key={i} />
          ))}
        </Grid>
      ) : catalog.isError && running.length === 0 && passed.length === 0 ? (
        <div className="mx-auto max-w-xl">
          <ErrorState title="Couldn’t load the tests" message={describeError(catalog.error)} onRetry={() => void catalog.refetch()} retrying={catalog.isFetching} />
        </div>
      ) : shown.length === 0 ? (
        q ? <EmptyState icon={SearchX} title={`Nothing here matches “${query.trim()}”.`} message="Try another name, or another tab." /> : <EmptyState {...EMPTY[tab]} />
      ) : (
        <Grid>
          {shown.map((c, i) => {
            const name = testName(c.title);
            if (c.kind === 'locked') return <LockedTestCard key={c.code} test={c.test} name={name} index={i} />;
            if (c.kind === 'new') {
              const pkg = localPackage(packages, c.code, c.test.version);
              return <NewTestCard key={c.code} test={c.test} name={name} rows={plannedRows(shapeOf(pkg, c.test))} index={i} />;
            }
            if (c.kind === 'run') {
              const pkg = localPackage(packages, c.code, c.run.version);
              const shape = shapeOf(pkg, c.test);
              const questions = pkg ? shape.reduce((n, m) => n + m.questions, 0) : (c.test?.questions ?? 0);
              return (
                <RunTestCard
                  key={c.code}
                  code={c.code}
                  name={name}
                  run={c.run}
                  rows={runRows(shape, c.run)}
                  published={c.test?.published_at ?? pkg?.published_at ?? null}
                  questions={questions}
                  index={i}
                  onDiscard={() => discard(c.code, name)}
                />
              );
            }
            const pkg = localPackage(packages, c.code, c.latest.version);
            return <PassedTestCard key={c.code} code={c.code} name={name} latest={c.latest} attempts={c.attempts} rows={attemptRows(shapeOf(pkg, c.test), c.latest, pkg)} index={i} />;
          })}
        </Grid>
      )}
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-[14px]">{children}</div>;
}
