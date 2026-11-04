import { useQueries } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Clock, Play, RotateCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';

import { describeError } from '@/api/errors';
import { parkReasonLabel, useDeleteParked, useParked, useSaveParked, type ParkedQuestion } from '@/api/learning';
import { useMe } from '@/api/queries';
import { Spinner } from '@/components/Button';
import { CloseButton, Dialog, foldersOf, parkedInput, questionPlace, sameFolder } from '@/components/practice/AskLater';
import { RichContent } from '@/components/practice/RichContent';
import { ErrorState, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { confirm } from '@/lib/confirm';
import { packageQuery } from '@/lib/practice/hooks';
import type { StoredPackage } from '@/lib/practice/local';
import type { PackageQuestion } from '@/lib/practice/types';
import { relativeDay, schoolDate } from '@/lib/schedule';
import { useTitle } from '@/lib/title';

type Status = ParkedQuestion['status'];
type Found = { stored?: StoredPackage; question?: PackageQuestion; loading: boolean };

const LETTERS = ['A', 'B', 'C', 'D'] as const;
/** How long "it stays in Waiting" shows under a row. */
const STUCK_MS = 2500;

// Problem questions (the reference's /problem-questions): the questions a
// student parked with "Ask later" during tests, waiting until they are sorted
// out. Each row shows the question it points at (from its test's package);
// focus mode goes through the waiting ones one at a time, with a line for the
// fix. Teachers see their groups' parked questions on each group's page.
export function ProblemQuestions() {
  useTitle('Problem questions');
  const kind = useMe().data?.kind;
  if (kind === 'teacher') {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <PageHeader title="Problem questions" />
        <p className="t-subhead rounded-card border border-line bg-surface p-5 text-ink-2">
          This page is for students: the questions they park with Ask later during a test. Your students’ waiting questions are on each group’s page.
        </p>
      </div>
    );
  }
  return <StudentProblems />;
}

/** "a test version" key, as packages are kept. */
const versionKey = (test: string, version: number) => `${test}@${version}`;

function findQuestion(stored: StoredPackage, p: ParkedQuestion): PackageQuestion | undefined {
  return stored.package.sections
    .find((s) => s.subject === p.subject)
    ?.modules.find((m) => m.module === p.module)
    ?.questions.find((q) => q.position === p.position);
}

const TEX_WORDS: Record<string, string> = {
  pi: 'π', theta: 'θ', alpha: 'α', beta: 'β', times: '×', cdot: '·', div: '÷', pm: '±', le: '≤', leq: '≤', ge: '≥', geq: '≥',
  ne: '≠', neq: '≠', approx: '≈', infty: '∞', circ: '°', degree: '°', angle: '∠', ldots: '…', dots: '…', cdots: '…', sqrt: '√',
};

/** A formula as plain text: fractions as a/b, a few symbols, the rest of the TeX dropped. */
function plainTex(tex: string): string {
  return tex
    .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
    .replace(/\\(?:text|mathrm|textbf|mathbf|operatorname)\{([^{}]*)\}/g, '$1')
    .replace(/\\sqrt\{([^{}]*)\}/g, '√$1')
    .replace(/\\left|\\right/g, '')
    .replace(/\\([a-zA-Z]+)/g, (_, w: string) => TEX_WORDS[w] ?? '')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/[{}]/g, '');
}

