import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, LayoutGrid, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { useStartAssignment } from '@/api/assignments';
import { describeError } from '@/api/errors';
import { dueShort } from '@/components/assignments/format';
import { saveAnswers, useAssessment, useStartAssessment, useSubmitAssessment, type Assessment, type AssessmentQuestion, type AssessmentResult } from '@/api/roadmaps';
import { Spinner } from '@/components/Button';
import { AnswerChoice } from '@/components/practice/AnswerChoice';
import { GridInInput } from '@/components/practice/GridInInput';
import { RichContent, type ImageLinks } from '@/components/practice/RichContent';
import { Notice } from '@/components/Notice';
import { useNow } from '@/lib/clock';
import { useTitle } from '@/lib/title';
import type { PackageImage } from '@/lib/practice/types';

// "/assessments/:id": a level check or a homework set from a roadmap lesson,
// full screen. One question at a time with a navigator; answers are saved to
// the server as you go (a reload continues), and it's graded there on
// submit. Then the result: the score, passed or not, and every question with
// the right answer and its explanation.

const LETTERS = ['A', 'B', 'C', 'D'];

/** Where leaving goes: the assignment's tab, or the roadmap lesson. */
const ASSIGNMENT_TAB = { homework: '/homework', level_check: '/level-checks', exam: '/exams' } as const;
export function backOf(a: Assessment): string {
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
  return a.data.finished_at ? <Result a={a.data} /> : <Run a={a.data} />;
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

function Run({ a }: { a: Assessment }) {
  const navigate = useNavigate();
  const submit = useSubmitAssessment(a.id);
  const { images, links } = useImages(a);
  const [answers, setAnswers] = useState<Record<string, string | null>>(a.answers);
  const [eliminated, setEliminated] = useState<Record<string, string[]>>({});
  const [i, setI] = useState(() => Math.max(0, a.questions.findIndex((q) => a.answers[q.id] == null)));
  const [grid, setGrid] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const q = a.questions[i]!;
  const answered = a.questions.filter((x) => answers[x.id] != null && answers[x.id] !== '').length;
  const back = backOf(a);
  const now = useNow();

  // Seconds spent on each question: counted while it is on screen and the
  // tab is visible, kept with the answers (the teacher's statistics).
  const times = useRef<Record<string, number>>({ ...a.times });
  const shownSince = useRef<number | null>(null);
  const shown = useRef<string | null>(null); // the question being counted
  const timesDirty = useRef(false);
  // Adds the time since the last tally to the question on screen, and starts counting again.
  const tally = () => {
    const id = shown.current;
    if (id && shownSince.current != null) {
      const secs = Math.round((Date.now() - shownSince.current) / 1000);
      if (secs > 0) {
        times.current[id] = Math.min(21_600, (times.current[id] ?? 0) + secs);
        timesDirty.current = true;
      }
    }
    shownSince.current = document.visibilityState === 'visible' ? Date.now() : null;
  };
  // A new question starts its own count (the previous one is tallied first).
  useEffect(() => {
    shown.current = q.id;
    shownSince.current = document.visibilityState === 'visible' ? Date.now() : null;
    const onVisibility = () => tally();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      tally();
    };
  }, [q.id]);

  // Saved to the server a moment after each change, so a reload or another device continues.
  const pending = useRef<Record<string, string | null>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = () => {
    const batch = pending.current;
    pending.current = {};
    const sendTimes = timesDirty.current;
    timesDirty.current = false;
    if (Object.keys(batch).length || sendTimes)
      saveAnswers(a.id, batch, sendTimes ? { ...times.current } : undefined).catch(() => {
        pending.current = { ...batch, ...pending.current };
        timesDirty.current = timesDirty.current || sendTimes;
      });
  };
  useEffect(() => () => {
    clearTimeout(timer.current);
    flush();
  });
  const answer = (value: string | null) => {
    setAnswers((x) => ({ ...x, [q.id]: value }));
    pending.current[q.id] = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  };

  const finish = () => {
    clearTimeout(timer.current);
    pending.current = {};
    tally();
    timesDirty.current = false;
    submit.mutate({ answers, times: { ...times.current } }, { onSuccess: () => window.scrollTo(0, 0) });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-brand">
      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-[880px] items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => {
              flush();
              void navigate(back);
            }}
            aria-label="Save and leave"
            className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2">
            <X size={19} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-ink">{a.title}</p>
            <p className="t-footnote truncate text-ink-2">
              {a.kind === 'level_check' ? 'Level check' : 'Homework'} · {answered}/{a.questions.length} answered
              {a.assignment && ` · due ${dueShort(a.assignment.due_at, now)}`}
            </p>
          </div>
          <button type="button" onClick={() => setGrid(true)} className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] font-bold text-ink hover:bg-surface-2">
            <LayoutGrid size={15} aria-hidden="true" /> {i + 1} of {a.questions.length}
          </button>
        </div>
        <div className="h-1 bg-track">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${(100 * answered) / a.questions.length}%` }} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-6">
        <Question key={q.id} q={q} n={i + 1} images={images} links={links} value={answers[q.id] ?? null} eliminated={eliminated[q.id] ?? []} onAnswer={answer} onEliminate={(l) => setEliminated((x) => ({ ...x, [q.id]: (x[q.id] ?? []).includes(l) ? x[q.id]!.filter((y) => y !== l) : [...(x[q.id] ?? []), l] }))} />
        {submit.isError && (
          <div className="mt-4">
            <Notice tone="error" message={describeError(submit.error)} />
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex h-16 max-w-[880px] items-center justify-between gap-3 px-4">
          <button type="button" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} className="flex h-10 items-center gap-1 rounded-full border border-line px-4 text-[14px] font-bold text-ink hover:bg-surface-2 disabled:opacity-40">
            <ChevronLeft size={16} aria-hidden="true" /> Back
          </button>
          {i < a.questions.length - 1 ? (
            <button type="button" onClick={() => setI((x) => x + 1)} className="lift flex h-10 items-center gap-1 rounded-full bg-primary px-5 text-[14px] font-bold text-on-primary hover:bg-primary-hover">
              Next <ChevronRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" onClick={() => (answered < a.questions.length ? setConfirm(true) : finish())} disabled={submit.isPending} className="lift flex h-10 items-center gap-1.5 rounded-full bg-primary px-5 text-[14px] font-bold text-on-primary hover:bg-primary-hover disabled:opacity-60">
              {submit.isPending ? 'Checking…' : 'Finish'} <Check size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </footer>

      {grid && (
        <Sheet title="Questions" onClose={() => setGrid(false)}>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {a.questions.map((x, k) => {
              const done = answers[x.id] != null && answers[x.id] !== '';
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => {
                    setI(k);
                    setGrid(false);
                  }}
                  aria-label={`Question ${k + 1}${done ? ', answered' : ''}`}
                  className={`flex h-11 items-center justify-center rounded-control border text-[14px] font-bold ${k === i ? 'ring-2 ring-primary ring-offset-2' : ''} ${done ? 'border-primary bg-primary text-on-primary' : 'border-dashed border-line-strong text-ink'}`}>
                  {k + 1}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => (setGrid(false), answered < a.questions.length ? setConfirm(true) : finish())} className="lift mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-bold text-on-primary">
            Finish and check
          </button>
        </Sheet>
      )}
      {confirm && (
        <Sheet title="Finish now?" onClose={() => setConfirm(false)}>
          <p className="t-subhead text-ink-2">
            {a.questions.length - answered} {a.questions.length - answered === 1 ? 'question is' : 'questions are'} still blank. Blank answers count as wrong.
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

function Question({ q, n, images, links, value, eliminated, onAnswer, onEliminate }: { q: AssessmentQuestion; n: number; images: Record<string, PackageImage>; links: ImageLinks; value: string | null; eliminated: string[]; onAnswer: (v: string | null) => void; onEliminate: (letter: string) => void }) {
  return (
    <div className="rise">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-[8px] bg-ink text-[14px] font-bold text-surface">{n}</span>
        {q.difficulty && <span className="t-micro text-ink-3">{q.difficulty}</span>}
      </div>
      <div className={`grid gap-6 ${q.passage ? 'lg:grid-cols-2' : ''}`}>
        {q.passage && (
          <div className="rounded-card border border-line bg-surface p-5">
            <RichContent text={q.passage} images={images} links={links} className="rich t-body text-ink" />
          </div>
        )}
        <div>
          <RichContent text={q.stem} images={images} links={links} className="rich t-body text-ink" />
          <div className="mt-5">
            {q.type === 'mcq' && q.choices ? (
              <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Answer choices">
                {LETTERS.filter((l) => q.choices![l] != null).map((l) => (
                  <AnswerChoice key={l} letter={l} content={<RichContent text={q.choices![l]} images={images} links={links} displayMath className="rich" />} selected={value === l} eliminated={eliminated.includes(l)} crossOut onSelect={() => onAnswer(value === l ? null : l)} onToggleEliminate={() => onEliminate(l)} />
                ))}
              </div>
            ) : (
              <div className="max-w-xs">
                <p className="t-micro mb-2 text-ink-3">Your answer</p>
                <GridInInput value={value ?? ''} onChange={(v) => onAnswer(v === '' ? null : v)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Result({ a }: { a: Assessment }) {
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
  const verdict = level ? (r.passed ? 'Passed' : 'Not yet') : 'Homework done';
  const ring = 2 * Math.PI * 52;
  return (
    <div className="min-h-dvh bg-brand">
      <div className="mx-auto max-w-[880px] px-4 py-6">
        <Link to={back} className="t-subhead mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-2 hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" /> {a.assignment ? `Back to ${a.assignment.kind === 'level_check' ? 'level checks' : 'homework'}` : 'Back to the lesson'}
        </Link>
        <section className="rise flex flex-col items-center rounded-card border border-line bg-surface p-6 text-center">
          <p className="t-micro text-ink-3">{level ? 'Level check complete' : 'Homework complete'}</p>
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
            {level && !r.passed ? '70% passes. Read the explanations below, then try again with new questions.' : r.lesson_done ? 'Lesson complete: the next one is open on your map.' : level ? 'Now finish the homework to complete the lesson.' : 'Its mistakes are below, with explanations.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <button type="button" onClick={() => void navigate(r.lesson_done && a.roadmap_id ? `/roadmaps/${a.roadmap_id}` : back)} className="lift flex h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-[15px] font-bold text-on-primary hover:bg-primary-hover">
              {r.lesson_done && a.roadmap_id ? 'Back to the map' : a.assignment ? 'Done' : 'Back to the lesson'} <ArrowRight size={16} aria-hidden="true" />
            </button>
            {((level && !r.passed) || a.assignment) && (
              <button type="button" disabled={retaking} onClick={retake} className="flex h-11 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-5 text-[15px] font-bold text-ink hover:bg-surface-2 disabled:opacity-60">
                <RotateCcw size={15} aria-hidden="true" /> {retaking ? 'Preparing…' : 'Try again'}
              </button>
            )}
          </div>
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
