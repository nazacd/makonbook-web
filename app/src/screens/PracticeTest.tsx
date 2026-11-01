import { ChevronLeft, Clock, History, RotateCcw } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { describeError } from '@/api/errors';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { Skeleton } from '@/components/States';
import { confirm } from '@/lib/confirm';
import { uuid } from '@/lib/device-id';
import { useCatalog, useLocalAttempts, usePackage, useRuns, useRunStore } from '@/lib/practice/hooks';
import { newRun, SUBJECT_LABEL, testName } from '@/lib/practice/run';
import type { Subject } from '@/lib/practice/types';
import { useTitle } from '@/lib/title';

// The Digital SAT's sections: two modules each, 32 min for Reading and
// Writing and 35 for Math. Shown until the package (with its own times) is here.
const SAT_MINUTES: Record<Subject, number> = { english: 64, math: 70 };

/** "2 h 14 min", or "64 min" under an hour (or always, when `short`). */
function duration(minutes: number, short = false): string {
  if (short || minutes < 60) return `${minutes} min`;
  return minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`;
}

/** "Math, Part 1" for one section, "Full test, Part 3" for both. */
function progressLine(sections: Subject[], stage: number): string {
  return `${sections.length > 1 ? 'Full test' : SUBJECT_LABEL[sections[0]!]}, Part ${stage + 1}`;
}

// One test (the phone's practice/test/[code]): the full test leads, with its
// action below; each section on its own; the history. The package is fetched
// when the page opens; there is nothing to download by hand in a browser.
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
  const ready = !!pkg.data;
  const minutes = (subject?: Subject) =>
    pkg.data
      ? pkg.data.package.sections.filter((s) => !subject || s.subject === subject).reduce((n, s) => n + s.modules.reduce((m, mod) => m + mod.minutes, 0), 0)
      : subject
        ? SAT_MINUTES[subject]
        : SAT_MINUTES.english + SAT_MINUTES.math;

  const begin = (sections: Subject[]) => {
    if (!pkg.data) return;
    if (run) runStore.clear(code); // with its calculator work
    runStore.save(newRun(pkg.data.package, sections, uuid(), new Date()));
    void navigate(`/practice/run/${encodeURIComponent(code)}`);
  };
  // One test in progress per test: starting another asks first.
  const start = (sections: Subject[]) =>
    run ? confirm({ title: 'Discard your progress?', message: 'The answers you gave in this attempt are deleted.', onConfirm: () => begin(sections) }) : begin(sections);
  const discard = () => confirm({ title: 'Discard your progress?', message: 'The answers you gave in this attempt are deleted.', onConfirm: () => runStore.clear(code) });

  if (catalog.isPending && !run) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <Skeleton width={160} height={44} />
        <Skeleton width="50%" height={24} />
      </div>
    );
  }
  if (!test && !run) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <Back />
        <Notice tone="error" title="No such test" message={catalog.isError ? describeError(catalog.error) : 'This test isn’t in the catalog.'} />
      </div>
    );
  }
  const locked = !run && test && test.version == null;

  return (
    <div className="mx-auto w-full max-w-xl">
      <Back />
      <h1 className="font-title text-[44px] font-bold leading-[50px] text-ink">{title}</h1>
      {run ? (
        <p className="mt-4 flex items-center gap-3" aria-label={`In progress: ${progressLine(run.sections, run.stage)}`}>
          <span className="flex size-[22px] items-center justify-center rounded-full bg-accent-tint">
            <span className="size-3.5 rounded-full border-[3px] border-accent" />
          </span>
          <span className="font-title text-[26px] font-semibold leading-8 text-accent">{progressLine(run.sections, run.stage)}</span>
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-end gap-3">
            <h2 className="font-title flex-1 text-[26px] font-semibold leading-8 text-ink">Full test</h2>
            {lastFull && (
              <Link to={`/practice/result/${lastFull.id}`} className="relative" aria-label={`Last full test ${lastFull.total}, opens the result`}>
                <span className="t-footnote absolute bottom-full right-0 text-ink-3">Last</span>
                <span className="font-title tabular text-[30px] font-bold leading-[34px] text-ink">{lastFull.total}</span>
              </Link>
            )}
          </div>
          <p className="t-callout tabular mt-1 flex items-center gap-1.5 text-ink-2">
            <Icon as={Clock} size={16} className="text-ink-3" />
            {duration(minutes())}
          </p>
        </>
      )}

      <p className="t-subhead mb-2.5 mt-9 text-ink-2">Or one section</p>
      <div className="flex h-[120px] border-y border-line">
        {(['english', 'math'] as const).map((subject, i) => (
          <button
            key={subject}
            type="button"
            onClick={() => start([subject])}
            // A test with one subject only has nothing to run for the other.
            disabled={!ready || !pkg.data?.package.sections.some((s) => s.subject === subject)}
            aria-label={`${SUBJECT_LABEL[subject]} only, ${minutes(subject)} minutes`}
            className={`flex flex-1 flex-col items-start pt-4 text-left active:bg-surface-2 disabled:opacity-50 ${i ? 'border-l border-line pl-4' : 'pr-2'}`}>
            <span className="t-title3 text-[17px] leading-[22px] text-ink">{subject === 'english' ? 'Reading & Writing' : 'Math'}</span>
            <span className="t-subhead tabular mt-1 flex items-center gap-1.5 text-ink-2">
              <Icon as={Clock} size={15} className="text-ink-3" />
              {duration(minutes(subject), true)}
            </span>
          </button>
        ))}
      </div>

      {mine.length > 0 && (
        <Link to={`/practice/history/${encodeURIComponent(code)}`} className="t-subhead mt-2 flex min-h-12 items-center gap-2 font-medium text-ink-2">
          <Icon as={History} size={17} className="text-ink-3" />
          History
          <span className="font-normal text-ink-3">· {mine.length}</span>
        </Link>
      )}

      <div className="mt-8 flex flex-col gap-2.5 border-t border-line pt-4">
        {pkg.isError && <Notice tone="error" message={describeError(pkg.error)} />}
        {locked ? (
          <p className="t-footnote text-center text-ink-2">This test opens once its questions are checked.</p>
        ) : run ? (
          <>
            <Button label="Continue" onClick={() => void navigate(`/practice/run/${encodeURIComponent(code)}`)} disabled={!ready} loading={pkg.isPending} />
            <Button label="Discard progress" variant="destructive" onClick={discard} icon={<Icon as={RotateCcw} size={16} className="text-bad" />} />
          </>
        ) : (
          <Button label="Start full test" onClick={() => start(['english', 'math'])} disabled={!ready} loading={pkg.isPending} />
        )}
      </div>
    </div>
  );
}

function Back() {
  return (
    <Link to="/practice" className="t-subhead -ml-1 mb-4 inline-flex h-10 items-center gap-1 rounded-chip pr-2 text-accent">
      <Icon as={ChevronLeft} size={18} className="text-accent" />
      Practice
    </Link>
  );
}