/** The content format as one line of plain text: no images, markup or table rules; formulas simplified. */
export function plainText(src: string): string {
  return src
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, t: string) => plainTex(t))
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, t: string) => plainTex(t))
    .replace(/<\/?u>/g, '')
    .replace(/\*+/g, '')
    .replace(/^\s*\|?[\s:|-]*-{3,}[\s:|-]*$/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function StudentProblems() {
  const parked = useParked();
  const now = useNow();
  const save = useSaveParked();
  const remove = useDeleteParked();
  const [tab, setTab] = useState<Status>('waiting');
  const [folder, setFolder] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ ids: string[]; at: number } | null>(null);
  const [stuck, setStuck] = useState<string | null>(null);

  useEffect(() => {
    if (!stuck) return;
    const id = setTimeout(() => setStuck(null), STUCK_MS);
    return () => clearTimeout(id);
  }, [stuck]);

  const items = useMemo(() => parked.data ?? [], [parked.data]);
  // One package per test version parked from, for the question text.
  const versions = useMemo(() => [...new Map(items.map((p) => [versionKey(p.test, p.version), p])).values()], [items]);
  const packages = useQueries({ queries: versions.map((p) => packageQuery(p.test, p.version)) });
  const byVersion = new Map<string, { stored?: StoredPackage; loading: boolean }>();
  versions.forEach((p, i) => byVersion.set(versionKey(p.test, p.version), { stored: packages[i]?.data, loading: !!packages[i]?.isPending }));
  const found = (p: ParkedQuestion): Found => {
    const v = byVersion.get(versionKey(p.test, p.version));
    return { stored: v?.stored, question: v?.stored ? findQuestion(v.stored, p) : undefined, loading: !!v?.loading };
  };

  const folders = foldersOf(items);
  const active = folder != null && folders.some((f) => sameFolder(f, folder)) ? folder : null;
  const inFolder = (p: ParkedQuestion) => active == null || sameFolder(p.folder, active);
  const waiting = items.filter((p) => p.status === 'waiting');
  const sorted = items.filter((p) => p.status === 'sorted');
  const shown = items.filter((p) => p.status === tab && inFolder(p));
  const queue = waiting.filter(inFolder);
  const today = schoolDate(now);
  const allToday = waiting.length > 0 && waiting.every((p) => schoolDate(Date.parse(p.created_at)) === today);
  const subtitle = waiting.length === 0 ? 'Nothing waiting.' : `${waiting.length} waiting${allToday ? ', all parked today' : ''}.`;
  const bars = (active == null ? folders : [active])
    .map((f) => {
      const all = items.filter((p) => sameFolder(p.folder, f));
      return { name: f, total: all.length, sorted: all.filter((p) => p.status === 'sorted').length };
    })
    .filter((b) => b.total > 0);

  const openFocus = (ids: string[], at: number) => setFocus({ ids, at });
  const sortOut = (p: ParkedQuestion) => save.mutate(parkedInput(p, { status: 'sorted' }));
  const stillStuck = (p: ParkedQuestion) => {
    if (p.status === 'sorted') save.mutate(parkedInput(p, { status: 'waiting' }));
    else setStuck(p.id);
  };
  const del = (p: ParkedQuestion) =>
    confirm({ title: 'Delete this question?', message: 'It comes off your Problem questions.', onConfirm: () => remove.mutate(p.id) });
  const busyId = save.isPending ? save.variables?.id : remove.isPending ? remove.variables : undefined;
  const failed = save.error ?? remove.error;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title="Problem questions" subtitle={parked.isPending ? undefined : subtitle} actions={!parked.isPending && !parked.isError && <Donut sorted={sorted.length} waiting={waiting.length} />} />

      {parked.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton height={52} radius={16} />
          <Skeleton height={36} width="60%" radius={18} />
          {[0, 1].map((i) => (
            <Skeleton key={i} height={112} radius={16} />
          ))}
        </div>
      ) : parked.isError ? (
        <ErrorState title="Couldn’t load your problem questions" message={describeError(parked.error)} onRetry={() => void parked.refetch()} retrying={parked.isFetching} />
      ) : (
        <div className="flex flex-col gap-4">
          {tab === 'waiting' && queue.length > 0 && (
            <button
              type="button"
              onClick={() => openFocus(queue.map((p) => p.id), 0)}
              className="flex w-full items-center gap-3 rounded-card border border-primary/20 bg-accent-tint px-4 py-3.5 text-left transition-colors duration-150 hover:border-primary/40">
              <Play size={13} strokeWidth={0} fill="currentColor" aria-hidden="true" className="shrink-0 text-primary" />
              <span className="t-subhead flex-1 font-bold text-ink">
                Go through these {queue.length} one at a time
              </span>
              <span className="t-caption hidden font-medium text-ink-3 sm:inline">or press a row</span>
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
            <FilterPill on={tab === 'waiting'} tone="brand" onClick={() => setTab('waiting')}>
              Waiting <Count n={waiting.filter(inFolder).length} />
            </FilterPill>
            <FilterPill on={tab === 'sorted'} tone="brand" onClick={() => setTab('sorted')}>
              Sorted <Count n={sorted.filter(inFolder).length} />
            </FilterPill>
            <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />
            <FilterPill on={active == null} tone="blue" onClick={() => setFolder(null)}>
              All groups
            </FilterPill>
            {folders.map((f) => (
              <FilterPill key={f} on={active != null && sameFolder(active, f)} tone="blue" onClick={() => setFolder(f)}>
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-info" />
                <span className="max-w-[160px] truncate">{f}</span>
                <Count n={items.filter((p) => p.status === tab && sameFolder(p.folder, f)).length} />
              </FilterPill>
            ))}
          </div>

          {bars.length > 0 && (
            <div className="flex flex-col gap-2.5 rounded-card border border-line bg-surface px-4 py-3">
              {bars.map((b) => (
                <div key={b.name} className="flex items-center gap-4">
                  <span className="t-footnote w-24 shrink-0 truncate font-medium text-info sm:w-40">{b.name}</span>
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-info/20"
                    role="progressbar"
                    aria-label={`${b.name}: ${b.sorted} of ${b.total} sorted out`}
                    aria-valuenow={b.sorted}
                    aria-valuemin={0}
                    aria-valuemax={b.total}>
                    <div className="h-full rounded-full bg-info transition-[width] duration-500" style={{ width: `${(b.sorted / b.total) * 100}%` }} />
                  </div>
                  <span className="t-caption tabular shrink-0 font-medium text-ink-3">
                    {b.sorted}/{b.total}
                  </span>
                </div>
              ))}
            </div>
          )}

          {failed && (
            <p role="alert" className="t-footnote text-bad">
              {describeError(failed)}
            </p>
          )}

          {shown.length === 0 ? (
            <div className="rounded-card border border-line bg-surface px-6 py-10 text-center">
              {tab === 'waiting' ? (
                <p className="t-subhead mx-auto max-w-md text-ink-2">
                  <span className="font-bold text-ink">Nothing waiting.</span> While you are taking a test, press <span className="font-bold text-ink">Ask later</span> on anything you do not understand. It lands here, and you carry on.
                </p>
              ) : (
                <p className="t-subhead mx-auto max-w-md text-ink-2">
                  <span className="font-bold text-ink">Nothing sorted yet.</span> Press <span className="font-bold text-ink">I get it now</span> on a question once it makes sense, and it moves here.
                </p>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((p, i) => (
                <ParkedRow
                  key={p.id}
                  item={p}
                  found={found(p)}
                  now={now}
                  busy={busyId === p.id}
                  stuck={stuck === p.id}
                  onOpen={() => openFocus(shown.map((x) => x.id), i)}
                  onSortOut={() => sortOut(p)}
                  onStillStuck={() => stillStuck(p)}
                  onDelete={() => del(p)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {focus && <FocusMode ids={focus.ids} start={focus.at} items={items} found={found} onClose={() => setFocus(null)} />}
    </div>
  );
}

function Count({ n }: { n: number }) {
  return n > 0 ? <span className="tabular text-[11px] font-semibold text-ink-3">{n}</span> : null;
}

function FilterPill({ on, tone, onClick, children }: { on: boolean; tone: 'brand' | 'blue'; onClick: () => void; children: ReactNode }) {
  const look = on ? (tone === 'brand' ? 'border-primary/45 bg-accent-tint text-ink' : 'border-info/60 bg-info-tint text-ink') : 'border-line bg-surface text-ink-2 hover:border-accent/45 hover:text-ink';
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`t-footnote inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 font-semibold transition-colors duration-150 ${look}`}>
      {children}
    </button>
  );
}

// The share sorted out, as a ring: green for sorted, a faint purple for waiting.
function Donut({ sorted, waiting }: { sorted: number; waiting: number }) {
  const total = sorted + waiting;
  const share = total ? sorted / total : 0;
  const r = 22;
  const c = 2 * Math.PI * r;
  const faint = { '--waiting': 'color-mix(in srgb, var(--color-primary) 30%, var(--color-surface))' } as CSSProperties;
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3" style={faint}>
      <div className="relative size-14 shrink-0">
        <svg viewBox="0 0 56 56" className="size-14 -rotate-90" aria-hidden="true">
          <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" style={{ stroke: 'var(--waiting)' }} />
          {share > 0 && <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" strokeDasharray={`${share * c} ${c}`} style={{ stroke: 'var(--color-fill-good)' }} />}
        </svg>
        <span className="t-caption tabular absolute inset-0 flex items-center justify-center font-extrabold text-ink">{Math.round(share * 100)}%</span>
      </div>
      <div className="t-caption flex flex-col gap-1 font-medium text-ink-2">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-fill-good" />
          <span className="tabular font-bold text-ink">{sorted}</span> sorted out
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full" style={{ background: 'var(--waiting)' }} />
          <span className="tabular font-bold text-ink">{waiting}</span> still waiting
        </span>
      </div>
    </div>
  );
}

type RowProps = {
  item: ParkedQuestion;
  found: Found;
  now: number;
  busy: boolean;
  stuck: boolean;
  onOpen: () => void;
  onSortOut: () => void;
  onStillStuck: () => void;
  onDelete: () => void;
};

function ParkedRow({ item, found, now, busy, stuck, onOpen, onSortOut, onStillStuck, onDelete }: RowProps) {
  const title = found.stored?.package.title ?? item.test;
  const preview = found.question ? plainText(found.question.stem) : null;
  const waiting = item.status === 'waiting';
  return (
    <li className={`rounded-card border border-l-[3px] border-line bg-surface ${waiting ? 'border-l-info' : 'border-l-fill-good'}`}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 rounded-chip text-left" aria-label={`${item.folder}: ${parkReasonLabel(item.reason)}. Open it`}>
          <span className="t-micro block text-info">{item.folder}</span>
          <span className="t-headline mt-1 block text-ink">{parkReasonLabel(item.reason)}</span>
          {preview != null ? (
            <span className="t-subhead mt-1 block truncate text-ink">{preview}</span>
          ) : found.loading ? (
            <span className="mt-2 block">
              <Skeleton width="70%" height={14} />
            </span>
          ) : null}
          <span className="t-caption mt-2 flex flex-wrap items-center gap-x-1.5 font-medium text-ink-3">
            {questionPlace({ title, subject: item.subject, module: item.module, position: item.position })}
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={12} strokeWidth={2} aria-hidden="true" />
              {relativeDay(Date.parse(item.created_at), now)}
            </span>
          </span>
          {item.fix && (
            <span className="t-footnote mt-2 block text-ink-2">
              <span className="font-bold text-good">Fix:</span> {item.fix}
            </span>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {waiting && (
            <button
              type="button"
              onClick={onSortOut}
              disabled={busy}
              className="t-footnote inline-flex h-9 items-center gap-1.5 rounded-full border border-good/60 bg-surface px-3.5 font-semibold text-good transition-colors duration-150 hover:bg-good-tint disabled:opacity-50">
              {busy ? <Spinner className="size-3.5" /> : <Check size={14} strokeWidth={2.4} aria-hidden="true" />}I get it now
            </button>
          )}
          <button
            type="button"
            onClick={onStillStuck}
            disabled={busy}
            className="t-footnote inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 font-medium text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink disabled:opacity-50">
            {busy && !waiting && <Spinner className="size-3.5" />}Still stuck
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            aria-label="Delete"
            title="Delete"
            className="flex size-9 items-center justify-center rounded-full text-ink-3 transition-colors duration-150 hover:bg-bad-tint hover:text-bad disabled:opacity-50">
            <Trash2 size={16} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </div>
      </div>
      {stuck && (
        <p role="status" className="t-caption fade border-t border-line px-4 py-2 font-medium text-ink-2">
          It stays in Waiting. Bring it to your next class.
        </p>
      )}
    </li>
  );
}

// Focus mode: the parked questions one at a time, the question drawn in
// full, a line for the fix (Enter saves it and sorts the question out), and
// ‹ › to move between them. The list is fixed when it opens, so a question
// sorted out stays in place behind ‹.
function FocusMode({ ids, start, items, found, onClose }: { ids: string[]; start: number; items: ParkedQuestion[]; found: (p: ParkedQuestion) => Found; onClose: () => void }) {
  const list = ids.map((id) => items.find((p) => p.id === id)).filter((p): p is ParkedQuestion => !!p);
  const [at, setAt] = useState(start);
  const i = Math.min(at, list.length - 1);
  const item = list[i];
  const [fix, setFix] = useState(item?.fix ?? '');
  const save = useSaveParked();

  if (!item) return null;
  const f = found(item);
  const q = f.question;
  const pkg = f.stored;
  const title = pkg?.package.title ?? item.test;

  const go = (next: number) => {
    if (next < 0 || next >= list.length) return onClose();
    setAt(next);
    setFix(list[next]!.fix);
    save.reset();
  };
  const gotIt = () => {
    if (save.isPending) return;
    save.mutate(parkedInput(item, { fix: fix.trim(), status: 'sorted' }), { onSuccess: () => go(i + 1) });
  };
  const stillStuck = () => {
    if (save.isPending) return;
    if (item.status === 'waiting' && fix.trim() === item.fix) return go(i + 1);
    save.mutate(parkedInput(item, { fix: fix.trim(), status: 'waiting' }), { onSuccess: () => go(i + 1) });
  };

  return (
    <Dialog label={`${parkReasonLabel(item.reason)}, ${i + 1} of ${list.length}`} onClose={onClose} width={820}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3">
        <p className="flex min-w-0 items-baseline gap-2.5">
          <span className="t-micro truncate text-info">{item.folder}</span>
          <span className="t-caption tabular font-medium text-ink-3">
            {i + 1} of {list.length}
          </span>
          {item.status === 'sorted' && <span className="t-caption font-bold text-good">Sorted</span>}
        </p>
        <CloseButton onClick={onClose} />
      </div>

      <div key={item.id} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <h2 className="t-title3 text-ink">{parkReasonLabel(item.reason)}</h2>
        {item.note && <p className="t-footnote mt-1 italic text-ink-2">{item.note}</p>}
        {q && pkg ? (
          <div className="mt-2 flex flex-col gap-4">
            {q.passage && (
              <div className="rounded-control bg-surface-2 p-4">
                <RichContent text={q.passage} images={pkg.package.images} links={pkg.images} />
              </div>
            )}
            <RichContent text={q.stem} images={pkg.package.images} links={pkg.images} />
            {q.type === 'mcq' && q.choices && (
              <ul className="flex flex-col gap-3" aria-label="Answer choices">
                {LETTERS.filter((l) => q.choices![l] != null).map((l) => (
                  <li key={l} className="flex min-h-[46px] items-center gap-3 rounded-lg border-[1.5px] border-ink px-3 py-2">
                    <span className="t-footnote flex size-6 shrink-0 items-center justify-center rounded-full border border-ink font-semibold text-ink">{l}</span>
                    <span className="min-w-0 flex-1">
                      <RichContent text={q.choices![l]} images={pkg.package.images} links={pkg.images} displayMath />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : f.loading ? (
          <div className="mt-3 flex flex-col gap-3">
            <Skeleton height={18} width="80%" />
            {[0, 1, 2, 3].map((n) => (
              <Skeleton key={n} height={46} radius={8} />
            ))}
          </div>
        ) : (
          <p className="t-subhead mt-3 text-ink-2">This question can’t be shown right now. Check the connection and open it again.</p>
        )}
        <p className="t-caption mt-4 font-medium text-ink-3">{questionPlace({ title, subject: item.subject, module: item.module, position: item.position })}</p>
      </div>

      <div className="flex shrink-0 flex-col gap-2 bg-surface-2 px-5 py-3.5">
        {save.isError && (
          <p role="alert" className="t-footnote text-bad">
            {describeError(save.error)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous question" className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface disabled:opacity-35">
              <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(i + 1)} disabled={i === list.length - 1} aria-label="Next question" className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface disabled:opacity-35">
              <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <input
            value={fix}
            onChange={(e) => setFix(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                gotIt();
              }
            }}
            maxLength={300}
            aria-label="The fix, in one line"
            placeholder="The fix, in one line — press Enter"
            className="t-footnote h-10 min-w-0 flex-1 basis-56 rounded-full border border-line bg-surface px-4 text-ink outline-none placeholder:text-ink-3 focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={stillStuck}
              disabled={save.isPending}
              className="t-footnote inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 font-semibold text-ink transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50">
              <RotateCw size={14} strokeWidth={2.2} aria-hidden="true" />
              Still stuck
            </button>
            <button
              type="button"
              onClick={gotIt}
              disabled={save.isPending}
              className="t-footnote inline-flex h-10 items-center gap-1.5 rounded-full border border-good/60 bg-surface px-4 font-semibold text-good transition-colors duration-150 hover:bg-good-tint disabled:opacity-50">
              {save.isPending ? <Spinner className="size-3.5" /> : <Check size={14} strokeWidth={2.4} aria-hidden="true" />}
              I get it now
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
