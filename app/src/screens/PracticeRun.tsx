import { BookOpen, Bookmark, Calculator as CalculatorIcon, Check, ChevronDown, ChevronUp, CircleCheck, CircleQuestionMark, Coffee, EllipsisVertical, Eye, EyeOff, Flag, Hand, Highlighter, House, ListChecks, Lock, RefreshCw, Timer as TimerIcon, X, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';

import { Button, Spinner } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { useParked } from '@/api/learning';
import { useMe } from '@/api/queries';
import { Annotated, HighlightsToggle, type TextHighlight } from '@/components/practice/Annotations';
import { AnswerChoice } from '@/components/practice/AnswerChoice';
import { AskLater, foldersOf, sameQuestion, type QuestionRef } from '@/components/practice/AskLater';
import { Calculator, dragging } from '@/components/practice/Calculator';
import { Directions } from '@/components/practice/Directions';
import { GridInInput } from '@/components/practice/GridInInput';
import { NavigatorLegend, QuestionNavigatorGrid } from '@/components/practice/QuestionNavigatorGrid';
import { Reference } from '@/components/practice/Reference';
import { ReportIssue } from '@/components/practice/ReportIssue';
import { RichContent } from '@/components/practice/RichContent';
import { confirm } from '@/lib/confirm';
import { postAttempt, usePackage, usePerson, useRefreshLocal, useRun, useRunStore, useSendNow } from '@/lib/practice/hooks';
import { runKey, saveAttempt, type LocalAttempt, type Run, type StoredPackage } from '@/lib/practice/local';
import { finishRun, questionKey, stagesOf, SUBJECT_LABEL, SUBJECT_SHORT, testName } from '@/lib/practice/run';
import { formatRemainingTime, useRemainingTime } from '@/lib/timer';
import { useDialog } from '@/lib/dialog';
import { useTitle } from '@/lib/title';

const LETTERS = ['A', 'B', 'C', 'D'] as const;
/** How often time used is saved while a module is on screen. */
const PERSIST_INTERVAL_MS = 5000;
/** The break between a full test's sections, as on the real SAT. */
const BREAK_MS = 10 * 60_000;
/** How long "Module 2 started" stays. */
const NOTE_MS = 3200;
/** How long the header reads "Saving" after a change. */
const SAVING_MS = 600;

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
  // Sections the test doesn't have (a one-subject test): nothing to run.
  if (stagesOf(pkg.data.package, stored.data.sections).length === 0) {
    return <NothingToRun code={code} />;
  }
  return <Runner initial={stored.data} stored={pkg.data} />;
}

