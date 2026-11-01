import { ArrowRight, BookOpen, Bookmark, Calculator as CalculatorIcon, Check, ChevronDown, ChevronUp, Coffee, House, ListChecks, Lock, Timer as TimerIcon, X, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { Button, Spinner } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { useMe } from '@/api/queries';
import { Annotated, HighlightsToggle, type TextHighlight } from '@/components/practice/Annotations';
import { AnswerChoice } from '@/components/practice/AnswerChoice';
import { Calculator } from '@/components/practice/Calculator';
import { Directions } from '@/components/practice/Directions';
import { GridInInput } from '@/components/practice/GridInInput';
import { NavigatorLegend, QuestionNavigatorGrid } from '@/components/practice/QuestionNavigatorGrid';
import { Reference } from '@/components/practice/Reference';
import { RichContent } from '@/components/practice/RichContent';
import { confirm } from '@/lib/confirm';
import { usePackage, usePerson, useRefreshLocal, useRun, useRunStore, useSendNow } from '@/lib/practice/hooks';
import { saveAttempt, type Run, type StoredPackage } from '@/lib/practice/local';
import { finishRun, questionKey, stagesOf, SUBJECT_LABEL, SUBJECT_SHORT, testName } from '@/lib/practice/run';
import { formatRemainingTime, useRemainingTime } from '@/lib/timer';
import { useTitle } from '@/lib/title';

const LETTERS = ['A', 'B', 'C', 'D'] as const;
/** How often time used is saved while a module is on screen. */
const PERSIST_INTERVAL_MS = 5000;
/** The break between a full test's sections, as on the real SAT. */
const BREAK_MS = 10 * 60_000;
/** How long "Module 2 started" stays. */
const NOTE_MS = 3200;

// Taking a practice test (the phone's practice/run/[code], laid out like
// Bluebook on a laptop): its modules one after another, each with its own
// time. A module's answers are final once it is submitted (or its time runs
// out); the next module of the same subject starts by itself, and a full
// test has a 10-minute break before Math. Leaving the page, or hiding the
// tab, pauses the clock; everything is saved in the browser as it happens, so
// the test can be resumed later.
export function PracticeRun() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const stored = useRun(code);
  const pkg = usePackage(code, stored.data?.version, !!stored.data);
  useTitle('Practice test');

  if (stored.isPending || (stored.data && pkg.isPending)) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-7 text-accent" />
      </div>
    );
  }
  if (!stored.data || !pkg.data) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <Notice tone="error" title="No test in progress" message={pkg.isError ? 'The test couldn’t be loaded. Check the connection and try again.' : 'Start it from the test’s page.'} />
        <Button label="Back to Practice" variant="secondary" onClick={() => void navigate('/practice')} />
      </div>
    );
  }
  return <Runner initial={stored.data} stored={pkg.data} />;
}

