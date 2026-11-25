import { ArrowLeft, ArrowRight, BookOpen, Bookmark, Calculator as CalculatorIcon, Check, ChevronDown, ChevronLeft, ChevronUp, EllipsisVertical, Highlighter, LayoutGrid, ListChecks, Lock, Pause, Play, RotateCcw, ScrollText, Star, Strikethrough, Trophy, X } from 'lucide-react';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';

import { useStartAssignment } from '@/api/assignments';
import { ApiError } from '@/api/client';
import { isTimeUp, useCompetitionBoard } from '@/api/competitions';
import { describeError } from '@/api/errors';
import { checkQuestion, PRACTICE_STATS_KEY, PracticeOpenError, useSavedQuestions, useSaveQuestion, useStartPractice, type Checked } from '@/api/practiceSets';
import { saveAnswers, useAssessment, useStartAssessment, useSubmitAssessment, type Assessment, type AssessmentQuestion, type AssessmentResult } from '@/api/roadmaps';
import { Clock } from '@/components/assessment/Clock';
import { Navigator } from '@/components/assessment/Navigator';
import { dueLong, dueShort } from '@/components/assignments/format';
import { Spinner } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Annotated, supported as canHighlight, type TextHighlight } from '@/components/practice/Annotations';
import { AnswerChoice } from '@/components/practice/AnswerChoice';
import { Calculator } from '@/components/practice/Calculator';
import { CalcPane, MenuItem, MoreMenu, Tool, useWide } from '@/components/practice/Chrome';
import { Directions } from '@/components/practice/Directions';
import { GridInInput } from '@/components/practice/GridInInput';
import { Reference } from '@/components/practice/Reference';
import { RichContent, type ImageLinks } from '@/components/practice/RichContent';
import { useNow } from '@/lib/clock';
import { usePerson } from '@/lib/practice/hooks';
import type { PackageImage, Subject } from '@/lib/practice/types';
import { useTitle } from '@/lib/title';

// "/assessments/:id": a level check, a homework set, a practice set from the
// question bank or a competition attempt, full screen. One question at a
// time under the test screen's kind of frame (see Run); answers are saved to
// the server as you go (a reload continues), and it's graded there on
// submit. Then the result: the score, passed or not, and every question with
// the right answer and its explanation.

const LETTERS = ['A', 'B', 'C', 'D'];

/** Where leaving goes: the assignment's tab, or the roadmap lesson. */
const ASSIGNMENT_TAB = { homework: '/homework', level_check: '/level-checks', exam: '/exams' } as const;
export function backOf(a: Assessment): string {
  if (a.competition) return `/competitions/${a.competition.id}`;
  if (a.kind === 'practice') return a.practice ? `/questions/${a.practice.subject}` : '/questions';
  if (a.assignment) return ASSIGNMENT_TAB[a.assignment.kind];
  return a.roadmap_id && a.lesson_id ? `/roadmaps/${a.roadmap_id}/lessons/${a.lesson_id}` : '/roadmaps';
}

export function AssessmentRun() {
  const { id = '' } = useParams();
  const a = useAssessment(id);
  useTitle(a.data?.title ?? 'Assessment');
  if (a.isPending)
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  if (a.isError)
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-4">
        <Notice tone="error" message={describeError(a.error)} />
        <Link to="/roadmaps" className="t-subhead font-bold text-accent hover:underline">
          Back to roadmaps
        </Link>
      </div>
    );
  // How far this computer's clock is from the server's, from when the copy was fetched.
  const skew = a.data.competition ? Date.parse(a.data.competition.server_time) - a.dataUpdatedAt : 0;
  return a.data.finished_at ? <Result a={a.data} skew={skew} /> : <Run a={a.data} skew={skew} />;
}

/** The API's image links in the shape RichContent takes. */
function useImages(a: Assessment) {
  return useMemo(() => {
    const images: Record<string, PackageImage> = {};
    const links: ImageLinks = {};
    for (const [key, img] of Object.entries(a.images)) {
      images[key] = { file: key, bytes: 0, width: img.width, height: img.height };
      links[key] = img.url;
    }
    return { images, links };
  }, [a.images]);
}

// What a person marks on a set while taking it: questions to come back to,
// choices struck out, highlights and notes. Kept in this browser with the
// set, never uploaded; gone once the set is handed in.
type Marks = { marked: string[]; eliminated: Record<string, string[]>; highlights: Record<string, TextHighlight[]> };
const NO_MARKS: Marks = { marked: [], eliminated: {}, highlights: {} };
const NO_HIGHLIGHTS: TextHighlight[] = [];
const marksKey = (person: string, id: string) => `mb.assessment.marks.${person}.${id}`;

function useMarks(person: string, id: string) {
  const key = marksKey(person, id);
  const [marks, setMarks] = useState<Marks>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...NO_MARKS, ...(JSON.parse(raw) as Partial<Marks>) } : NO_MARKS;
    } catch {
      return NO_MARKS;
    }
  });
  useEffect(() => {
    if (marks === NO_MARKS) return;
    try {
      localStorage.setItem(key, JSON.stringify(marks));
    } catch {
      // Not kept: they last until the page is left.
    }
  }, [key, marks]);
  const forget = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to remove.
    }
  };
  return { marks, setMarks, forget };
}