function NothingToRun({ code }: { code: string }) {
  const navigate = useNavigate();
  const runs = useRunStore();
  const discard = () => {
    runs.clear(code);
    void navigate(`/practice/test/${encodeURIComponent(code)}`, { replace: true });
  };
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
      <Notice tone="error" title="This test has none of those questions" message="The sections chosen aren’t in this test. Discard this attempt and choose again." />
      <Button label="Discard and choose again" onClick={discard} />
    </div>
  );
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
  // Ask later and Issue: the question they were opened on (kept, so a module
  // ending underneath doesn't change what they are about), and the phone's ⋮ menu.
  const [askFor, setAskFor] = useState<QuestionRef | null>(null);
  const [reportFor, setReportFor] = useState<QuestionRef | null>(null);
  const [showMore, setShowMore] = useState(false);
  const student = me?.kind === 'student';
  const parked = useParked(student);
  // The student's changes, each saved in this browser at once: the header
  // reads "Saving" for a moment after each, then "Saved".
  const [saves, setSaves] = useState(0);
  const [settled, setSettled] = useState(0);
  const saving = saves !== settled;
  useEffect(() => {
    if (saves === settled) return;
    const id = setTimeout(() => setSettled(saves), SAVING_MS);
    return () => clearTimeout(id);
  }, [saves, settled]);

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
    setSaves((n) => n + 1);
  };

  // The clock runs only while the page is in front: leaving it (or hiding
  // the tab) saves the time used, coming back carries on from it.
  useEffect(() => {
    const r = latest.current.run;
    // A tab opened behind others starts paused.
    if (r.ready && document.visibilityState === 'visible') {
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
        // Paused: nothing counts until the tab is in front again, so a tab
        // closed from behind others (pagehide) saves the same time.
        shownAt.current = null;
        latest.current.startTs = null;
        setStartTs(null);
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

  // The same test open in another tab, and carried on (or finished) there:
  // this tab stops writing, so closing it doesn't put back older answers.
  const [elsewhere, setElsewhere] = useState(false);
  const wentOnElsewhere = useEffectEvent(() => {
    if (finished.current) return;
    finished.current = true;
    shownAt.current = null;
    setElsewhere(true);
    void refresh(); // the test's page here shows the run as it is now
  });
  useEffect(() => {
    const k = runKey(person, initial.code);
    const onStorage = (e: StorageEvent) => {
      if (e.key === k || e.key === null) wentOnElsewhere();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [person, initial.code]);

  // Finished, but this browser couldn't keep the attempt (storage full): it
  // goes straight to the server, and the run stays until it's there.
  const queryClient = useQueryClient();
  const [unsaved, setUnsaved] = useState<LocalAttempt | null>(null);
  const sendUnsaved = useMutation({
    mutationFn: postAttempt,
    onSuccess: (_, attempt) => {
      runs.clear(attempt.code);
      void queryClient.invalidateQueries({ queryKey: ['practice-mine'] });
      void navigate(`/practice/result/${attempt.id}`, { replace: true });
    },
  });

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
    if (!saveAttempt(person, attempt)) {
      setUnsaved(attempt);
      sendUnsaved.mutate(attempt);
      return;
    }
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

  if (elsewhere) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <Notice tone="info" title="This test went on in another tab" message="Your answers from there are saved. To carry on here instead, reload this page." />
        <Button label="Reload" onClick={() => window.location.reload()} />
        <Button label="Back to the test’s page" variant="secondary" onClick={() => void navigate(testPage)} />
      </div>
    );
  }

  if (unsaved && !sendUnsaved.isPending && sendUnsaved.isError) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <Notice
          tone="error"
          title="Your answers aren’t saved yet"
          message="This browser’s storage is full, and SATMAKON can’t be reached to save them there. Keep this page open, check the connection and try again."
        />
        <Button label="Try again" onClick={() => sendUnsaved.mutate(unsaved)} />
      </div>
    );
  }

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
    // Bluebook's break: a dark screen, the time left in a box with Resume,
    // and how the break works beside it.
    return (
      <div className="flex min-h-dvh flex-col bg-ink text-paper">
        <div className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-6">
          <p className="t-headline">{testName(pkg.title)}</p>
          <button type="button" onClick={pauseBreak} className="t-subhead flex h-10 items-center gap-1.5 rounded-full border border-paper/40 px-4 font-medium active:bg-paper/10">
            <Icon as={House} size={16} className="text-current" />
            Leave
          </button>
        </div>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-5 py-8 md:flex-row md:items-center md:gap-16">
          <section className="flex w-full max-w-xs flex-col items-center rounded-panel border border-paper/30 px-6 py-7 text-center">
            <p className="t-subhead opacity-90">Remaining break time</p>
            <p className="font-title tabular mt-1 text-[64px] font-bold leading-[72px]" role="timer" aria-label={`Break, ${Math.ceil(left / 60_000)} minutes left`}>
              {formatRemainingTime(left)}
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-paper/20" aria-hidden="true">
              <div className="h-1.5 rounded-full bg-paper" style={{ width: `${(left / BREAK_MS) * 100}%` }} />
            </div>
            <button type="button" onClick={startModule} className="t-callout mt-6 h-11 w-full rounded-full bg-paper font-semibold text-ink active:opacity-90">
              Resume testing
            </button>
          </section>
          <section className="w-full max-w-xl">
            <h1 className="t-title">Practice test break</h1>
            <p className="t-body mt-3 opacity-90">You can resume as soon as you’re ready to move on. On test day, you’ll wait until the clock counts down.</p>
            <hr className="my-6 border-paper/20" />
            <h2 className="t-headline">How this break works</h2>
            <ul className="t-subhead mt-3 flex list-disc flex-col gap-2 pl-5 opacity-90">
              <li>
                {moduleLabel} ({minutes} {minutes === 1 ? 'minute' : 'minutes'}) starts by itself when the break ends.
              </li>
              <li>Leaving pauses the break; it carries on when you come back.</li>
              <li>Your {SUBJECT_LABEL[stages[run.stage - 1]?.subject ?? 'english']} answers are submitted and can’t be changed.</li>
            </ul>
          </section>
        </main>
        <footer className="flex h-14 shrink-0 items-center px-4 sm:px-6">
          <p className="t-subhead truncate font-bold uppercase">{studentName}</p>
        </footer>
      </div>
    );
  }

  if (!run.ready) {
    const fullTest = stages.some((s) => s.subject !== stage.subject);
    // Bluebook's start of a section: the bars, the facts on a card, Start in the footer.
    const facts: { icon: LucideIcon; title: string; text: string }[] = [
      { icon: TimerIcon, title: 'Timing', text: `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} for ${questions.length} questions. The clock starts when you press Start and stops while you’re away from the test.` },
      stage.subject === 'math'
        ? { icon: CalculatorIcon, title: 'Calculator and reference sheet', text: 'The Desmos graphing calculator and the reference sheet are at the top right, for every question.' }
        : { icon: Highlighter, title: 'Highlights and notes', text: 'Highlight the passage or the question and add notes. Cross out answer choices with ABC.' },
      { icon: Bookmark, title: 'Mark for review', text: 'Mark questions to come back to. The question list shows them before you submit the module.' },
      run.stage === 0 && fullTest
        ? { icon: Coffee, title: 'Breaks', text: 'Module 2 follows straight on. A 10-minute break comes before Math.' }
        : run.stage > 0
          ? { icon: Lock, title: 'Previous module', text: 'It’s submitted. Its answers can’t be changed now.' }
          : { icon: ListChecks, title: 'Your score', text: 'An estimate from College Board’s practice tests, shown when you finish.' },
    ];
    return (
      <div className="flex h-dvh flex-col bg-paper">
        <header className="grid h-[72px] shrink-0 grid-cols-[1fr_auto] items-center border-b-2 border-dashed border-ink bg-bar px-3 sm:px-5">
          <div className="min-w-0">
            <p className="t-headline truncate text-ink">{testName(pkg.title)}</p>
            <p className="t-subhead text-ink-2">{fullTest ? 'Full test' : SUBJECT_LABEL[stage.subject]}</p>
          </div>
          <Tool icon={House} label="Leave" onClick={() => void navigate(testPage)} />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:py-12">
          <div className="mx-auto max-w-2xl">
            <h1 className="t-title mb-6 text-center text-ink">{moduleLabel}</h1>
            <div className="rounded-panel border border-line bg-paper p-6 shadow-[0_10px_32px_-14px_rgba(18,45,71,0.28)] sm:p-8">
              <ul className="flex flex-col gap-6">
                {facts.map((f) => (
                  <li key={f.title} className="flex gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint">
                      <Icon as={f.icon} size={20} className="text-accent" />
                    </span>
                    <span className="flex flex-col gap-1">
                      <span className="t-headline text-ink">{f.title}</span>
                      <span className="t-subhead text-ink-2">{f.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </main>
        <footer className="grid h-16 shrink-0 grid-cols-[1fr_auto] items-center gap-3 border-t-2 border-dashed border-ink bg-bar px-3 pb-[env(safe-area-inset-bottom)] sm:px-5">
          <p className="t-subhead truncate font-bold uppercase text-ink">{studentName}</p>
          <button type="button" onClick={startModule} className="t-callout h-10 rounded-full bg-accent px-6 font-semibold text-on-accent active:opacity-90">
            Start module {stage.module.module}
          </button>
        </footer>
      </div>
    );
  }

  const answer = run.answers[qKey];
  const marked = run.marked.includes(qKey);
  const here: QuestionRef = { test: run.code, title: pkg.title, version: pkg.version, subject: stage.subject, module: stage.module.module, position: question.position, question_id: question.id };
  const parkedHere = parked.data?.find((p) => sameQuestion(p, here));
  const askingAbout = askFor ? parked.data?.find((p) => sameQuestion(p, askFor)) : undefined;
  const openAskLater = () => {
    setShowMore(false);
    setAskFor(here);
  };
  const openReport = () => {
    setShowMore(false);
    setReportFor(here);
  };
  const timerToggle = (
    <button
      type="button"
      onClick={() => setHideTimer((h) => !h)}
      aria-pressed={hideTimer}
      aria-label={hideTimer ? 'Show the time' : 'Hide the time'}
      title={hideTimer ? 'Show the time' : 'Hide the time'}
      className="flex size-6 items-center justify-center rounded-full text-ink-2 hover:text-ink active:bg-paper-2 sm:size-7">
      {hideTimer ? <Eye size={18} strokeWidth={1.75} aria-hidden="true" /> : <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" />}
    </button>
  );
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

  const backButton = (
    <button type="button" onClick={() => goto(run.index - 1)} disabled={run.index === 0} className="t-callout h-10 rounded-full bg-engine px-5 font-semibold text-white disabled:bg-engine-soft">
      Back
    </button>
  );
  const backToQuestion = (
    <button type="button" onClick={() => setShowReview(false)} className="t-callout h-10 rounded-full bg-engine px-5 font-semibold text-white">
      Back
    </button>
  );

  const questionBody = (
    <>
      {/* The question strip, as in Bluebook: the number, Mark for Review beside it, the cross-out tool at the right. */}
      <div className="mb-4 flex items-center gap-3 border-b-2 border-dashed border-ink bg-paper-2 pr-2">
        <span className="flex h-9 min-w-9 items-center justify-center bg-ink px-2 t-subhead font-bold text-surface" aria-label={`Question ${run.index + 1} of ${questions.length}`}>
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
            className={`ml-auto flex h-6 items-center rounded-[4px] border px-1 text-[11px] font-bold tracking-wide line-through ${crossOut ? 'border-engine bg-engine text-white' : 'border-ink text-ink'}`}>
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
      <header className="relative grid h-[72px] shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b-2 border-dashed border-ink bg-bar px-3 sm:px-5">
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
        {/* The clock with its hide toggle beside it, and under it whether the work is saved
            (a phone has no room beside the clock: the toggle goes under it, the status as its icon). */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1">
            {hideTimer && !low ? (
              <span className="flex h-7 items-center text-ink" aria-label="Time hidden">
                <TimerIcon size={20} strokeWidth={1.75} aria-hidden="true" />
              </span>
            ) : (
              <span className={`tabular font-title text-[22px] font-bold leading-7 ${low ? 'text-bad' : 'text-ink'}`} role="timer" aria-label={`${Math.ceil(remainingMs / 60_000)} minutes left`}>
                {formatRemainingTime(remainingMs)}
              </span>
            )}
            <span className="hidden sm:flex">{timerToggle}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="flex sm:hidden">{timerToggle}</span>
            <span title="Your answers are saved in this browser as you go" className={`t-caption flex h-4 items-center gap-1 font-semibold ${saving ? 'text-info' : 'text-good'}`}>
              {saving ? (
                <RefreshCw size={12} strokeWidth={2.2} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
              ) : (
                <CircleCheck size={12} strokeWidth={2.2} aria-hidden="true" />
              )}
              <span className="sr-only sm:not-sr-only">{saving ? 'Saving' : 'Saved'}</span>
            </span>
          </div>
        </div>
        {/* A laptop shows every tool; narrower windows put Ask later and Issue (and, on a phone, Leave) under More. */}
        <div className="flex items-center justify-end gap-0.5 sm:gap-1">
          {english && <HighlightsToggle on={annotating} onToggle={() => setAnnotating((v) => !v)} />}
          {stage.subject === 'math' && (
            <>
              <Tool icon={CalculatorIcon} label="Calculator" on={showCalculator} onClick={() => setShowCalculator((v) => !v)} />
              <Tool icon={BookOpen} label="Reference" on={showReference} onClick={() => setShowReference((v) => !v)} />
            </>
          )}
          {student && (
            <span className="hidden lg:contents">
              <Tool
                icon={parkedHere ? Hand : CircleQuestionMark}
                label={parkedHere ? 'Asked' : 'Ask later'}
                ariaLabel={parkedHere ? `Asked later, in ${parkedHere.folder}. Change it` : 'Ask about this later'}
                accent={!!parkedHere}
                onClick={openAskLater}
              />
              <Tool icon={Flag} label="Issue" ariaLabel="Report an issue" onClick={openReport} />
            </span>
          )}
          <div className={`relative ${student ? 'lg:hidden' : 'md:hidden'}`}>
            <Tool icon={EllipsisVertical} label="More" ariaLabel="More tools" on={showMore} menu onClick={() => setShowMore((v) => !v)} />
            {showMore && (
              <MoreMenu onClose={() => setShowMore(false)}>
                {student && (
                  <>
                    <MenuItem icon={parkedHere ? Hand : CircleQuestionMark} label={parkedHere ? 'Asked' : 'Ask later'} accent={!!parkedHere} onClick={openAskLater} />
                    <MenuItem icon={Flag} label="Issue" onClick={openReport} />
                  </>
                )}
                <MenuItem
                  icon={House}
                  label="Leave"
                  className="md:hidden"
                  onClick={() => {
                    setShowMore(false);
                    leave();
                  }}
                />
              </MoreMenu>
            )}
          </div>
          <span className="hidden md:contents">
            <Tool icon={House} label="Leave" onClick={leave} />
          </span>
        </div>
        {showDirections && <Directions subject={stage.subject} onClose={() => setShowDirections(false)} />}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Mounted for the whole Math module and only hidden when closed, so the calculator keeps its work. */}
        {stage.subject === 'math' && wide && (
          <CalcPane hidden={!showCalculator}>
            <Calculator visible docked runId={run.id} onClose={() => setShowCalculator(false)} />
          </CalcPane>
        )}
        {showReview ? (
          <main className="min-h-0 flex-1 overflow-y-auto p-5 md:p-8">
            <div className="mx-auto max-w-2xl">
              <h2 className="t-title mb-2 text-center text-ink">Check your work</h2>
              <p className="t-subhead mb-6 text-center text-ink-2">On the real test you can’t move on until time runs out. Here you may submit the module once you’re done; its answers can’t be changed afterwards.</p>
              <div className="rounded-panel border border-line bg-paper p-5">
                <p className="t-headline mb-3 text-ink">{moduleLabel}</p>
                <NavigatorLegend />
                <div className="mt-3 border-t border-line pt-3">
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

      <footer className="relative grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-t-2 border-dashed border-ink bg-bar px-3 pb-[env(safe-area-inset-bottom)] sm:px-5">
        {/* A laptop shows the name here; a phone has no room for it, so Back takes the left side. */}
        <p className="t-subhead hidden truncate font-bold uppercase text-ink sm:block">{studentName}</p>
        <div className="flex sm:hidden">{showReview ? backToQuestion : backButton}</div>
        <button type="button" onClick={() => setShowNavigator((v) => !v)} aria-haspopup="dialog" aria-expanded={showNavigator} className="t-subhead flex h-10 items-center gap-1.5 rounded-lg bg-ink px-3 font-semibold text-paper sm:px-4">
          <span className="hidden sm:inline">Question </span>
          {run.index + 1} of {questions.length}
          <ChevronUp size={16} strokeWidth={2} aria-hidden="true" className={showNavigator ? 'rotate-180' : ''} />
        </button>
        <div className="flex items-center justify-end gap-2">
          {showReview ? (
            <>
              <span className="hidden sm:flex">{backToQuestion}</span>
              <button type="button" onClick={submitPrompt} className="t-callout h-10 rounded-full bg-engine px-6 font-semibold text-white">
                {run.stage + 1 < stages.length ? 'Submit module' : 'Submit the test'}
              </button>
            </>
          ) : (
            <>
              <span className="hidden sm:flex">{backButton}</span>
              <button type="button" onClick={isLast ? () => setShowReview(true) : () => goto(run.index + 1)} className="t-callout h-10 rounded-full bg-engine px-6 font-semibold text-white">
                Next
              </button>
            </>
          )}
        </div>

        {showNavigator && (
          <Popover label={`${moduleLabel} questions`} onClose={() => setShowNavigator(false)}>
            <span aria-hidden="true" className="absolute -bottom-2 left-1/2 size-4 -translate-x-1/2 rotate-45 border-b border-r border-line bg-paper" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="t-headline text-ink">{moduleLabel} questions</h2>
              <button type="button" onClick={() => setShowNavigator(false)} aria-label="Close" className="flex size-8 items-center justify-center rounded-chip active:bg-paper-2">
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <NavigatorLegend />
            <div className="mt-3 max-h-[44dvh] overflow-y-auto border-t border-line pb-1 pt-3">
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
                className="t-subhead h-10 rounded-full border border-engine px-5 font-semibold text-engine">
                Go to review page
              </button>
            </div>
          </Popover>
        )}
      </footer>

      {stage.subject === 'math' && !wide && <Calculator visible={showCalculator} runId={run.id} onClose={() => setShowCalculator(false)} />}
      {showReference && <Reference onClose={() => setShowReference(false)} />}
      {askFor && (
        <AskLater
          question={askFor}
          existing={askingAbout}
          folders={foldersOf(parked.data ?? [])}
          onClose={() => setAskFor(null)}
          onSaved={(folder) => {
            setAskFor(null);
            setNote(`Parked in ${folder}`);
          }}
        />
      )}
      {reportFor && <ReportIssue question={reportFor} onClose={() => setReportFor(null)} />}
    </div>
  );
}

/**
 * A header tool, as Bluebook's: the icon over its label. With `on` it is a
 * toggle (Calculator, Reference); with `menu` it opens a menu (More);
 * `accent` marks a state (Asked).
 */
function Tool({ icon, label, ariaLabel, on, menu = false, accent = false, onClick }: { icon: LucideIcon; label: string; ariaLabel?: string; on?: boolean; menu?: boolean; accent?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={menu ? undefined : on}
      aria-haspopup={menu ? 'menu' : undefined}
      aria-expanded={menu ? !!on : undefined}
      aria-label={ariaLabel ?? label}
      title={ariaLabel}
      className={`flex h-14 min-w-11 flex-col items-center justify-center gap-0.5 rounded-chip px-2 sm:min-w-16 ${on ? 'bg-paper text-accent shadow-sm' : accent ? 'text-accent active:bg-paper' : 'text-ink active:bg-paper'}`}>
      <Icon as={icon} size={20} className="text-current" />
      <span className="t-caption hidden whitespace-nowrap font-medium sm:block">{label}</span>
    </button>
  );
}

// The ⋮ menu under More: the tools a narrow header has no room for. Escape,
// a press outside or choosing one closes it; arrow keys move between items.
function MoreMenu({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const menu = useDialog<HTMLDivElement>(onClose);
  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])].filter((el) => el.offsetParent !== null);
  useEffect(() => {
    items()[0]?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    list[(at + step + list.length) % list.length]?.focus();
  };
  return (
    <>
      <div className="fixed inset-0 z-30" aria-hidden="true" onClick={onClose} />
      <div
        ref={menu}
        tabIndex={-1}
        role="menu"
        aria-label="More tools"
        onKeyDown={onKeyDown}
        className="pop absolute right-0 top-[calc(100%+6px)] z-40 flex w-60 flex-col rounded-control border border-line bg-paper p-1.5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.35)] outline-none">
        {children}
      </div>
    </>
  );
}

function MenuItem({ icon, label, onClick, accent = false, className = '' }: { icon: LucideIcon; label: string; onClick: () => void; accent?: boolean; className?: string }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={`t-subhead flex min-h-11 w-full items-center gap-3 rounded-chip px-3 text-left font-semibold hover:bg-paper-2 focus-visible:bg-paper-2 active:bg-paper-2 ${accent ? 'text-accent' : 'text-ink'} ${className}`}>
      <Icon as={icon} size={18} className="shrink-0 text-current" />
      <span className="min-w-0 truncate">{label}</span>
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

const CALC_WIDTH_KEY = 'mb.calc.width';
const CALC_MIN = 300;
/** Keep room for the question beside the calculator. */
const calcMax = () => Math.max(CALC_MIN, window.innerWidth - 420);
const clampCalc = (w: number) => Math.round(Math.min(Math.max(w, CALC_MIN), calcMax()));

// The docked calculator's pane. Its right edge is a handle: drag it (or focus
// it and use the arrow keys) to make the calculator wider or narrower; the
// width is remembered in this browser.
function CalcPane({ children, hidden }: { children: ReactNode; hidden: boolean }) {
  const [width, setWidth] = useState(() => {
    let saved = 0;
    try {
      saved = Number(localStorage.getItem(CALC_WIDTH_KEY)) || 0;
    } catch {
      // No storage: the default width.
    }
    return clampCalc(saved || window.innerWidth * 0.42);
  });
  useEffect(() => {
    const onResize = () => setWidth((w) => clampCalc(w));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const save = (w: number) => {
    try {
      localStorage.setItem(CALC_WIDTH_KEY, String(w));
    } catch {
      // Not remembered: fine.
    }
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const handle = e.currentTarget;
    const startX = e.clientX;
    const startW = width;
    let last = startW;
    handle.setPointerCapture(e.pointerId);
    dragging(true);
    const move = (ev: PointerEvent) => {
      last = clampCalc(startW + ev.clientX - startX);
      setWidth(last);
    };
    const up = () => {
      dragging(false);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      save(last);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowLeft' ? -24 : e.key === 'ArrowRight' ? 24 : 0;
    if (!step) return;
    e.preventDefault();
    const next = clampCalc(width + step);
    setWidth(next);
    save(next);
  };
  return (
    <aside className="relative shrink-0" style={{ width }} hidden={hidden}>
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the calculator"
        aria-valuenow={width}
        aria-valuemin={CALC_MIN}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className="group absolute -right-2 bottom-0 top-0 z-10 flex w-4 cursor-col-resize touch-none select-none items-center justify-center outline-none">
        <span className="h-full w-px bg-line-strong transition-colors group-hover:w-0.5 group-hover:bg-accent group-focus-visible:w-0.5 group-focus-visible:bg-accent" />
        <span className="absolute h-12 w-1.5 rounded-full bg-ink-3 transition-colors group-hover:bg-accent group-focus-visible:bg-accent" />
      </div>
    </aside>
  );
}

// The question navigator above the footer (Bluebook's popover).
function Popover({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const dialog = useDialog<HTMLDivElement>(onClose);
  return (
    <div ref={dialog} tabIndex={-1} role="dialog" aria-label={label} className="absolute bottom-[calc(100%+10px)] left-1/2 z-30 w-[min(600px,calc(100vw-24px))] -translate-x-1/2 rounded-panel border border-line bg-paper p-5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.35)] outline-none">
      {children}
    </div>
  );
}
