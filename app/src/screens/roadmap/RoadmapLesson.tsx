import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, ClipboardCheck, Clock, Lightbulb, ListChecks, NotebookPen, RotateCcw, Target } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ApiError } from '@/api/client';
import { describeError } from '@/api/errors';
import { useLesson, useRoadmap, useStartAssessment, type Example, type LessonDetail } from '@/api/roadmaps';
import { RichContent } from '@/components/practice/RichContent';
import { Notice } from '@/components/Notice';
import { Skeleton } from '@/components/States';
import { Pill } from '@/components/ui';
import { useTitle } from '@/lib/title';

// A lesson: what you'll be able to do, the notes, worked examples, the
// mistakes people make, then the level check (70 % to pass) and the
// homework. The lesson is done once both are; the next one opens.

const NO_IMAGES = {};

export function RoadmapLesson() {
  const { id = '', lessonId = '' } = useParams();
  const roadmap = useRoadmap(id);
  const lesson = useLesson(id, lessonId);
  useTitle(lesson.data?.lesson.title ?? 'Lesson');
  const unit = roadmap.data?.units.find((u) => u.lessons.some((l) => l.id === lessonId));
  const back = unit ? { to: `/roadmaps/${id}/units/${unit.id}`, label: unit.title } : { to: `/roadmaps/${id}`, label: roadmap.data?.title ?? 'Roadmap' };

  return (
    <div className="mx-auto w-full max-w-[880px]">
      <Link to={back.to} className="t-subhead mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> {back.label}
      </Link>
      {lesson.isPending ? (
        <Skeleton height={480} radius={16} />
      ) : lesson.isError ? (
        <LessonError err={lesson.error} back={back.to} />
      ) : (
        <Lesson d={lesson.data} roadmapId={id} subject={roadmap.data?.subject} />
      )}
    </div>
  );
}

function LessonError({ err, back }: { err: unknown; back: string }) {
  const code = err instanceof ApiError ? err.code : null;
  const text = code === 'lesson_locked' ? 'Finish the lesson before this one to open it.' : code === 'enrolled_only' ? 'This part of the journey is for SATMAKON students. Enrol to continue.' : describeError(err);
  return (
    <div className="flex flex-col gap-3">
      <Notice tone={code ? 'info' : 'error'} message={text} />
      <Link to={back} className="t-subhead font-bold text-accent hover:underline">
        Back
      </Link>
    </div>
  );
}