const KIND_LABEL = { level_check: 'Level check', practice: 'Practice', competition: 'Competition', homework: 'Homework' } as const;
const MATH_DOMAINS = ['Algebra', 'Advanced Math', 'Problem-Solving and Data Analysis', 'Geometry and Trigonometry'];

// An open set, full screen, laid out like the test screen (screens/
// PracticeRun) with a practice site's manners: the header has Go back and
// Directions, the clock in the middle (time left, or time spent with a
// pause) and the tools (Reference and Calculator for Math, Highlight, More);
// the question sits under a strip with its number, Mark for Review and the
// cross-out tool; the footer has the question list, Back and the next step.
function Run({ a, skew }: { a: Assessment; skew: number }) {
  const navigate = useNavigate();
  const submit = useSubmitAssessment(a.id);
  const { images, links } = useImages(a);
  const person = usePerson();
  const queryClient = useQueryClient();
  const wide = useWide();
  const now = useNow();
  const [answers, setAnswers] = useState<Record<string, string | null>>(a.answers);
  const [i, setI] = useState(() => Math.max(0, a.questions.findIndex((q) => a.answers[q.id] == null)));
  const { marks, setMarks, forget } = useMarks(person, a.id);
  const [showNav, setShowNav] = useState(false);
  const [grouped, setGrouped] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [annotating, setAnnotating] = useState(false);
  const [crossOut, setCrossOut] = useState(false);
  const [showExplanation, setShowExplanation] = useState(true);
  const [paused, setPaused] = useState(false);
  const q = a.questions[i]!;
  const total = a.questions.length;
  const answered = a.questions.filter((x) => answers[x.id] != null && answers[x.id] !== '').length;
  const back = backOf(a);
  const subject: Subject = a.subject === 'mixed' ? (MATH_DOMAINS.includes(q.domain) ? 'math' : 'english') : a.subject;
  const math = subject === 'math';
  const hasMath = a.subject !== 'english';

  // At one's own pace: each question is checked as it is answered, once.
  const ownPace = a.practice?.mode === 'own_pace';
  // What the assessment says was checked, with what was checked here since.
  const [localChecks, setChecks] = useState<Record<string, Checked>>({});
  const checks: Record<string, Checked> = { ...localChecks };
  for (const x of a.questions) {
    if (a.checked?.[x.id] != null && !checks[x.id]) checks[x.id] = { correct: a.checked[x.id]!, answer: a.answers[x.id] ?? '', correct_answer: x.correct ?? null, accepted: x.accepted ?? [], explanation: x.explanation ?? '' };
  }
  const review = checks[q.id];
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<unknown>(null);

  // A timed practice set: the clock runs from when it was made, a question's time each.
  const secs = a.practice?.seconds_per_question ?? 0;
  // A competition: the server's deadline, on this computer's clock.
  const deadline = a.competition ? Date.parse(a.competition.deadline) - skew : secs > 0 ? Date.parse(a.created_at) + secs * total * 1000 : null;

  // Seconds spent on each question: counted while it is on screen, the tab
  // is visible and the set isn't paused; kept with the answers (the teacher's
  // statistics, and the pace in the student's own).
  const times = useRef<Record<string, number>>({ ...a.times });
  const shownSince = useRef<number | null>(null);
  const shown = useRef<string | null>(null); // the question being counted
  const timesDirty = useRef(false);
  const stopped = useRef(false); // paused
  const counting = () => (document.visibilityState === 'visible' && !stopped.current ? Date.now() : null);
  // Adds the time since the last tally to the question on screen, and starts counting again.
  const tally = () => {
    const id = shown.current;
    if (id && shownSince.current != null) {
      const spent = Math.round((Date.now() - shownSince.current) / 1000);
      if (spent > 0) {
        times.current[id] = Math.min(21_600, (times.current[id] ?? 0) + spent);
        timesDirty.current = true;
      }
    }
    shownSince.current = counting();
  };
  // A new question starts its own count (the previous one is tallied first).
  const tallyNow = useEffectEvent(tally);
  useEffect(() => {
    shown.current = q.id;
    shownSince.current = document.visibilityState === 'visible' && !stopped.current ? Date.now() : null;
    document.addEventListener('visibilitychange', tallyNow);
    return () => {
      document.removeEventListener('visibilitychange', tallyNow);
      tallyNow();
    };
  }, [q.id]);
  const pause = (on: boolean) => {
    tally();
    stopped.current = on;
    shownSince.current = counting();
    setPaused(on);
    if (on) setShowNav(false);
  };

  // Saved to the server a moment after each change, so a reload or another
  // device continues; and at once when the page is left or closed.
  const pending = useRef<Record<string, string | null>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = () => {
    clearTimeout(timer.current);
    const batch = pending.current;
    pending.current = {};
    const sendTimes = timesDirty.current;
    timesDirty.current = false;
    if (Object.keys(batch).length || sendTimes)
      saveAnswers(a.id, batch, sendTimes ? { ...times.current } : undefined).catch((e) => {
        if (isTimeUp(e)) return; // the competition's time is over: nothing more is taken
        pending.current = { ...batch, ...pending.current };
        timesDirty.current = timesDirty.current || sendTimes;
      });
  };
  const flushOnLeave = useEffectEvent(() => {
    tally();
    flush();
  });
  useEffect(() => {
    window.addEventListener('pagehide', flushOnLeave);
    return () => {
      window.removeEventListener('pagehide', flushOnLeave);
      flushOnLeave();
    };
  }, []);
  const answer = (value: string | null) => {
    if (review) return;
    setAnswers((x) => ({ ...x, [q.id]: value }));
    pending.current[q.id] = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  };

  const check = () => {
    const given = answers[q.id];
    if (!given || review || checking) return;
    tally();
    setChecking(true);
    setCheckError(null);
    checkQuestion(a.id, q.id, given, times.current[q.id] ?? 0)
      .then((c) => {
        setChecks((x) => ({ ...x, [q.id]: c }));
        // The cached assessment learns it too, so leaving and coming back shows it checked.
        queryClient.setQueryData<Assessment>(['assessment', a.id], (old) =>
          old
            ? {
                ...old,
                checked: { ...(old.checked ?? {}), [q.id]: c.correct },
                answers: { ...old.answers, [q.id]: given },
                questions: old.questions.map((x) => (x.id === q.id ? { ...x, correct: c.correct_answer ?? undefined, accepted: c.accepted, explanation: c.explanation } : x)),
              }
            : old,
        );
        void queryClient.invalidateQueries({ queryKey: PRACTICE_STATS_KEY(person) });
        void queryClient.invalidateQueries({ queryKey: ['gamification'] });
      })
      .catch((e) => {
        // Checked already (another tab, or an old copy here): the server's copy says how.
        if (e instanceof ApiError && e.code === 'already_checked') void queryClient.invalidateQueries({ queryKey: ['assessment', a.id] });
        else setCheckError(e);
      })
      .finally(() => setChecking(false));
  };

  const finish = () => {
    clearTimeout(timer.current);
    pending.current = {};
    tally();
    timesDirty.current = false;
    submit.mutate(
      { answers, times: { ...times.current } },
      {
        onSuccess: () => {
          forget();
          window.scrollTo(0, 0);
        },
        // Handed in already (another tab, or the server graded it when its time ran out): show what the server has.
        onError: (e) => e instanceof ApiError && e.code === 'finished' && void queryClient.invalidateQueries({ queryKey: ['assessment', a.id] }),
      },
    );
  };
  const askFinish = () => {
    setShowNav(false);
    setShowMore(false);
    if (answered < total) setConfirm(true);
    else finish();
  };
  const leave = () => {
    tally();
    flush();
    void navigate(back);
  };
  const goto = (k: number) => {
    setI(Math.max(0, Math.min(total - 1, k)));
    setCheckError(null);
  };

  // The arrow keys turn the questions, unless something is being typed or a panel is open.
  const onArrow = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || paused || showNav || showMore || confirm || showReference || showDirections) return;
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.closest('[role="dialog"], [role="radiogroup"]'))) return;
    goto(i + (e.key === 'ArrowRight' ? 1 : -1));
  });
  useEffect(() => {
    window.addEventListener('keydown', onArrow);
    return () => window.removeEventListener('keydown', onArrow);
  }, []);

  const marked = marks.marked.includes(q.id);
  const eliminated = marks.eliminated[q.id] ?? [];
  const toggleMark = () => setMarks((m) => ({ ...m, marked: m.marked.includes(q.id) ? m.marked.filter((x) => x !== q.id) : [...m.marked, q.id] }));
  const toggleEliminate = (letter: string) => {
    const striking = !eliminated.includes(letter);
    if (striking && answers[q.id] === letter) answer(null);
    setMarks((m) => ({ ...m, eliminated: { ...m.eliminated, [q.id]: striking ? [...(m.eliminated[q.id] ?? []), letter] : (m.eliminated[q.id] ?? []).filter((x) => x !== letter) } }));
  };
  const highlightsOf = (block: string) => marks.highlights[`${q.id}/${block}`] ?? NO_HIGHLIGHTS;
  const setHighlights = (block: string, next: TextHighlight[]) => setMarks((m) => ({ ...m, highlights: { ...m.highlights, [`${q.id}/${block}`]: next } }));

  const items = a.questions.map((x, k) => {
    const c = checks[x.id];
    const done = answers[x.id] != null && answers[x.id] !== '';
    return { n: k + 1, state: c ? (c.correct ? ('right' as const) : ('wrong' as const)) : done ? ('answered' as const) : ('blank' as const), marked: marks.marked.includes(x.id) };
  });
  const isLast = i === total - 1;
  const twoColumns = !!q.passage;
  const rightAnswer = review ? (review.correct_answer ?? review.accepted[0] ?? '') : '';

  const backButton = (
    <button type="button" onClick={() => goto(i - 1)} disabled={i === 0 || paused} className="t-callout h-10 rounded-full border border-line-strong px-5 font-semibold text-ink hover:bg-paper-2 disabled:opacity-40">
      Back
    </button>
  );
  const finishButton = (label: string, className = '') => (
    <button type="button" onClick={askFinish} disabled={submit.isPending} className={`lift t-callout flex h-10 items-center justify-center gap-1.5 rounded-full bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60 ${className}`}>
      {submit.isPending ? 'Checking…' : label} <Check size={16} aria-hidden="true" />
    </button>
  );

  const questionBody = (
    <>
      {/* The question strip: the number, Mark for Review beside it; at the right its difficulty, Save and the cross-out tool. */}
      <div className="mb-5 flex h-10 items-center gap-1 rounded-[10px] bg-paper-2 pr-1.5">
        <span className="t-subhead flex h-10 min-w-10 items-center justify-center rounded-[10px] bg-ink px-2 font-bold text-surface" aria-label={`Question ${i + 1} of ${total}`}>
          {i + 1}
        </span>
        <button type="button" onClick={toggleMark} aria-pressed={marked} className={`t-subhead flex h-9 items-center gap-1.5 rounded-chip px-2 font-semibold ${marked ? 'text-ink' : 'text-ink-2 hover:text-ink'}`}>
          <Bookmark size={17} strokeWidth={1.9} className={marked ? 'text-fill-watch' : ''} fill={marked ? 'currentColor' : 'none'} aria-hidden="true" />
          {marked ? 'Marked for Review' : 'Mark for Review'}
        </button>
        <span className="ml-auto flex items-center gap-0.5">
          {q.difficulty && <span className="t-micro mr-1.5 hidden text-ink-3 sm:inline">{q.difficulty}</span>}
          {a.kind === 'practice' && <SaveButton id={q.id} />}
          {q.type === 'mcq' && !review && (
            <button type="button" onClick={() => setCrossOut((v) => !v)} aria-pressed={crossOut} aria-label="Cross out answer choices" title="Cross out answer choices" className={`flex size-8 items-center justify-center rounded-full ${crossOut ? 'bg-ink text-surface' : 'text-ink-2 hover:bg-paper hover:text-ink'}`}>
              <Strikethrough size={16} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
      <Annotated enabled={annotating} highlights={highlightsOf('q')} onChange={(next) => setHighlights('q', next)}>
        <RichContent text={q.stem} images={images} links={links} className="rich rich-lg text-ink" />
      </Annotated>
      {q.type === 'mcq' && q.choices ? (
        <div className="mt-5 flex flex-col gap-3" role="radiogroup" aria-label="Answer choices">
          {LETTERS.filter((l) => q.choices![l] != null).map((l) => (
            <AnswerChoice
              key={l}
              letter={l}
              content={<RichContent text={q.choices![l]} images={images} links={links} displayMath className="rich" />}
              selected={answers[q.id] === l}
              eliminated={eliminated.includes(l)}
              crossOut={crossOut}
              locked={!!review}
              result={review ? (l === review.correct_answer ? 'right' : l === review.answer && !review.correct ? 'wrong' : undefined) : undefined}
              onSelect={() => answer(answers[q.id] === l ? null : l)}
              onToggleEliminate={() => toggleEliminate(l)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 max-w-xs">
          <p className="t-micro mb-2 text-ink-3">Your answer</p>
          <GridInInput value={answers[q.id] ?? ''} onChange={(v) => answer(v === '' ? null : v)} />
        </div>
      )}
      {review && (
        <section className={`rise mt-5 rounded-card border p-4 ${review.correct ? 'border-good/40 bg-good-tint/60' : 'border-bad/40 bg-bad-tint/60'}`} aria-live="polite">
          <p className="t-headline flex flex-wrap items-center gap-x-2 gap-y-1 text-ink">
            <span className={`flex size-6 items-center justify-center rounded-full text-brand ${review.correct ? 'bg-good' : 'bg-bad'}`}>{review.correct ? <Check size={14} strokeWidth={3.2} aria-hidden="true" /> : <X size={14} strokeWidth={3.2} aria-hidden="true" />}</span>
            {review.correct ? 'Right' : 'Not quite'}
            <span className="t-subhead font-medium text-ink-2">
              The answer is <b className="font-bold text-ink">{rightAnswer}</b>
              {!review.correct && review.answer ? `, you answered ${review.answer}` : ''}
            </span>
          </p>
          {review.explanation &&
            (showExplanation ? (
              <div className="mt-3 border-t border-line pt-3">
                <p className="t-micro mb-1.5 text-ink-3">Explanation</p>
                <RichContent text={review.explanation} images={images} links={links} className="rich t-subhead text-ink" />
              </div>
            ) : (
              <button type="button" onClick={() => setShowExplanation(true)} className="t-subhead mt-2 font-semibold text-accent hover:underline">
                Show the explanation
              </button>
            ))}
        </section>
      )}
      {(submit.isError || checkError != null) && (
        <div className="mt-4">
          <Notice tone="error" message={describeError(submit.isError ? submit.error : checkError)} />
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-dvh flex-col bg-paper">
      <header className="relative grid h-[68px] shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-bar px-1.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <button type="button" onClick={leave} aria-label={a.competition ? 'Go back (the clock keeps running)' : 'Go back: your answers are saved'} className="t-subhead flex h-10 items-center gap-1 rounded-chip pl-1.5 pr-2.5 font-semibold text-ink-2 hover:bg-paper-2 hover:text-ink">
            <ChevronLeft size={19} aria-hidden="true" />
            <span className="hidden sm:inline">Go back</span>
          </button>
          <button type="button" onClick={() => setShowDirections((v) => !v)} aria-expanded={showDirections} className="t-subhead hidden h-10 items-center gap-1 rounded-chip px-2.5 font-semibold text-ink hover:bg-paper-2 md:flex">
            Directions
            <ChevronDown size={15} strokeWidth={2} aria-hidden="true" className={showDirections ? 'rotate-180' : ''} />
          </button>
        </div>
        <Clock deadline={deadline} onEnd={() => !submit.isPending && finish()} spent={Object.values(a.times).reduce((n, s) => n + s, 0)} paused={paused} onPause={pause} />
        <div className="flex items-center justify-end gap-0.5 sm:gap-1">
          {math && (
            <>
              <span className="hidden sm:contents">
                <Tool icon={BookOpen} label="Reference" on={showReference} onClick={() => setShowReference((v) => !v)} />
              </span>
              <Tool icon={CalculatorIcon} label="Calculator" on={showCalculator} onClick={() => setShowCalculator((v) => !v)} />
            </>
          )}
          <Tool icon={Highlighter} label="Highlight" ariaLabel={canHighlight ? 'Highlights and notes' : 'Highlights need a newer browser'} on={annotating} disabled={!canHighlight} onClick={() => setAnnotating((v) => !v)} />
          <div className="relative">
            <Tool icon={EllipsisVertical} label="More" ariaLabel="More" on={showMore} menu onClick={() => setShowMore((v) => !v)} />
            {showMore && (
              <MoreMenu onClose={() => setShowMore(false)}>
                <MenuItem icon={ScrollText} label="Directions" className="md:hidden" onClick={() => (setShowMore(false), setShowDirections(true))} />
                {math && <MenuItem icon={BookOpen} label="Reference" className="sm:hidden" onClick={() => (setShowMore(false), setShowReference(true))} />}
                <MenuItem icon={LayoutGrid} label="All questions" onClick={() => (setShowMore(false), setShowNav(true))} />
                <MenuItem icon={ListChecks} label={ownPace ? 'Finish the set' : 'Finish and check'} onClick={askFinish} />
              </MoreMenu>
            )}
          </div>
        </div>
        {showDirections && <Directions subject={subject} onClose={() => setShowDirections(false)} />}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Mounted for the whole set and only hidden when closed, so the calculator keeps its work. */}
        {hasMath && wide && (
          <CalcPane hidden={!(showCalculator && math)}>
            <Calculator visible docked runId={a.id} onClose={() => setShowCalculator(false)} />
          </CalcPane>
        )}
        {paused ? (
          <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-accent-tint text-accent">
              <Pause size={24} fill="currentColor" aria-hidden="true" />
            </span>
            <h2 className="t-title text-ink">Paused</h2>
            <p className="t-subhead max-w-xs text-ink-2">The clock is stopped and the question is put away. Your answers are saved.</p>
            <button type="button" onClick={() => pause(false)} className="lift t-callout mt-2 flex h-11 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-on-primary hover:bg-primary-hover">
              <Play size={15} fill="currentColor" aria-hidden="true" /> Resume
            </button>
          </main>
        ) : (
          /* One scrolling page on a phone and without a passage; on a laptop a
             passage and its question scroll on their own (see PracticeRun). */
          <main key={q.id} className={`min-h-0 flex-1 overflow-y-auto ${twoColumns ? 'md:grid md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] md:overflow-hidden' : ''}`}>
            {twoColumns && (
              <div className="border-b border-line p-5 md:min-h-0 md:overflow-y-auto md:border-b-0 md:border-r md:p-8">
                <Annotated enabled={annotating} highlights={highlightsOf('p')} onChange={(next) => setHighlights('p', next)}>
                  <RichContent text={q.passage} images={images} links={links} className="rich rich-lg text-ink" />
                </Annotated>
              </div>
            )}
            <div className={`rise p-5 md:p-8 ${twoColumns ? 'md:min-h-0 md:overflow-y-auto' : 'mx-auto w-full max-w-[780px]'}`}>{questionBody}</div>
          </main>
        )}
      </div>

      <footer className="relative grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-line bg-bar px-3 pb-[env(safe-area-inset-bottom)] sm:px-5">
        <div className="absolute inset-x-0 -top-px h-[3px] bg-track" role="progressbar" aria-label="Answered" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered}>
          <div className="h-full rounded-r-full bg-primary transition-[width] duration-300" style={{ width: `${(100 * answered) / total}%` }} />
        </div>
        <div className="min-w-0">
          <div className="hidden min-w-0 sm:block">
            <p className="t-subhead truncate font-bold text-ink">{a.title}</p>
            <p className="t-caption truncate font-medium text-ink-2">
              {KIND_LABEL[a.kind]} · {answered}/{total} answered
              {a.assignment && ` · due ${dueShort(a.assignment.due_at, now)}`}
            </p>
          </div>
          <div className="flex sm:hidden">{backButton}</div>
        </div>
        <button type="button" onClick={() => setShowNav((v) => !v)} disabled={paused} aria-haspopup="dialog" aria-expanded={showNav} className="t-subhead tabular flex h-10 items-center gap-1.5 rounded-[10px] bg-ink px-3 font-semibold text-paper disabled:opacity-50 sm:px-4">
          <span className="hidden sm:inline">Question </span>
          {i + 1} of {total}
          <ChevronUp size={16} strokeWidth={2} aria-hidden="true" className={`transition-transform ${showNav ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex items-center justify-end gap-2">
          <span className="hidden sm:flex">{backButton}</span>
          {review?.explanation && (
            <button type="button" onClick={() => setShowExplanation((v) => !v)} aria-pressed={showExplanation} className={`t-callout hidden h-10 items-center gap-1.5 rounded-full border px-4 font-semibold md:flex ${showExplanation ? 'border-primary bg-accent-tint text-accent' : 'border-line-strong text-ink hover:bg-paper-2'}`}>
              <ListChecks size={16} aria-hidden="true" /> Explanation
            </button>
          )}
          {ownPace && !review && answers[q.id] ? (
            <button type="button" onClick={check} disabled={checking || paused} className="lift t-callout flex h-10 items-center gap-1.5 rounded-full bg-ink px-5 font-semibold text-surface disabled:opacity-60">
              {checking ? 'Checking…' : 'Check'} <Check size={16} aria-hidden="true" />
            </button>
          ) : !isLast ? (
            <button type="button" onClick={() => goto(i + 1)} disabled={paused} className="lift t-callout h-10 rounded-full bg-primary px-6 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60">
              Next
            </button>
          ) : (
            finishButton('Finish')
          )}
        </div>

        {showNav && (
          <Navigator
            items={items}
            current={i + 1}
            checked={ownPace}
            grouped={grouped}
            onGrouped={setGrouped}
            onClose={() => setShowNav(false)}
            onGo={(n) => {
              goto(n - 1);
              setShowNav(false);
            }}
            footer={finishButton(ownPace ? 'Finish the set' : 'Finish and check', 'w-full')}
          />
        )}
      </footer>

      {hasMath && !wide && <Calculator visible={showCalculator && math} runId={a.id} onClose={() => setShowCalculator(false)} />}
      {showReference && <Reference onClose={() => setShowReference(false)} />}
      {confirm && (
        <Sheet title="Finish now?" onClose={() => setConfirm(false)}>
          <p className="t-subhead text-ink-2">
            {total - answered} {total - answered === 1 ? 'question is' : 'questions are'} still blank. Blank answers count as wrong.
          </p>
          <div className="mt-5 flex gap-2.5">
            <button type="button" onClick={() => setConfirm(false)} className="h-11 flex-1 rounded-full border border-line-strong text-[15px] font-bold text-ink hover:bg-surface-2">
              Keep going
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirm(false);
                finish();
              }}
              className="lift h-11 flex-1 rounded-full bg-primary text-[15px] font-bold text-on-primary">
              Finish
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** Saves the question to the student's saved questions (or unsaves it): a star, apart from the bookmark of Mark for Review. */
function SaveButton({ id }: { id: string }) {
  const saved = useSavedQuestions();
  const save = useSaveQuestion();
  const on = (saved.data ?? []).some((q) => q.id === id) !== (save.isPending && save.variables?.id === id);
  return (
    <button type="button" onClick={() => save.mutate({ id, on: !on })} aria-pressed={on} aria-label={on ? 'Remove from saved questions' : 'Save this question'} title={on ? 'Saved to your questions' : 'Save this question'} className={`t-footnote flex h-8 items-center gap-1.5 rounded-full px-2 font-semibold ${on ? 'text-accent' : 'text-ink-2 hover:bg-paper hover:text-ink'}`}>
      <Star size={16} strokeWidth={2} fill={on ? 'currentColor' : 'none'} aria-hidden="true" />
      <span className="hidden sm:inline">{on ? 'Saved' : 'Save'}</span>
    </button>
  );
}

function Result({ a, skew }: { a: Assessment; skew: number }) {
  const navigate = useNavigate();
  const r = a.result!;
  const { images, links } = useImages(a);
  const again = useStartAssessment(a.roadmap_id ?? '', a.lesson_id ?? '');
  const againAssigned = useStartAssignment();
  const retake = () =>
    a.assignment
      ? againAssigned.mutate(a.assignment.id, { onSuccess: (n) => void navigate(`/assessments/${n.id}`) })
      : again.mutate({ kind: 'level_check' }, { onSuccess: (n) => void navigate(`/assessments/${n.id}`) });
  const retaking = again.isPending || againAssigned.isPending;
  const back = backOf(a);
  const level = a.kind === 'level_check';
  const practice = a.kind === 'practice';
  const startPractice = useStartPractice();
  const practiseAgain = () =>
    a.practice &&
    startPractice.mutate(
      { subject: a.practice.subject, skills: a.practice.skills, difficulty: a.practice.difficulty, count: Math.min(a.questions.length, a.practice.mode === 'own_pace' ? 200 : 50), seconds_per_question: a.practice.seconds_per_question, mode: a.practice.mode },
      {
        onSuccess: (n) => void navigate(`/assessments/${n.id}`),
        onError: (e) => e instanceof PracticeOpenError && void navigate(`/assessments/${e.open.id}`),
      },
    );
  const comp = a.competition;
  // Until the competition ends, a finished attempt shows its score only.
  const hidden = !!comp && !comp.ended;
  const now = useNow();
  const queryClient = useQueryClient();
  const endsAt = comp ? Date.parse(comp.ends_at) : 0;
  useEffect(() => {
    if (hidden && now + skew >= endsAt) void queryClient.invalidateQueries({ queryKey: ['assessment', a.id] });
  }, [hidden, now, skew, endsAt, queryClient, a.id]);
  if (comp) return <CompetitionResult a={a} hidden={hidden} images={images} links={links} />;
  const verdict = practice ? (r.percent >= 80 ? 'Strong work' : r.percent >= 50 ? 'Good practice' : 'Keep going') : level ? (r.passed ? 'Passed' : 'Not yet') : 'Homework done';
  const ring = 2 * Math.PI * 52;
  return (
    <div className="min-h-dvh bg-brand">
      <div className="mx-auto max-w-[880px] px-4 py-6">
        <Link to={back} className="t-subhead mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-2 hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" /> {practice ? 'Back to the question bank' : a.assignment ? `Back to ${a.assignment.kind === 'level_check' ? 'level checks' : 'homework'}` : 'Back to the lesson'}
        </Link>
        <section className="rise flex flex-col items-center rounded-card border border-line bg-surface p-6 text-center">
          <p className="t-micro text-ink-3">{practice ? 'Practice set complete' : level ? 'Level check complete' : 'Homework complete'}</p>
          <div className="relative mt-4 size-[132px]">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-track)" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none" stroke={!level || r.passed ? 'var(--color-good)' : 'var(--color-primary)'} strokeWidth="10" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (1 - r.percent / 100)} />
            </svg>
            <span className="t-number absolute inset-0 flex items-center justify-center text-[34px] text-ink">{r.percent}%</span>
          </div>
          <h1 className="mt-3 text-[24px] font-semibold text-title">{verdict}</h1>
          <p className="t-subhead mt-1 max-w-md text-ink-2">
            {r.correct} of {r.total} right.{' '}
            {practice ? 'Every question is below with its explanation. The ones you missed are the ones to look at.' : level && !r.passed ? '70% passes. Read the explanations below, then try again with new questions.' : r.lesson_done ? 'Lesson complete: the next one is open on your map.' : level ? 'Now finish the homework to complete the lesson.' : 'Its mistakes are below, with explanations.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <button type="button" onClick={() => void navigate(r.lesson_done && a.roadmap_id ? `/roadmaps/${a.roadmap_id}` : back)} className="lift flex h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-[15px] font-bold text-on-primary hover:bg-primary-hover">
              {r.lesson_done && a.roadmap_id ? 'Back to the map' : a.assignment || practice ? 'Done' : 'Back to the lesson'} <ArrowRight size={16} aria-hidden="true" />
            </button>
            {practice && a.practice && a.questions.length > 1 && (
              <button type="button" disabled={startPractice.isPending} onClick={practiseAgain} className="flex h-11 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-5 text-[15px] font-bold text-ink hover:bg-surface-2 disabled:opacity-60">
                <RotateCcw size={15} aria-hidden="true" /> {startPractice.isPending ? 'Preparing…' : 'New set, same topics'}
              </button>
            )}
            {((level && !r.passed) || a.assignment) && (
              <button type="button" disabled={retaking} onClick={retake} className="flex h-11 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-5 text-[15px] font-bold text-ink hover:bg-surface-2 disabled:opacity-60">
                <RotateCcw size={15} aria-hidden="true" /> {retaking ? 'Preparing…' : 'Try again'}
              </button>
            )}
          </div>
          {startPractice.error && !(startPractice.error instanceof PracticeOpenError) && (
            <div className="mt-4 w-full text-left">
              <Notice tone="error" message={describeError(startPractice.error)} />
            </div>
          )}
        </section>

        <h2 className="mb-3 mt-6 text-[18px] font-bold text-ink">Your answers</h2>
        <ol className="flex flex-col gap-3">
          {a.questions.map((q, k) => {
            const item = r.items.find((x) => x.question_id === q.id);
            return <Review key={q.id} q={q} n={k + 1} item={item} images={images} links={links} />;
          })}
        </ol>
      </div>
    </div>
  );
}

function Review({ q, n, item, images, links }: { q: AssessmentQuestion; n: number; item?: AssessmentResult['items'][number]; images: Record<string, PackageImage>; links: ImageLinks }) {
  const [open, setOpen] = useState(!item?.correct);
  const ok = !!item?.correct;
  return (
    <li className={`rounded-card border bg-surface ${ok ? 'border-line' : 'border-bad/30'}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-good-tint text-good' : 'bg-bad-tint text-bad'}`}>{ok ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}</span>
        <span className="t-headline flex-1 text-ink">Question {n}</span>
        <span className="t-footnote text-ink-2">
          {item?.given ? `You: ${item.given}` : 'Blank'} · Answer: {item?.correct_answer}
        </span>
      </button>
      {open && (
        <div className="border-t border-line p-4">
          {q.passage && <RichContent text={q.passage} images={images} links={links} className="rich t-subhead mb-3 text-ink-2" />}
          <RichContent text={q.stem} images={images} links={links} className="rich t-body text-ink" />
          {q.type === 'mcq' && q.choices && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {LETTERS.filter((l) => q.choices![l] != null).map((l) => {
                const right = l === item?.correct_answer;
                const mine = l === item?.given;
                return (
                  <li key={l} className={`flex items-start gap-2.5 rounded-control border px-3 py-2 ${right ? 'border-good/40 bg-good-tint/60' : mine ? 'border-bad/40 bg-bad-tint/60' : 'border-line'}`}>
                    <span className="font-bold text-ink">{l}</span>
                    <RichContent text={q.choices![l]} images={images} links={links} displayMath className="rich flex-1 text-ink" />
                  </li>
                );
              })}
            </ul>
          )}
          {item?.explanation && (
            <div className="mt-3 rounded-control border-l-4 border-l-info bg-info-tint/50 p-3">
              <p className="t-micro mb-1 text-info">Explanation</p>
              <RichContent text={item.explanation} images={images} links={links} className="rich t-subhead text-ink" />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="fade fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="sheet-up w-full max-w-[480px] rounded-t-panel bg-surface p-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:rounded-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-chip text-ink-2 hover:bg-surface-2">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** A competition attempt, handed in: the score and the place; the answers once the competition ends. */
function CompetitionResult({ a, hidden, images, links }: { a: Assessment; hidden: boolean; images: Record<string, PackageImage>; links: ImageLinks }) {
  const comp = a.competition!;
  const r = a.result!;
  const board = useCompetitionBoard(comp.id, hidden);
  const me = board.data?.me;
  const ring = 2 * Math.PI * 52;
  return (
    <div className="min-h-dvh bg-brand">
      <div className="mx-auto max-w-[880px] px-4 py-6">
        <Link to={`/competitions/${comp.id}`} className="t-subhead mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-2 hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" /> Back to the competition
        </Link>
        <section className="rise flex flex-col items-center rounded-card border border-line bg-surface p-6 text-center">
          <p className="t-micro text-ink-3">{comp.title}</p>
          <div className="relative mt-4 size-[132px]">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-track)" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-good)" strokeWidth="10" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (1 - r.percent / 100)} />
            </svg>
            <span className="t-number absolute inset-0 flex flex-col items-center justify-center text-[34px] leading-none text-ink">
              {r.correct}
              <span className="t-footnote mt-1 font-semibold text-ink-3">of {r.total}</span>
            </span>
          </div>
          <h1 className="mt-3 text-[24px] font-semibold text-title">{hidden ? 'Handed in' : 'Final result'}</h1>
          <p className="t-subhead mt-1 max-w-md text-ink-2">
            {me ? (
              <>
                You’re <span className="font-bold text-ink">{ordinal(me.rank)}</span> of {board.data!.participants}
                {hidden ? ' so far' : ''}.{' '}
              </>
            ) : null}
            {hidden ? `Answers and explanations open when the competition ends, ${dueLong(comp.ends_at)}.` : 'Every question is below with its answer and explanation.'}
          </p>
          <Link to={`/competitions/${comp.id}`} className="lift mt-5 flex h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-[15px] font-bold text-on-primary hover:bg-primary-hover">
            <Trophy size={16} aria-hidden="true" /> See the board
          </Link>
        </section>

        <h2 className="mb-3 mt-6 text-[18px] font-bold text-ink">Your answers</h2>
        {hidden ? (
          <div className="flex items-start gap-3 rounded-card border border-line bg-surface p-5">
            <Lock size={18} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
            <p className="t-subhead text-ink-2">Others are still taking part, so the answers stay closed until {dueLong(comp.ends_at)}. This page opens them on its own then.</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {a.questions.map((q, k) => (
              <Review key={q.id} q={q} n={k + 1} item={r.items.find((x) => x.question_id === q.id)} images={images} links={links} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
