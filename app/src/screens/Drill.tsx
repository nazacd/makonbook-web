import { Calculator as CalculatorIcon, Dumbbell, Moon, PartyPopper, Sun, Superscript, X, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Calculator } from '@/components/practice/Calculator';
import { Reference } from '@/components/practice/Reference';
import { Skeleton } from '@/components/States';
import { DrillQuestion } from '@/components/training/DrillQuestion';
import { useIsDark } from '@/layouts/AppShell';
import { useAppearance } from '@/lib/appearance';
import { useLocalAttempts, usePerson, useUploadAttempts } from '@/lib/practice/hooks';
import { drillQueue, markResolved, useAnswered, useResolved, type Answered, type DrillFilter } from '@/lib/practice/mistakes';
import { useTitle } from '@/lib/title';

// A Training Hall drill session (the spec's 5.10), full screen: up to twenty
// questions to repair (a topic's, a subtopic's, or every mistake), one at a
// time. A right answer resolves the question for good (markResolved); a
// skipped one can be tried again at the end. The list is fixed when the
// session starts, so resolving a question doesn't reshuffle what's ahead.

function filterOf(params: URLSearchParams): DrillFilter {
  const subject = params.get('subject');
  return {
    subject: subject === 'math' || subject === 'english' ? subject : undefined,
    domain: params.get('domain') || undefined,
    skill: params.get('skill') || undefined,
  };
}

export function Drill() {
  const [params] = useSearchParams();
  return <DrillFor key={params.toString()} filter={filterOf(params)} />;
}

function DrillFor({ filter }: { filter: DrillFilter }) {
  const topic = filter.skill ?? filter.domain ?? 'Your mistakes';
  useTitle(`${topic} · Training Hall`);
  // Opened straight from the dashboard, or in a browser that hasn't synced
  // yet: bring in the server's attempts first, then take the session's list.
  const sync = useUploadAttempts(true);
  const local = useLocalAttempts();
  const { answered, isPending } = useAnswered();
  const resolved = useResolved();
  const [initial, setInitial] = useState<Answered[] | null>(null);
  // Taken once, when everything has arrived; later syncs don't touch a session under way.
  if (initial === null && !isPending && !sync.isPending && !local.isFetching) setInitial(drillQueue(answered, resolved, filter));

  if (initial === null) {
    return (
      <Frame topic={topic} cleared={0} total={0}>
        <Loading />
      </Frame>
    );
  }
  return <Session initial={initial} topic={topic} />;
}

function Session({ initial, topic }: { initial: Answered[]; topic: string }) {
  const person = usePerson();
  const items = initial;
  const [order, setOrder] = useState(() => initial.map((a) => a.id));
  const [pos, setPos] = useState(0);
  const [cleared, setCleared] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [calculator, setCalculator] = useState<'off' | 'open' | 'hidden'>('off');
  const [reference, setReference] = useState(false);

  const current = items.find((a) => a.id === order[pos]);
  const math = current?.subject === 'math';

  const clear = (id: string) => {
    markResolved(person, id);
    setCleared((c) => (c.includes(id) ? c : [...c, id]));
  };
  const skip = (id: string) => {
    setSkipped((s) => [...s, id]);
    setPos((p) => p + 1);
  };
  const retrySkipped = () => {
    setOrder(skipped);
    setSkipped([]);
    setPos(0);
  };

  const tools = math ? (
    <>
      <Tool icon={CalculatorIcon} label="Calculator" on={calculator === 'open'} onClick={() => setCalculator((c) => (c === 'open' ? 'hidden' : 'open'))} />
      <Tool icon={Superscript} label="Reference" on={reference} onClick={() => setReference((v) => !v)} />
    </>
  ) : null;

  return (
    <Frame topic={topic} cleared={cleared.length} total={items.length} tools={tools}>
      {items.length === 0 ? (
        <Nothing />
      ) : current ? (
        <DrillQuestion
          key={`${current.id}-${pos}`}
          item={current}
          number={pos + 1}
          remaining={items.length - cleared.length}
          last={pos === order.length - 1}
          keys={!reference}
          onCleared={() => clear(current.id)}
          onSkip={() => skip(current.id)}
          onNext={() => setPos((p) => p + 1)}
        />
      ) : (
        <Done cleared={cleared.length} total={items.length} skipped={skipped.length} onRetry={retrySkipped} />
      )}
      {/* Mounted once first opened, then only hidden, so it keeps the work (as in the test). */}
      {calculator !== 'off' && <Calculator visible={math && calculator === 'open'} runId="drill" onClose={() => setCalculator('hidden')} />}
      {reference && math && <Reference onClose={() => setReference(false)} />}
    </Frame>
  );
}

/** The full-screen frame: the topic, the tools, the theme, "x / n cleared", and Exit. */
function Frame({ topic, cleared, total, tools, children }: { topic: string; cleared: number; total: number; tools?: ReactNode; children: ReactNode }) {
  const { setMode } = useAppearance();
  const dark = useIsDark();
  return (
    <div className="flex h-dvh flex-col bg-brand">
      <header className="flex h-[62px] shrink-0 items-center gap-1 border-b border-line bg-surface pl-4 pr-2 sm:gap-2 sm:pl-[22px] sm:pr-4">
        <p className="mr-auto min-w-0 truncate text-[14px] font-medium text-ink">{topic}</p>
        {tools}
        <button
          type="button"
          onClick={() => setMode(dark ? 'light' : 'dark')}
          aria-label={dark ? 'Light mode' : 'Dark mode'}
          className="flex size-10 shrink-0 items-center justify-center rounded-chip text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink">
          {dark ? <Sun size={19} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={19} strokeWidth={1.75} aria-hidden="true" />}
        </button>
        {total > 0 && (
          <div className="flex shrink-0 items-center gap-3 px-1 sm:px-3" role="progressbar" aria-label="Cleared" aria-valuemin={0} aria-valuemax={total} aria-valuenow={cleared}>
            <span className="tabular whitespace-nowrap text-[13px] font-medium text-ink-3">
              {cleared} / {total}
              <span className="hidden sm:inline"> cleared</span>
            </span>
            <span className="hidden h-[3px] w-[120px] overflow-hidden rounded-full bg-surface-2 md:block" aria-hidden="true">
              <span className="block h-full rounded-full bg-fill-good transition-[width] duration-[400ms]" style={{ width: `${(cleared / total) * 100}%` }} />
            </span>
          </div>
        )}
        <Link to="/training-hall" className="flex h-10 shrink-0 items-center gap-1.5 rounded-chip px-2 text-[14px] font-medium text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink">
          <X size={16} strokeWidth={1.9} aria-hidden="true" />
          Exit
        </Link>
      </header>
      {children}
    </div>
  );
}

