import { CalendarClock, ChevronLeft, History, Info, RotateCcw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { isDue, useMyAssignments } from '@/api/assignments';
import { dueLong } from '@/components/assignments/format';

import { describeError } from '@/api/errors';
import { Spinner } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { SAT_MODULE_MINUTES } from '@/components/practice/cards/modules';
import { minutesLong, SECTION_LABEL } from '@/components/practice/results/format';
import { Skeleton } from '@/components/States';
import { confirm } from '@/lib/confirm';
import { uuid } from '@/lib/device-id';
import { useCatalog, useLocalAttempts, usePackage, useRuns, useRunStore } from '@/lib/practice/hooks';
import { newRun, testName } from '@/lib/practice/run';
import type { Subject } from '@/lib/practice/types';
import { useTitle } from '@/lib/title';

type Choice = 'full' | Subject;

/** "Full test, Part 3" for both sections, "Math, Part 1" for one. */
function progressLine(sections: Subject[], stage: number): string {
  return `${sections.length > 1 ? 'Full test' : SECTION_LABEL[sections[0]!]}, Part ${stage + 1}`;
}

// A test's start page, as the design reference's: a bar with the way back and
// the title, a hint, the Timing and Scores card, and the button. Here the
// student also picks the full test or one section (a section the test lacks
// can't be picked), and a test in progress continues or is discarded. The
// package is fetched when the page opens; there is nothing to download by hand.
export function PracticeTest() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const runStore = useRunStore();
  const catalog = useCatalog();
  const runs = useRuns();
  const attempts = useLocalAttempts();
  const test = catalog.data?.find((t) => t.code === code);
  const run = runs.data?.[code];
  const pkg = usePackage(code, run?.version ?? test?.version ?? undefined, !!(run || test?.version));
  const mine = (attempts.data ?? []).filter((a) => a.code === code); // newest first
  const lastFull = mine.find((a) => a.total != null);
  const title = testName(test?.title ?? run?.title ?? code);
  useTitle(title);
  // An exam assigned by a teacher arrives with its sections (?sections=math).
  const [params] = useSearchParams();
  const wanted = (params.get('sections') ?? '').split(',').filter((x): x is Subject => x === 'english' || x === 'math');
  const [choice, setChoice] = useState<Choice>(wanted.length === 1 ? wanted[0]! : 'full');
  const assigned = (useMyAssignments().data ?? []).filter((a) => a.kind === 'exam' && a.test?.code === code && isDue(a)).sort((a, b) => a.due_at.localeCompare(b.due_at))[0];
  const ready = !!pkg.data;

  const has = (subject: Subject) => (pkg.data ? pkg.data.package.sections.some((s) => s.subject === subject) : test ? test[subject] > 0 : true);
  const minutes = (subject?: Subject) =>
    pkg.data
      ? pkg.data.package.sections.filter((s) => !subject || s.subject === subject).reduce((n, s) => n + s.modules.reduce((m, mod) => m + mod.minutes, 0), 0)
      : (['english', 'math'] as const).filter((s) => (!subject || s === subject) && has(s)).reduce((n, s) => n + 2 * SAT_MODULE_MINUTES[s], 0);
  const questions = (subject?: Subject) =>
    pkg.data
      ? pkg.data.package.sections.filter((s) => !subject || s.subject === subject).reduce((n, s) => n + s.modules.reduce((m, mod) => m + mod.questions.length, 0), 0)
      : test
        ? subject
          ? test[subject]
          : test.questions
        : 0;

  const begin = (sections: Subject[]) => {
    if (!pkg.data) return;
    if (run) runStore.clear(code); // with its calculator work
    runStore.save(newRun(pkg.data.package, sections, uuid(), new Date()));
    void navigate(`/practice/run/${encodeURIComponent(code)}`);
  };
  const sectionsOf = (c: Choice): Subject[] => (c === 'full' ? ['english', 'math'] : [c]);
  // One test in progress per test: starting another asks first.
  const start = (sections: Subject[]) =>
    run ? confirm({ title: 'Discard your progress?', message: 'The answers you gave in this attempt are deleted.', onConfirm: () => begin(sections) }) : begin(sections);
  const discard = () => confirm({ title: 'Discard your progress?', message: 'The answers you gave in this attempt are deleted.', onConfirm: () => runStore.clear(code) });

  if (catalog.isPending && !run) {
    return (
      <Page title={<Skeleton width={120} height={20} />}>
        <Skeleton height={52} radius={8} />
        <Skeleton height={200} radius={12} />
        <div className="flex justify-center">
          <Skeleton width={208} height={46} radius={8} />
        </div>
      </Page>
    );
  }
  if (!test && !run) {
    return (
      <Page title="Mock tests">
        <Notice tone="error" title="No such test" message={catalog.isError ? describeError(catalog.error) : 'This test isn’t in the catalog.'} />
      </Page>
    );
  }
  const locked = !run && test && test.version == null;
  const options: { value: Choice; label: string; off: boolean }[] = [
    { value: 'full', label: 'Full test', off: false },
    { value: 'english', label: SECTION_LABEL.english, off: !has('english') },
    { value: 'math', label: SECTION_LABEL.math, off: !has('math') },
  ];
  const picked = options.find((o) => o.value === choice && !o.off) ? choice : 'full';
  const hint = locked ? 'This test opens once all its questions are checked.' : run ? 'Press “Continue” to pick up where you left off.' : 'Press “Start” to begin the test.';

  return (
    <Page title={title}>
      {assigned && (
        <p className="flex items-start gap-3 rounded-[8px] border border-primary/30 bg-accent-tint px-4 py-3 text-[14px] leading-5 text-ink" role="note">
          <CalendarClock size={17} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
          <span>
            <b className="font-bold">{testName(assigned.title)}</b> is due {dueLong(assigned.due_at)}
            {assigned.status === 'overdue' && ' (overdue: it still counts, marked late)'}. Your first finished {assigned.test!.sections.length === 2 ? 'full test' : `${SECTION_LABEL[assigned.test!.sections[0]!]} section`} counts for your teacher.
          </span>
        </p>
      )}
      <p className="flex min-h-[52px] items-center gap-3 rounded-[8px] border border-line-strong bg-surface px-4 py-3 text-[16px] font-medium leading-6 text-ink" role="note">
        <Info size={17} strokeWidth={2} aria-hidden="true" className="shrink-0 text-ink" />
        {hint}
      </p>

      <section className="rounded-[12px] border border-line bg-surface px-[22px] py-[22px] shadow-[0_1px_4px_rgba(16,19,26,0.06)]">
        <h2 className="text-[17px] font-semibold leading-6 text-ink">Timing</h2>
        <p className="mt-2 text-[14px] leading-[23px] text-ink-3">This full-length assessment is timed like the real SAT, and the clock only stops if you leave the test. It is not a game but life!</p>
        <h2 className="mt-5 text-[17px] font-semibold leading-6 text-ink">Scores</h2>
        <p className="mt-2 text-[14px] leading-[23px] text-ink-3">When you finish the assessment test, your scores will be displayed, and you can begin to review the test to master the topics you were weaker on.</p>
      </section>

      {run ? (
        <p className="text-center text-[14px] font-semibold text-accent" aria-label={`In progress: ${progressLine(run.sections, run.stage)}`}>
          In progress · {progressLine(run.sections, run.stage)}
        </p>
      ) : (
        !locked && (
          <fieldset>
            <legend className="sr-only">What to take</legend>
            <div className="grid grid-cols-3 gap-2">
              {options.map((o) => {
                const on = picked === o.value;
                const subject = o.value === 'full' ? undefined : o.value;
                return (
                  <label
                    key={o.value}
                    className={`relative flex cursor-pointer flex-col gap-0.5 rounded-[10px] border px-3 py-2.5 transition-colors duration-150 has-[:disabled]:cursor-default has-[:disabled]:opacity-45 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${on ? 'border-primary bg-accent-tint' : 'border-line bg-surface hover:border-line-strong'}`}>
                    <input type="radio" name="sections" value={o.value} checked={on} disabled={o.off} onChange={() => setChoice(o.value)} className="sr-only" />
                    <span className={`truncate text-[14px] font-semibold ${on ? 'text-accent' : 'text-ink'}`}>{o.label}</span>
                    <span className="truncate text-[12px] text-ink-2 tabular">
                      {o.off ? 'Not in this test' : `${minutesLong(minutes(subject))} · ${questions(subject)} q`}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )
      )}

      {pkg.isError && <Notice tone="error" message={describeError(pkg.error)} />}

      <div className="flex flex-col items-center gap-2">
        {run ? (
          <>
            <BigButton onClick={() => void navigate(`/practice/run/${encodeURIComponent(code)}`)} disabled={!ready} loading={pkg.isPending}>
              Continue
            </BigButton>
            <button type="button" onClick={discard} className="inline-flex h-10 items-center gap-1.5 rounded-control px-3 text-[14px] font-semibold text-bad hover:bg-bad-tint">
              <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
              Discard progress
            </button>
            <button type="button" onClick={() => start(run.sections)} disabled={!ready} className="t-footnote h-8 rounded-control px-3 font-semibold text-ink-2 hover:text-ink disabled:opacity-40">
              Start over instead
            </button>
          </>
        ) : (
          <BigButton onClick={() => start(sectionsOf(picked))} disabled={!ready || !!locked} loading={pkg.isPending && !locked}>
            {picked === 'full' ? 'Start test' : 'Start section'}
          </BigButton>
        )}
      </div>

      {(mine.length > 0 || lastFull) && (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[14px]">
          {lastFull && (
            <Link to={`/practice/result/${lastFull.id}`} className="font-semibold text-ink-2 hover:text-ink">
              Last full test <span className="font-bold text-ink tabular">{lastFull.total}</span>
            </Link>
          )}
          {mine.length > 0 && (
            <Link to={`/practice/history/${encodeURIComponent(code)}`} className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline">
              <History size={15} strokeWidth={2} aria-hidden="true" />
              History · {mine.length}
            </Link>
          )}
        </div>
      )}
    </Page>
  );
}

/** The bar across the top with the way back, and the centred column under it. */
function Page({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="-mx-4 -mt-4 mb-6 flex h-14 items-center gap-2 border-b border-line bg-surface px-3 md:-mx-7 md:-mt-6 md:px-5">
        <Link to="/practice" aria-label="Back to mock tests" className="group flex size-9 items-center justify-center rounded-chip text-primary hover:bg-surface-2">
          <ChevronLeft size={24} strokeWidth={2.4} className="transition-transform duration-200 group-hover:-translate-x-[3px]" aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 truncate text-[17px] font-semibold text-ink">{title}</h1>
      </div>
      <div className="mx-auto flex w-full max-w-[566px] flex-col gap-5">{children}</div>
    </div>
  );
}

function BigButton({ children, onClick, disabled, loading }: { children: ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className="lift relative inline-flex h-[46px] min-w-[208px] items-center justify-center rounded-[8px] bg-primary px-6 text-[15px] font-semibold text-on-primary shadow-[0_6px_16px_-6px_color-mix(in_srgb,var(--color-primary)_60%,transparent)] hover:bg-primary-hover disabled:cursor-default disabled:opacity-45">
      <span className={loading ? 'invisible' : ''}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center" aria-label="Loading">
          <Spinner />
        </span>
      )}
    </button>
  );
}
