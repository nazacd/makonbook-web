import { ArrowDown, ArrowRight, ArrowUp, BookOpen, ChevronDown, ChevronUp, CloudUpload, Lock, RefreshCw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { useCatalog, useLocalAttempts, useRuns, useUploadAttempts } from '@/lib/practice/hooks';
import type { LocalAttempt, Run } from '@/lib/practice/local';
import { SUBJECT_LABEL, SUBJECT_SHORT, testName, testRange } from '@/lib/practice/run';
import type { CatalogTest } from '@/lib/practice/types';
import { useTitle } from '@/lib/title';

import { TeacherPractice } from './TeacherPractice';

/** A run of this many finished tests in a row folds into one node. */
const FOLD_AT = 4;

type TestNode = { kind: 'test'; test: CatalogTest; done: boolean; run?: Run; latest?: LocalAttempt };
type Node = TestNode | { kind: 'fold'; tests: TestNode[] };

// The student's Practice tab (the phone's StudentPractice): their latest
// full-test score, then the program as a path, test by test in order. Tests
// not open yet are one locked line at the end.
export function Practice() {
  const kind = useMe().data?.kind;
  return kind === 'teacher' ? <TeacherPractice /> : <StudentPractice />;
}

function StudentPractice() {
  useTitle('Practice');
  const catalog = useCatalog();
  const runs = useRuns();
  const attempts = useLocalAttempts();
  useUploadAttempts(true);
  const [unfolded, setUnfolded] = useState(false);

  const mine = attempts.data ?? []; // newest first
  const tests = catalog.data ?? [];
  const open = tests.filter((t) => t.version != null);
  const locked = tests.filter((t) => t.version == null);
  const pending = mine.filter((a) => !a.uploaded && !a.rejected).length;
  const fullScores = mine
    .filter((a) => a.total != null)
    .map((a) => a.total!)
    .reverse(); // oldest first

  const testNodes: TestNode[] = open.map((test) => {
    const latest = mine.find((a) => a.code === test.code);
    return { kind: 'test', test, done: !!latest, run: runs.data?.[test.code], latest };
  });
  const folded = fold(testNodes);
  const foldHead = folded.find((n) => n.kind === 'fold')?.tests[0]?.test.code;
  const nodes = unfolded && foldHead ? testNodes : folded;
  const fresh = mine.length === 0 && Object.keys(runs.data ?? {}).length === 0;
  const startHere = fresh ? testNodes.find((n) => !n.done)?.test.code : undefined;

  return (
    <div className="mx-auto w-full max-w-xl">
      {fullScores.length > 0 && <ScoreHero scores={fullScores} />}
      {pending > 0 && (
        <p className="t-subhead mb-5 flex items-center gap-2 text-ink-2">
          <Icon as={CloudUpload} size={17} className="text-ink-3" />
          {pending} {pending === 1 ? 'result' : 'results'} waiting to send
        </p>
      )}
      {catalog.isPending ? (
        <div className="flex flex-col gap-6 pt-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton width={22} height={22} radius={11} />
              <Skeleton width="50%" height={20} />
            </div>
          ))}
        </div>
      ) : catalog.isError ? (
        <ErrorState title="Couldn’t load the tests" message={describeError(catalog.error)} onRetry={() => void catalog.refetch()} retrying={catalog.isFetching} />
      ) : open.length === 0 && locked.length === 0 ? (
        <EmptyState icon={BookOpen} title="No tests yet" message="Tests appear here one by one as they’re ready." />
      ) : (
        <div>
          {nodes.map((node, i) => (
            <PathNode
              key={node.kind === 'test' ? node.test.code : 'fold'}
              node={node}
              first={i === 0}
              last={i === nodes.length - 1 && locked.length === 0}
              intoLocked={i === nodes.length - 1 && locked.length > 0}
              startHere={node.kind === 'test' && node.test.code === startHere}
              refold={unfolded && node.kind === 'test' && node.test.code === foldHead}
              onToggleFold={() => setUnfolded((u) => !u)}
            />
          ))}
          {locked.length > 0 && <LockedTests tests={locked} first={nodes.length === 0} />}
        </div>
      )}
    </div>
  );
}

/** Folds a run of FOLD_AT or more finished tests (nothing in progress) into one node. */
function fold(nodes: TestNode[]): Node[] {
  const out: Node[] = [];
  let streak: TestNode[] = [];
  const flush = () => {
    if (streak.length >= FOLD_AT) out.push({ kind: 'fold', tests: streak });
    else out.push(...streak);
    streak = [];
  };
  for (const n of nodes) {
    if (n.done && !n.run) streak.push(n);
    else {
      flush();
      out.push(n);
    }
  }
  flush();
  return out;
}