function Lesson({ d, roadmapId, subject }: { d: LessonDetail; roadmapId: string; subject?: string }) {
  const { lesson: l, level_check: lc, homework } = d;
  const hwDone = homework.filter((h) => h.done).length;
  return (
    <>
      <header className="rounded-card border border-line bg-surface p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {subject && <Pill tone="primary">{subject === 'math' ? 'Math' : 'English'}</Pill>}
          {l.skills.map((s) => (
            <Pill key={s} tone="neutral">
              {s}
            </Pill>
          ))}
          <span className="t-footnote ml-auto inline-flex items-center gap-1.5 text-ink-2">
            <Clock size={14} aria-hidden="true" /> {l.minutes} min
          </span>
        </div>
        <h1 className="mt-3 text-[28px] font-semibold leading-9 tracking-[-0.02em] text-title">{l.title}</h1>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <Step done={lc.passed} label="Level check" detail={lc.passed ? `Passed${lc.best != null ? ` · ${lc.best}%` : ''}` : lc.best != null ? `Best ${lc.best}% · ${lc.pass_percent}% to pass` : `${lc.pass_percent}% to pass`} />
          <Step done={hwDone === homework.length} label="Homework" detail={`${hwDone} of ${homework.length} done`} />
        </div>
        {l.status === 'done' && <p className="t-footnote mt-3 font-semibold text-good">Lesson complete. The next one is open.</p>}
      </header>

      <Section icon={Target} title="By the end of this lesson">
        <ul className="flex flex-col gap-2">
          {l.objectives.map((o, i) => (
            <li key={i} className="flex gap-2.5">
              <Check size={17} className="mt-0.5 shrink-0 text-good" aria-hidden="true" />
              <RichContent text={o.replace(/^Students can /, 'You can ')} images={NO_IMAGES} links={NO_IMAGES} className="rich t-body text-ink" />
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={NotebookPen} title="Notes">
        <RichContent text={l.notes} images={NO_IMAGES} links={NO_IMAGES} className="rich t-body text-ink" />
      </Section>

      {l.examples.length > 0 && (
        <Section icon={Lightbulb} title="Worked examples">
          <div className="flex flex-col gap-3">
            {l.examples.map((e, i) => (
              <ExampleCard key={i} e={e} n={i + 1} />
            ))}
          </div>
        </Section>
      )}

      {l.common_mistakes.length > 0 && (
        <Section icon={AlertTriangle} title="Common mistakes">
          <ul className="flex flex-col gap-2.5">
            {l.common_mistakes.map((m, i) => (
              <li key={i} className="flex gap-2.5 rounded-control bg-watch-tint/60 p-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-watch" aria-hidden="true" />
                <RichContent text={m} images={NO_IMAGES} links={NO_IMAGES} className="rich t-subhead text-ink" />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section icon={ClipboardCheck} title="Level check" right={<span className="t-footnote text-ink-2">{lc.questions} questions · {lc.pass_percent}% to pass</span>}>
        <AssessmentRow
          roadmapId={roadmapId}
          lessonId={l.id}
          kind={{ kind: 'level_check' }}
          title="Show what you’ve learnt"
          detail={lc.passed ? `Passed with ${lc.best}%. Retake it any time for practice.` : lc.attempts.length ? `Best so far ${lc.best}%. Each retake has new questions.` : `${lc.questions} questions: ${mixText(lc.mix)}.`}
          state={lc.open ? 'continue' : lc.passed ? 'again' : lc.attempts.length ? 'retake' : 'start'}
          done={lc.passed}
          openId={lc.open?.id ?? null}
          lastId={lc.attempts[lc.attempts.length - 1]?.id ?? null}
        />
      </Section>

      <Section icon={ListChecks} title="Homework" right={<span className="t-footnote text-ink-2">{hwDone}/{homework.length} done</span>}>
        <div className="flex flex-col gap-2.5">
          {homework.map((h) => (
            <AssessmentRow
              key={h.index}
              roadmapId={roadmapId}
              lessonId={l.id}
              kind={{ kind: 'homework', index: h.index }}
              title={h.title}
              detail={`${h.questions} questions · ${h.difficulty}${h.attempt ? ` · last ${h.attempt.percent}%` : ''}`}
              state={h.open ? 'continue' : h.done ? 'again' : 'start'}
              done={h.done}
              openId={h.open?.id ?? null}
              lastId={h.attempt?.id ?? null}
            />
          ))}
        </div>
      </Section>
    </>
  );
}

const mixText = (m: { easy: number; medium: number; hard: number }) =>
  (['easy', 'medium', 'hard'] as const)
    .filter((k) => m[k] > 0)
    .map((k) => `${m[k]} ${k}`)
    .join(', ');

function Step({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-control border p-3 ${done ? 'border-good/30 bg-good-tint/60' : 'border-line bg-surface-2'}`}>
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${done ? 'bg-good text-white' : 'border-2 border-line-strong text-ink-3'}`}>{done && <Check size={16} strokeWidth={3} aria-hidden="true" />}</span>
      <div>
        <p className="t-headline text-ink">{label}</p>
        <p className="t-footnote text-ink-2">{detail}</p>
      </div>
    </div>
  );
}

function Section({ icon: I, title, right, children }: { icon: typeof Target; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-3.5 rounded-card border border-line bg-surface p-5 md:p-6">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[18px] font-bold text-ink">
          <span className="flex size-8 items-center justify-center rounded-[9px] bg-accent-tint text-primary">
            <I size={17} aria-hidden="true" />
          </span>
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function ExampleCard({ e, n }: { e: Example; n: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-control border border-line">
      <div className="p-4">
        <p className="t-micro mb-1.5 text-ink-3">Example {n}</p>
        <RichContent text={e.problem} images={NO_IMAGES} links={NO_IMAGES} className="rich t-body text-ink" />
      </div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="t-subhead flex w-full items-center justify-between border-t border-line px-4 py-2.5 font-bold text-accent hover:bg-surface-2">
        {open ? 'Hide the solution' : 'Show the solution'}
        <ChevronDown size={17} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="border-t border-line bg-surface-2/60 p-4">
          <ol className="flex flex-col gap-2">
            {e.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-tint text-[12px] font-bold text-primary">{i + 1}</span>
                <RichContent text={s} images={NO_IMAGES} links={NO_IMAGES} className="rich t-subhead text-ink" />
              </li>
            ))}
          </ol>
          <div className="mt-3 flex items-baseline gap-2 rounded-control bg-good-tint/70 px-3 py-2">
            <span className="t-micro text-good">Answer</span>
            <RichContent text={e.answer} images={NO_IMAGES} links={NO_IMAGES} className="rich t-headline text-ink" />
          </div>
        </div>
      )}
    </div>
  );
}

function AssessmentRow({
  roadmapId,
  lessonId,
  kind,
  title,
  detail,
  state,
  done,
  openId,
  lastId,
}: {
  roadmapId: string;
  lessonId: string;
  kind: { kind: 'level_check' } | { kind: 'homework'; index: number };
  title: string;
  detail: string;
  state: 'start' | 'continue' | 'retake' | 'again';
  done: boolean;
  openId: string | null;
  lastId: string | null;
}) {
  const navigate = useNavigate();
  const start = useStartAssessment(roadmapId, lessonId);
  const label = { start: 'Let’s start', continue: 'Continue', retake: 'Try again', again: 'Practise again' }[state];
  const go = () => {
    if (openId) return void navigate(`/assessments/${openId}`);
    start.mutate(kind, { onSuccess: (a) => void navigate(`/assessments/${a.id}`) });
  };
  return (
    <div className={`rounded-control border border-line border-l-4 p-3.5 ${done ? 'border-l-good' : 'border-l-primary'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="t-headline flex items-center gap-2 text-ink">
            {title} {done && <Pill tone="good">Done</Pill>}
          </p>
          <p className="t-footnote mt-0.5 text-ink-2">{detail}</p>
        </div>
        {lastId && !openId && (
          <Link to={`/assessments/${lastId}`} className="t-footnote font-bold text-accent hover:underline">
            Last result
          </Link>
        )}
        <button
          type="button"
          onClick={go}
          disabled={start.isPending}
          className={`lift flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold disabled:opacity-60 ${state === 'again' ? 'border border-line-strong bg-surface text-ink hover:bg-surface-2' : 'bg-primary text-on-primary hover:bg-primary-hover'}`}>
          {state === 'again' || state === 'retake' ? <RotateCcw size={15} aria-hidden="true" /> : null}
          {start.isPending ? 'Preparing…' : label}
          {state === 'start' || state === 'continue' ? <ArrowRight size={15} aria-hidden="true" /> : null}
        </button>
      </div>
      {start.isError && <p className="t-footnote mt-2 text-bad">{start.error instanceof ApiError && start.error.code === 'no_questions' ? 'There are no questions for this yet. Please try again later.' : describeError(start.error)}</p>}
    </div>
  );
}