function Runner({ initial, stored }: { initial: Run; stored: StoredPackage }) {
  const pkg = stored.package;
  const links = stored.images;
  const navigate = useNavigate();
  const person = usePerson();
  const runs = useRunStore();
  const refresh = useRefreshLocal();
  const sendNow = useSendNow();
  const [run, setRun] = useState(initial);
  // When the current module's clock started, as if it had run without a
  // break: now − time used. Null while the module waits to be started.
  const [startTs, setStartTs] = useState<number | null>(null);
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  const [showNavigator, setShowNavigator] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [hideTimer, setHideTimer] = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [crossOut, setCrossOut] = useState(false);
  const [annotating, setAnnotating] = useState(false);
  const wide = useWide();
  const me = useMe().data;
  const studentName = me ? `${me.first_name} ${me.last_name}` : '';
  const [finishing, setFinishing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const stages = stagesOf(pkg, run.sections);
  const stage = stages[run.stage]!;
  const questions = stage.module.questions;
  const question = questions[run.index]!;
  const qKey = questionKey(stage, question);
  const minutes = stage.module.minutes;
  const { remainingMs, isExpired } = useRemainingTime(startTs, visible && run.ready, minutes * 60_000);
  const brk = run.brk;
  const breakStart = brk?.since != null ? Date.parse(brk.since) - (BREAK_MS - brk.leftMs) : null;
  const breakClock = useRemainingTime(breakStart, visible && !!brk?.since, BREAK_MS);

  // Time on each question: counted from when it was shown until another one
  // is, or the module ends, or the page is left.
  const shownAt = useRef<number | null>(null);
  const latest = useRef({ run, startTs, qKey });
  useLayoutEffect(() => {
    latest.current = { run, startTs, qKey };
  });

  const snapshot = useCallback((): Run => {
    const { run: r, startTs: s, qKey: k } = latest.current;
    const now = Date.now();
    const seconds = { ...r.seconds };
    if (r.ready && shownAt.current != null) {
      seconds[k] = (seconds[k] ?? 0) + (now - shownAt.current) / 1000;
      shownAt.current = now;
    }
    return { ...r, seconds, elapsedMs: r.ready && s != null ? now - s : r.elapsedMs };
  }, []);

  // Set once the last module is submitted: from then on the run is an
  // attempt, and nothing may write the run back.
  const finished = useRef(false);

  const persist = useCallback(() => {
    if (finished.current) return;
    const r = snapshot();
    latest.current.run = r;
    setRun(r);
    runs.save(r);
  }, [runs, snapshot]);

  const update = (change: (r: Run) => Run) => {
    if (finished.current) return;
    const r = change(snapshot());
    latest.current.run = r;
    setRun(r);
    runs.save(r);
  };

  // The clock runs only while the page is in front: leaving it (or hiding
  // the tab) saves the time used, coming back carries on from it.
  useEffect(() => {
    const r = latest.current.run;
    if (r.ready) {
      setStartTs(Date.now() - r.elapsedMs);
      shownAt.current = Date.now();
    } else if (r.brk && r.brk.since == null) {
      const resumed = { ...r, brk: { leftMs: r.brk.leftMs, since: new Date().toISOString() } };
      latest.current.run = resumed;
      setRun(resumed);
      runs.save(resumed);
    }
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') {
        persist();
        setVisible(false);
      } else {
        if (latest.current.run.ready) {
          setStartTs(Date.now() - latest.current.run.elapsedMs);
          shownAt.current = Date.now();
        }
        setVisible(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', persist);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', persist);
      persist();
      shownAt.current = null;
    };
  }, [persist, runs]);

  useEffect(() => {
    if (!visible || !run.ready) return;
    const id = setInterval(persist, PERSIST_INTERVAL_MS);
    return () => clearInterval(id);
  }, [visible, run.ready, persist]);

  const startModule = () => {
    shownAt.current = Date.now();
    setStartTs(Date.now());
    update((r) => ({ ...r, ready: true, elapsedMs: 0, index: 0, brk: undefined }));
  };

  const goto = (index: number) => update((r) => ({ ...r, index: Math.max(0, Math.min(questions.length - 1, index)) }));

  const submitting = useRef(false);
  const submitModule = () => {
    if (submitting.current) return;
    submitting.current = true;
    setShowReview(false);
    setShowNavigator(false);
    setShowCalculator(false);
    const r = snapshot();
    shownAt.current = null;
    setStartTs(null);
    if (r.stage + 1 < stages.length) {
      const following = stages[r.stage + 1]!;
      const sameSubject = following.subject === stage.subject;
      const next: Run = sameSubject
        ? { ...r, stage: r.stage + 1, ready: true, elapsedMs: 0, index: 0 }
        : { ...r, stage: r.stage + 1, ready: false, elapsedMs: 0, index: 0, brk: { leftMs: BREAK_MS, since: new Date().toISOString() } };
      if (sameSubject) {
        const now = Date.now();
        shownAt.current = now;
        setStartTs(now);
        setNote(`Module ${stage.module.module} submitted · Module ${following.module.module} started`);
      }
      latest.current.run = next;
      setRun(next);
      runs.save(next);
      submitting.current = false;
      return;
    }
    finished.current = true;
    setFinishing(true);
    const attempt = finishRun(pkg, r, new Date());
    saveAttempt(person, attempt);
    runs.clear(r.code);
    void refresh();
    sendNow.mutate();
    void navigate(`/practice/result/${attempt.id}`, { replace: true });
  };

  // Time's up: the module is submitted as it is.
  useEffect(() => {
    if (!visible || !run.ready || !isExpired) return;
    const id = setTimeout(submitModule, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, run.ready, isExpired]);

  // The break is over: the next section starts by itself, once the tab is in front.
  useEffect(() => {
    if (!visible || !brk?.since || !breakClock.isExpired) return;
    const id = setTimeout(startModule, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, brk?.since, breakClock.isExpired]);

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), NOTE_MS);
    return () => clearTimeout(id);
  }, [note]);

  const testPage = `/practice/test/${encodeURIComponent(run.code)}`;

  // Home during the break pauses it; the break runs on otherwise.
  const pauseBreak = () => {
    const r = latest.current.run;
    if (r.brk?.since) {
      const paused = { ...r, brk: { leftMs: breakClock.remainingMs, since: null } };
      latest.current.run = paused;
      setRun(paused);
      runs.save(paused);
    }
    void navigate(testPage);
  };

  const leave = () => confirm({ title: 'Leave the test?', message: 'Your answers are saved and the clock stops until you come back.', onConfirm: () => void navigate(testPage) });

  const moduleLabel = `${SUBJECT_LABEL[stage.subject]} · Module ${stage.module.module}`;

  if (finishing) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
        <Spinner className="size-7 text-accent" />
        <p className="t-subhead text-ink-2">Scoring your test…</p>
      </div>
    );
  }

  if (!run.ready && brk) {
    const left = breakClock.remainingMs;
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper px-5 py-2 pb-4">
        <CloseButton onClick={pauseBreak} label="Leave and pause the break" />
        <div className="mb-6 mt-auto">
          <p className="t-callout text-ink-2">Break</p>
          <p className="font-title tabular text-[76px] font-bold leading-[84px] tracking-[-1px] text-ink" role="timer" aria-label={`Break, ${Math.ceil(left / 60_000)} minutes left`}>
            {formatRemainingTime(left)}
          </p>
          <div className="mb-2.5 mt-3 h-1.5 overflow-hidden rounded-full bg-track">
            <div className="h-1.5 rounded-full bg-accent" style={{ width: `${(left / BREAK_MS) * 100}%` }} />
          </div>
          <p className="t-callout text-ink-2">{SUBJECT_LABEL[stage.subject]} starts by itself when the break ends.</p>
          <p className="t-subhead mt-2.5 flex items-center gap-2 text-ink-2">
            <Icon as={ArrowRight} size={17} className="text-ink-3" />
            Next: <span className="font-medium text-ink">{moduleLabel}</span> · {minutes} min
          </p>
        </div>
        <Button label="Skip break" variant="secondary" onClick={startModule} />
      </div>
    );
  }

  if (!run.ready) {
    const fullTest = stages.some((s) => s.subject !== stage.subject);
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper px-5 py-2 pb-4">
        <CloseButton onClick={() => void navigate(testPage)} label="Close" />
        <div className="mb-7 mt-auto flex flex-col gap-2">
          <p className="t-callout text-ink-2">
            {testName(pkg.title)} · {fullTest ? 'Full test' : SUBJECT_LABEL[stage.subject]}
          </p>
          <h1 className="t-title mb-2 text-ink">{moduleLabel}</h1>
          <Fact icon={ListChecks} text={`${questions.length} questions`} />
          <Fact icon={TimerIcon} text={`${minutes} minutes`} />
          {stage.subject === 'math' && <Fact icon={CalculatorIcon} text="Calculator allowed" />}
          {run.stage === 0 && fullTest ? (
            <Note icon={Coffee} text="Module 2 follows straight on; a 10-minute break comes before Math." />
          ) : run.stage > 0 ? (
            <Note icon={Lock} text="The previous module is submitted. Its answers can’t be changed now." />
          ) : null}
        </div>
        <Button label={`Start module ${stage.module.module}`} onClick={startModule} />
      </div>
    );
  }

  const answer = run.answers[qKey];
  const marked = run.marked.includes(qKey);
  const eliminated = run.eliminated[qKey] ?? [];
  const keyOf = (i: number) => questionKey(stage, questions[i]!);
  const grid = questions.map((_, i) => ({ id: i + 1, current: i === run.index, answered: !!run.answers[keyOf(i)]?.trim(), marked: run.marked.includes(keyOf(i)) }));
  const answered = grid.filter((g) => g.answered).length;
  const isLast = run.index === questions.length - 1;
  const low = remainingMs <= 5 * 60_000;
  const twoColumns = !!question.passage;
  const english = stage.subject === 'english';
  const highlightsOf = (block: string) => run.highlights?.[`${qKey}/${block}`] ?? [];
  const setHighlights = (block: string, next: TextHighlight[]) => update((r) => ({ ...r, highlights: { ...r.highlights, [`${qKey}/${block}`]: next } }));
  const toggleMark = () => update((r) => ({ ...r, marked: r.marked.includes(qKey) ? r.marked.filter((k) => k !== qKey) : [...r.marked, qKey] }));
  const closePopovers = () => {
    setShowNavigator(false);
    setShowDirections(false);
  };
  const submitPrompt = () =>
    confirm({
      title: 'Submit this module?',
      message:
        questions.length - answered === 1
          ? 'One question is blank. You can’t come back to this module.'
          : questions.length - answered > 1
            ? `${questions.length - answered} questions are blank. You can’t come back to this module.`
            : 'You can’t come back to this module.',
      onConfirm: submitModule,
    });

  const questionBody = (
    <>
      {/* The question strip, as in Bluebook: the number, Mark for Review beside it, the cross-out tool at the right. */}
      <div className="mb-4 flex items-center gap-3 border-b-2 border-dashed border-ink bg-paper-2 pr-2">
        <span className="flex h-9 min-w-9 items-center justify-center bg-accent px-2 t-subhead font-bold text-on-accent" aria-label={`Question ${run.index + 1} of ${questions.length}`}>
          {run.index + 1}
        </span>
        <button type="button" onClick={toggleMark} aria-pressed={marked} className={`flex h-9 items-center gap-1.5 rounded-chip px-1 t-subhead font-medium ${marked ? 'text-accent' : 'text-ink'}`}>
          <Bookmark size={18} strokeWidth={1.75} className={marked ? 'text-accent' : 'text-ink'} fill={marked ? 'currentColor' : 'none'} aria-hidden="true" />
          Mark for Review
        </button>
        {question.type === 'mcq' && (
          <button
            type="button"
            onClick={() => setCrossOut((v) => !v)}
            aria-pressed={crossOut}
            aria-label="Cross out answer choices"
            title="Cross out answer choices"
            className={`ml-auto flex h-6 items-center rounded-[4px] border px-1 text-[11px] font-bold tracking-wide line-through ${crossOut ? 'border-accent bg-accent text-on-accent' : 'border-ink text-ink'}`}>
            ABC
          </button>
        )}
      </div>
      <Annotated enabled={english && annotating} highlights={highlightsOf('q')} onChange={(next) => setHighlights('q', next)}>
        <RichContent text={question.stem} images={pkg.images} links={links} className="rich rich-lg" />
      </Annotated>
      {question.type === 'mcq' && question.choices ? (
        <div role="radiogroup" aria-label="Answer choices" className="mt-5 flex flex-col gap-3">
          {LETTERS.filter((l) => question.choices![l] != null).map((letter) => (
            <AnswerChoice
              key={letter}
              letter={letter}
              content={<RichContent text={question.choices![letter]} images={pkg.images} links={links} displayMath />}
              selected={answer === letter}
              eliminated={eliminated.includes(letter)}
              crossOut={crossOut}
              onSelect={() => update((r) => ({ ...r, answers: { ...r.answers, [qKey]: letter } }))}
              onToggleEliminate={() =>
                update((r) => {
                  const cur = r.eliminated[qKey] ?? [];
                  const striking = !cur.includes(letter);
                  const answers = { ...r.answers };
                  if (striking && answers[qKey] === letter) delete answers[qKey];
                  return { ...r, answers, eliminated: { ...r.eliminated, [qKey]: striking ? [...cur, letter] : cur.filter((x) => x !== letter) } };
                })
              }
            />
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <GridInInput value={answer ?? ''} onChange={(value) => update((r) => ({ ...r, answers: { ...r.answers, [qKey]: value } }))} />
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-dvh flex-col bg-paper">
      {note && (
        <div role="status" className="absolute left-1/2 top-20 z-30 flex -translate-x-1/2 items-center gap-2.5 rounded-control bg-ink px-3.5 py-3 text-paper">
          <Icon as={Check} size={18} className="text-paper" />
          <span className="t-subhead font-medium">{note}</span>
        </div>
      )}

      {/* The header, as Bluebook's: the section and its directions, the clock, the tools. */}
      <header className="relative grid h-[72px] shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b-2 border-dashed border-ink bg-paper px-3 sm:px-5">
        <div className="flex min-w-0 flex-col items-start">
          <p className="t-headline truncate text-ink">
            <span className="hidden sm:inline">{moduleLabel}</span>
            <span className="sm:hidden">
              {SUBJECT_SHORT[stage.subject]} · M{stage.module.module}
            </span>
          </p>
          <button type="button" onClick={() => setShowDirections((v) => !v)} aria-expanded={showDirections} className="t-subhead flex h-7 items-center gap-0.5 text-ink active:text-accent">
            Directions
            <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col items-center">
          {hideTimer && !low ? (
            <span className="flex h-7 items-center text-ink" aria-label="Time hidden">
              <TimerIcon size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
          ) : (
            <span className={`tabular font-title text-[22px] font-bold leading-7 ${low ? 'text-bad' : 'text-ink'}`} role="timer" aria-label={`${Math.ceil(remainingMs / 60_000)} minutes left`}>
              {formatRemainingTime(remainingMs)}
            </span>
          )}
          <button type="button" onClick={() => setHideTimer((h) => !h)} className="t-caption mt-0.5 h-6 rounded-full border border-ink px-2.5 font-medium text-ink active:bg-paper-2">
            {hideTimer ? 'Show' : 'Hide'}
          </button>
        </div>
        <div className="flex items-center justify-end gap-1">
          {english && <HighlightsToggle on={annotating} onToggle={() => setAnnotating((v) => !v)} />}
          {stage.subject === 'math' && (
            <>
              <Tool icon={CalculatorIcon} label="Calculator" on={showCalculator} onClick={() => setShowCalculator((v) => !v)} />
              <Tool icon={BookOpen} label="Reference" on={showReference} onClick={() => setShowReference((v) => !v)} />
            </>
          )}
          <Tool icon={House} label="Leave" onClick={leave} />
        </div>
        {showDirections && <Directions subject={stage.subject} onClose={() => setShowDirections(false)} />}
      </header>

      <div className="flex min-h-0 flex-1">
        {stage.subject === 'math' && showCalculator && wide && (
          <aside className="w-[46%] min-w-[320px] max-w-[640px] shrink-0">
            <Calculator visible docked onClose={() => setShowCalculator(false)} />
          </aside>
        )}
        {showReview ? (
          <main className="min-h-0 flex-1 overflow-y-auto p-5 md:p-8">
            <div className="mx-auto max-w-2xl">
              <h2 className="t-title mb-2 text-center text-ink">Check your work</h2>
              <p className="t-subhead mb-6 text-center text-ink-2">On the real test you can’t move on until time runs out. Here you may submit the module once you’re done; its answers can’t be changed afterwards.</p>
              <div className="rounded-panel border border-line bg-paper p-5">
                <p className="t-headline mb-3 text-ink">{moduleLabel}</p>
                <NavigatorLegend />
                <QuestionNavigatorGrid
                  variant="progress"
                  items={grid}
                  onPress={(id) => {
                    goto(id - 1);
                    setShowReview(false);
                  }}
                />
              </div>
            </div>
          </main>
        ) : (
          /* One scrolling page on a phone and for Math; on a laptop a passage and
             its question scroll on their own, so the row must take the main's
             height exactly (minmax(0, 1fr)), or the columns would grow past it. */
          <main key={qKey} className={`min-h-0 flex-1 overflow-y-auto ${twoColumns ? 'md:grid md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] md:overflow-hidden' : ''}`} onClick={closePopovers}>
            {twoColumns && (
              <div className="border-b border-line p-5 md:min-h-0 md:overflow-y-auto md:border-b-0 md:border-r md:p-8">
                <Annotated enabled={english && annotating} highlights={highlightsOf('p')} onChange={(next) => setHighlights('p', next)}>
                  <RichContent text={question.passage} images={pkg.images} links={links} />
                </Annotated>
              </div>
            )}
            <div className={`p-5 md:p-8 ${twoColumns ? 'md:min-h-0 md:overflow-y-auto' : 'mx-auto w-full max-w-2xl'}`}>{questionBody}</div>
          </main>
        )}
      </div>

      <footer className="relative grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-t-2 border-dashed border-ink bg-paper px-3 pb-[env(safe-area-inset-bottom)] sm:px-5">
        <p className="t-subhead hidden truncate font-bold uppercase text-ink sm:block">{studentName}</p>
        <span className="sm:hidden" />
        <button type="button" onClick={() => setShowNavigator((v) => !v)} aria-haspopup="dialog" aria-expanded={showNavigator} className="t-subhead flex h-10 items-center gap-1.5 rounded-lg bg-ink px-3 font-semibold text-paper sm:px-4">
          <span className="hidden sm:inline">Question </span>
          {run.index + 1} of {questions.length}
          <ChevronUp size={16} strokeWidth={2} aria-hidden="true" className={showNavigator ? 'rotate-180' : ''} />
        </button>
        <div className="flex items-center justify-end gap-2">
          {showReview ? (
            <>
              <button type="button" onClick={() => setShowReview(false)} className="t-callout h-10 rounded-full border border-accent px-5 font-semibold text-accent">
                Back
              </button>
              <button type="button" onClick={submitPrompt} className="t-callout h-10 rounded-full bg-accent px-6 font-semibold text-on-accent">
                {run.stage + 1 < stages.length ? 'Submit module' : 'Submit the test'}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => goto(run.index - 1)} disabled={run.index === 0} className="t-callout h-10 rounded-full border border-accent px-5 font-semibold text-accent disabled:opacity-30">
                Back
              </button>
              <button type="button" onClick={isLast ? () => setShowReview(true) : () => goto(run.index + 1)} className="t-callout h-10 rounded-full bg-accent px-6 font-semibold text-on-accent">
                Next
              </button>
            </>
          )}
        </div>

        {showNavigator && (
          <div role="dialog" aria-label={`${moduleLabel} questions`} className="absolute bottom-[calc(100%+10px)] left-1/2 z-30 w-[min(600px,calc(100vw-24px))] -translate-x-1/2 rounded-panel border border-line bg-paper p-5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.35)]">
            <span aria-hidden="true" className="absolute -bottom-2 left-1/2 size-4 -translate-x-1/2 rotate-45 border-b border-r border-line bg-paper" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="t-headline text-ink">{moduleLabel} questions</h2>
              <button type="button" onClick={() => setShowNavigator(false)} aria-label="Close" className="flex size-8 items-center justify-center rounded-chip active:bg-paper-2">
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <NavigatorLegend />
            <div className="max-h-[40dvh] overflow-y-auto border-t border-line pb-1">
              <QuestionNavigatorGrid
                variant="progress"
                items={grid}
                onPress={(id) => {
                  goto(id - 1);
                  setShowNavigator(false);
                  setShowReview(false);
                }}
              />
            </div>
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setShowNavigator(false);
                  setShowReview(true);
                }}
                className="t-subhead h-10 rounded-full border border-accent px-5 font-semibold text-accent">
                Go to review page
              </button>
            </div>
          </div>
        )}
      </footer>

      {stage.subject === 'math' && !wide && <Calculator visible={showCalculator} onClose={() => setShowCalculator(false)} />}
      {showReference && <Reference onClose={() => setShowReference(false)} />}
    </div>
  );
}

/** A header tool, as Bluebook's: the icon over its label. */
function Tool({ icon, label, on = false, onClick }: { icon: LucideIcon; label: string; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={label} className={`flex h-14 min-w-11 flex-col items-center justify-center gap-0.5 rounded-chip px-2 sm:min-w-16 ${on ? 'bg-accent-tint text-accent' : 'text-ink active:bg-paper-2'}`}>
      <Icon as={icon} size={20} className="text-current" />
      <span className="t-caption hidden font-medium sm:block">{label}</span>
    </button>
  );
}

function Fact({ icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <p className="t-body flex min-h-8 items-center gap-3 text-ink">
      <Icon as={icon} size={20} className="text-ink-3" />
      {text}
    </p>
  );
}

function Note({ icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <p className="t-subhead mt-2.5 flex gap-2.5 text-ink-2">
      <Icon as={icon} size={18} className="text-ink-3" />
      <span className="flex-1">{text}</span>
    </p>
  );
}

function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="-ml-2.5 flex size-11 items-center justify-center rounded-chip active:opacity-60">
      <Icon as={House} size={22} />
    </button>
  );
}

/** A laptop-sized window: the calculator docks beside the question. */
function useWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}