function ScoreHero({ scores }: { scores: number[] }) {
  const last = scores[scores.length - 1]!;
  const change = scores.length > 1 ? last - scores[scores.length - 2]! : 0;
  return (
    <section className="mb-7 min-h-[140px]" aria-label={`Latest full test ${last}${change ? `, ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}` : ''}`}>
      <p className="t-subhead text-ink-2">Latest full test</p>
      <p className="flex items-baseline gap-3">
        <span className="font-title tabular text-[64px] font-bold leading-[72px] text-ink">{last}</span>
        {change !== 0 && (
          <span className={`flex items-center ${change > 0 ? 'text-good' : 'text-bad'}`}>
            <Icon as={change > 0 ? ArrowUp : ArrowDown} size={20} strokeWidth={2.5} className="text-current" />
            <span className="font-title tabular text-[20px] font-bold">{Math.abs(change)}</span>
          </span>
        )}
      </p>
      {scores.length > 1 && <Sparkline scores={scores} />}
    </section>
  );
}

function Sparkline({ scores }: { scores: number[] }) {
  const w = 168;
  const h = 34;
  const lo = Math.min(...scores) - 20;
  const hi = Math.max(...scores) + 20;
  const points = scores.map((s, i) => [(i * w) / (scores.length - 1), h - ((s - lo) / (hi - lo)) * h] as const);
  const [lx, ly] = points[points.length - 1]!;
  return (
    <svg width={w + 4} height={h + 4} className="mt-2 overflow-visible" aria-hidden="true">
      <polyline points={points.map(([x, y]) => `${x + 2},${y + 2}`).join(' ')} fill="none" className="stroke-ink-3" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx + 2} cy={ly + 2} r={3.5} className="fill-primary" />
    </svg>
  );
}

// One stop on the path: the rail through a node, the test, and on the right
// what matters about it (score, or where you stopped).
function PathNode({ node, first, last, intoLocked, startHere, refold, onToggleFold }: { node: Node; first: boolean; last: boolean; intoLocked: boolean; startHere: boolean; refold: boolean; onToggleFold: () => void }) {
  if (node.kind === 'fold') {
    const label = testRange(node.tests.map((n) => n.test.title));
    return (
      <Row first={first} last={last} intoLocked={intoLocked} dot={<Dot kind="fold" />} onClick={onToggleFold} label={`${label}, ${node.tests.length} done`}>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="t-title3 text-ink">{label}</span>
          <span className="t-subhead text-ink-2">{node.tests.length} done</span>
        </span>
        <Icon as={ChevronDown} size={20} className="text-ink-3" />
      </Row>
    );
  }
  const { test, done, run, latest } = node;
  const name = testName(test.title);
  const score = latest ? (latest.total != null ? String(latest.total) : `${SUBJECT_SHORT[latest.sections[0]!]} ${latest.scores[latest.sections[0]!]?.score ?? '–'}`) : null;
  const where = run ? `${run.sections.length > 1 ? 'Full test' : SUBJECT_LABEL[run.sections[0]!]} · Part ${run.stage + 1}` : null;
  const sub = run ? where : startHere ? 'Start here' : null;
  const label = [name, run && `in progress, ${where}`, score && (run ? `last ${score}` : score), startHere && 'start here'].filter(Boolean).join(', ');
  return (
    <Row first={first} last={last} intoLocked={intoLocked} dot={<Dot kind={run ? 'run' : done ? 'done' : 'open'} />} to={`/practice/test/${encodeURIComponent(test.code)}`} label={label}>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="t-title3 text-ink">{name}</span>
        {sub && (
          <span className={`t-subhead flex items-center gap-1 ${run ? 'font-medium text-accent' : 'text-ink-2'}`}>
            {run && <Icon as={ArrowRight} size={15} strokeWidth={2.25} className="text-accent" />}
            {sub}
          </span>
        )}
      </span>
      {refold && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onToggleFold();
          }}
          aria-label="Fold finished tests"
          className="p-2">
          <Icon as={ChevronUp} size={20} className="text-ink-3" />
        </button>
      )}
      {score && latest?.total != null ? (
        <span className={`font-title tabular ${run ? 'text-[19px] font-semibold text-ink-3' : 'text-[22px] font-bold text-ink'}`}>{score}</span>
      ) : score ? (
        <span className="t-subhead tabular text-ink-2">{score}</span>
      ) : null}
    </Row>
  );
}