/** A header tool, as in the reference: the icon over its label (the label hides on a phone). */
function Tool({ icon: I, label, on, onClick }: { icon: LucideIcon; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      className={`flex h-[52px] min-w-10 shrink-0 flex-col items-center justify-center gap-1 rounded-chip px-1.5 transition-colors duration-150 sm:min-w-[76px] ${on ? 'bg-accent-tint text-accent' : 'text-ink hover:bg-surface-2'}`}>
      <I size={20} strokeWidth={1.75} aria-hidden="true" />
      <span className="hidden text-[12.5px] font-medium leading-none sm:block">{label}</span>
    </button>
  );
}

function Done({ cleared, total, skipped, onRetry }: { cleared: number; total: number; skipped: number; onRetry: () => void }) {
  const copy =
    cleared === total
      ? 'Every question in this session is resolved, and your mastery climbed with it.'
      : cleared > 0
        ? 'Nice work. Whatever is left stays in the Training Hall for your next session.'
        : 'Nothing resolved this time, and that’s fine. They’ll be waiting in the Training Hall.';
  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-10">
      <div className="rise flex max-w-xl flex-col items-center text-center">
        <span className={`mb-5 flex size-16 items-center justify-center rounded-[18px] ${cleared ? 'bg-good-tint text-good' : 'bg-accent-tint text-accent'}`}>
          {cleared ? <PartyPopper size={30} strokeWidth={1.8} aria-hidden="true" /> : <Dumbbell size={30} strokeWidth={1.8} aria-hidden="true" />}
        </span>
        <p className="t-micro text-ink-3">Session complete</p>
        <h1 className="mt-1.5 text-[28px] font-medium leading-[34px] tracking-[-0.02em] text-ink">
          <span className="tabular">
            {cleared} / {total}
          </span>{' '}
          cleared
        </h1>
        <p className="mt-2 text-[14px] leading-[21px] text-ink-2">{copy}</p>
        <div className="mt-7 flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
          {skipped > 0 && (
            <button type="button" onClick={onRetry} className="h-10 rounded-[10px] border border-line-strong bg-surface px-5 text-[14px] font-semibold text-ink transition-colors duration-150 hover:bg-surface-2">
              Try the {skipped} skipped
            </button>
          )}
          <Link to="/training-hall" className="lift flex h-10 items-center justify-center rounded-[10px] bg-primary px-5 text-[14px] font-semibold text-on-primary hover:bg-primary-hover">
            Back to Training Hall
          </Link>
          <Link to="/" className="flex h-10 items-center justify-center rounded-[10px] border border-line-strong bg-surface px-5 text-[14px] font-semibold text-ink transition-colors duration-150 hover:bg-surface-2">
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

function Nothing() {
  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-10">
      <div className="rise flex max-w-md flex-col items-center text-center">
        <span className="mb-5 flex size-16 items-center justify-center rounded-[18px] bg-good-tint text-good">
          <Dumbbell size={30} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h1 className="text-[24px] font-medium leading-[30px] text-ink">Nothing to drill here</h1>
        <p className="mt-2 text-[14px] leading-[21px] text-ink-2">Every question here is resolved, or no assessment has caught one yet. Clean slate.</p>
        <div className="mt-7 flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:justify-center">
          <Link to="/training-hall" className="lift flex h-10 items-center justify-center rounded-[10px] bg-primary px-5 text-[14px] font-semibold text-on-primary hover:bg-primary-hover">
            Back to Training Hall
          </Link>
          <Link to="/practice" className="flex h-10 items-center justify-center rounded-[10px] border border-line-strong bg-surface px-5 text-[14px] font-semibold text-ink transition-colors duration-150 hover:bg-surface-2">
            Go to assessments
          </Link>
        </div>
      </div>
    </main>
  );
}

function Loading() {
  return (
    <>
      <main className="min-h-0 flex-1 overflow-hidden" aria-busy="true" aria-label="Loading the questions">
        <div className="mx-auto flex w-full max-w-[680px] flex-col px-4 pt-8 sm:px-6 sm:pt-10">
          <div className="flex items-center justify-between">
            <Skeleton width={150} height={11} />
            <Skeleton width={96} height={32} radius={16} />
          </div>
          <div className="mt-10 flex flex-col gap-2.5">
            <Skeleton width={24} height={14} />
            <Skeleton height={16} />
            <Skeleton width="72%" height={16} />
          </div>
          <div className="mt-8 flex flex-col gap-2">
            <Skeleton width={110} height={11} />
            <div className="max-w-[362px]">
              <Skeleton height={40} radius={8} />
            </div>
          </div>
        </div>
      </main>
      <footer className="h-[68px] shrink-0 border-t border-line bg-surface" />
    </>
  );
}