// The tests not open yet: one faded line at the end of the path, opening in
// place to each test with a lock and a bar of how far its questions have
// been checked.
function LockedTests({ tests, first }: { tests: CatalogTest[]; first: boolean }) {
  const [open, setOpen] = useState(false);
  const label = testRange(tests.map((t) => t.title));
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${label}, not open yet`} className="-mx-5 flex w-[calc(100%+40px)] items-stretch gap-4 px-5 text-left active:bg-surface-2">
        <Rail top={!first} faded bottom={open} fadedBottom dot={<Dot kind="locked" />} />
        <span className="flex min-h-[60px] flex-1 items-center gap-3 opacity-55">
          <span className="t-callout flex-1 text-ink-2">{label}</span>
          <Icon as={open ? ChevronUp : ChevronDown} size={20} className="text-ink-3" />
        </span>
      </button>
      {open &&
        tests.map((t, i) => {
          const checked = t.questions ? Math.min(1, t.approved / t.questions) : 0;
          return (
            <div key={t.code} className="flex min-h-14 items-stretch gap-4" aria-label={`${testName(t.title)}, not open yet, being checked`}>
              <Rail top faded bottom={i < tests.length - 1} fadedBottom dot={<Dot kind="lockedSmall" />} />
              <div className="flex flex-1 items-center gap-3">
                <span className="t-callout flex-1 text-ink-2">{testName(t.title)}</span>
                <Icon as={Lock} size={15} className="text-ink-3" />
                <span className="block h-1.5 w-14 overflow-hidden rounded-full bg-track">
                  <span className="block h-1.5 rounded-full bg-fill-good" style={{ width: `${checked * 100}%` }} />
                </span>
              </div>
            </div>
          );
        })}
    </>
  );
}

function Row({ first, last, intoLocked, dot, to, onClick, label, children }: { first: boolean; last: boolean; intoLocked: boolean; dot: ReactNode; to?: string; onClick?: () => void; label: string; children: ReactNode }) {
  const className = '-mx-5 flex w-[calc(100%+40px)] items-stretch gap-4 px-5 text-left active:bg-surface-2';
  const body = (
    <>
      <Rail top={!first} bottom={!last} fadedBottom={intoLocked} dot={dot} />
      <span className="flex min-h-[68px] flex-1 items-center gap-3 py-2.5">{children}</span>
    </>
  );
  return to ? (
    <Link to={to} aria-label={label} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} className={className}>
      {body}
    </button>
  );
}

function Rail({ top, bottom, dot, faded, fadedBottom }: { top: boolean; bottom: boolean; dot: ReactNode; faded?: boolean; fadedBottom?: boolean }) {
  const segment = (on: boolean, dim: boolean) => <span className={`w-0.5 flex-1 ${on ? 'bg-line-strong' : ''} ${dim ? 'opacity-50' : ''}`} />;
  return (
    <span className="flex w-[22px] flex-col items-center">
      {segment(top, !!faded)}
      {dot}
      {segment(bottom, !!fadedBottom)}
    </span>
  );
}

type DotKind = 'done' | 'fold' | 'run' | 'open' | 'update' | 'locked' | 'lockedSmall';

function Dot({ kind }: { kind: DotKind }) {
  switch (kind) {
    case 'done':
      return <span className="size-[22px] shrink-0 rounded-full bg-primary" />;
    case 'fold':
      return (
        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 border-primary bg-brand">
          <span className="size-4 rounded-full bg-primary" />
        </span>
      );
    case 'run':
      return (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-tint">
          <span className="size-[22px] rounded-full border-[3px] border-accent bg-brand" />
        </span>
      );
    case 'update':
      return (
        <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 border-watch bg-brand">
          <Icon as={RefreshCw} size={11} strokeWidth={2.5} className="text-watch" />
        </span>
      );
    case 'lockedSmall':
      return <span className="size-3 shrink-0 rounded-full border-2 border-line-strong bg-brand" />;
    case 'locked':
      return (
        <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 border-line-strong bg-brand">
          <Icon as={Lock} size={11} strokeWidth={2.5} className="text-ink-3" />
        </span>
      );
    default:
      return <span className="size-[22px] shrink-0 rounded-full border-2 border-line-strong bg-brand" />;
  }
}
