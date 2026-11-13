import { Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, History, Shuffle, SlidersHorizontal, Timer, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { describeError } from '@/api/errors';
import { PracticeOpenError, useDiscardPractice, usePracticeSets, usePracticeStats, useSavedQuestions, useStartPractice, useTopics, type PracticeRequest, type Subject } from '@/api/practiceSets';
import type { Assessment } from '@/api/roadmaps';
import { Notice } from '@/components/Notice';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { Action, Modal } from '@/components/ui';
import { useTitle } from '@/lib/title';

// The question bank's pages below the hub (spec 22.8): a subject's topics
// to choose and start, the saved questions, and the history of sets.

const NAME: Record<Subject, string> = { math: 'Math', english: 'Reading & Writing' };
/** The SAT's own pace: 64 min for 54 Reading and Writing questions, 70 for 44 Math ones. */
const SAT_PACE: Record<Subject, number> = { english: 71, math: 95 };
const OWN_PACE_MAX = 200;

type Difficulty = '' | 'easy' | 'medium' | 'hard';

function Back() {
  return (
    <Link to="/questions" className="t-subhead -ml-1 mb-4 inline-flex h-10 items-center gap-1 rounded-chip pr-2 text-ink-2 hover:text-ink">
      <ChevronLeft size={18} aria-hidden="true" /> Back to the question bank
    </Link>
  );
}

/** Starting a set: straight to the runner, or the open set to continue or discard. */
function useBegin() {
  const start = useStartPractice();
  const navigate = useNavigate();
  const [open, setOpen] = useState<{ set: Assessment; retry: PracticeRequest } | null>(null);
  const begin = (body: PracticeRequest) =>
    start.mutate(body, {
      onSuccess: (a) => void navigate(`/assessments/${a.id}`),
      onError: (e) => e instanceof PracticeOpenError && setOpen({ set: e.open, retry: body }),
    });
  const dialog = open && <OpenSetDialog open={open.set} onClose={() => setOpen(null)} onDiscarded={() => (setOpen(null), begin(open.retry))} />;
  const error = start.error && !(start.error instanceof PracticeOpenError) && (
    <div className="mb-3">
      <Notice tone="error" title="Couldn’t start the practice" message={describeError(start.error)} />
    </div>
  );
  return { begin, busy: start.isPending, dialog, error };
}

// --- A subject: its topics.

export function SubjectBank() {
  const { subject: param } = useParams();
  const subject: Subject = param === 'english' ? 'english' : 'math';
  useTitle(`${NAME[subject]} · Question bank`);
  const topics = useTopics();
  const stats = usePracticeStats();
  const { begin, busy, dialog, error } = useBegin();
  const [picked, setPicked] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('');
  const [unsolved, setUnsolved] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [choose, setChoose] = useState<string[] | null>(null); // the skills a mode is being chosen for ([] = all)
  const domains = topics.data?.[subject] ?? [];
  const solved = stats.data?.subjects[subject].skills ?? {};
  const allSkills = domains.flatMap((d) => d.skills).filter((s) => s.total > 0);
  const toggle = (skill: string) => setPicked((p) => (p.includes(skill) ? p.filter((x) => x !== skill) : [...p, skill]));
  const countOf = (skills: string[]) => {
    const list = skills.length ? allSkills.filter((s) => skills.includes(s.skill)) : allSkills;
    return list.reduce((n, s) => n + (difficulty ? s[difficulty] : s.total) - (unsolved ? (solved[s.skill] ?? 0) : 0), 0);
  };

  return (
    <div className="mx-auto w-full max-w-[860px] pb-24">
      <Back />
      <h1 className="text-[30px] font-semibold leading-9 tracking-[-0.02em] text-title">{NAME[subject]}</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        <Menu
          icon={SlidersHorizontal}
          label={difficulty ? `Difficulty: ${difficulty[0]!.toUpperCase()}${difficulty.slice(1)}` : 'Difficulty'}
          active={!!difficulty}
          options={[
            ['', 'Any difficulty'],
            ['easy', 'Easy'],
            ['medium', 'Medium'],
            ['hard', 'Hard'],
          ]}
          value={difficulty}
          onChange={(v) => setDifficulty(v as Difficulty)}
        />
        <Menu
          icon={CircleCheck}
          label={unsolved ? 'Unsolved only' : 'All questions'}
          active={unsolved}
          options={[
            ['all', 'All questions'],
            ['unsolved', 'Unsolved only'],
          ]}
          value={unsolved ? 'unsolved' : 'all'}
          onChange={(v) => setUnsolved(v === 'unsolved')}
        />
        <Menu
          icon={Shuffle}
          label={shuffle ? 'Order: shuffled' : 'Order: easy to hard'}
          active={shuffle}
          options={[
            ['normal', 'Easy to hard'],
            ['shuffle', 'Shuffled'],
          ]}
          value={shuffle ? 'shuffle' : 'normal'}
          onChange={(v) => setShuffle(v === 'shuffle')}
        />
      </div>
      {error && <div className="mt-3">{error}</div>}

      <section className="mt-4 flex items-center justify-between gap-4 rounded-card border border-line bg-surface p-4 sm:p-5">
        <div>
          <h2 className="t-headline text-ink">Practise every topic</h2>
          <p className="t-footnote text-ink-2">
            All {allSkills.length} topics in {NAME[subject]}, {countOf([]).toLocaleString('en-US')} questions.
          </p>
        </div>
        <button type="button" disabled={busy || countOf([]) === 0} onClick={() => setChoose([])} className="t-subhead h-10 shrink-0 rounded-control bg-surface-2 px-4 font-semibold text-ink hover:bg-line disabled:opacity-50">
          Start practice
        </button>
      </section>

      {topics.isPending ? (
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton height={24} width={200} />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={36} />
          ))}
        </div>
      ) : topics.isError ? (
        <div className="mt-6">
          <ErrorState title="Couldn’t load the topics" message={describeError(topics.error)} onRetry={() => void topics.refetch()} retrying={topics.isFetching} />
        </div>
      ) : (
        <>
          <div className="t-footnote mt-6 flex justify-between border-b border-line pb-2 text-ink-3">
            <span>Topic</span>
            <span className="w-[150px] sm:w-[170px]">Progress</span>
          </div>
          {domains.map((d) => (
            <section key={d.domain} className="mt-6">
              <h2 className="text-[19px] font-semibold text-ink">{d.domain}</h2>
              <ul className="mt-2">
                {d.skills.map((s) => {
                  const on = picked.includes(s.skill);
                  const done = solved[s.skill] ?? 0;
                  return (
                    <li key={s.skill}>
                      <button type="button" role="checkbox" aria-checked={on} disabled={s.total === 0} onClick={() => toggle(s.skill)} className="flex min-h-11 w-full items-center gap-3 rounded-control px-1 py-1.5 text-left hover:bg-surface-2 disabled:opacity-45">
                        <span className={`flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 ${on ? 'border-ink bg-ink text-surface' : 'border-line-strong'}`}>{on && <Check size={13} strokeWidth={3.5} aria-hidden="true" />}</span>
                        <span className="t-subhead min-w-0 flex-1 font-medium text-ink">{s.skill}</span>
                        <span className="flex w-[150px] shrink-0 items-center gap-3 sm:w-[170px]">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
                            <span className="block h-full rounded-full bg-fill-good" style={{ width: `${s.total ? (100 * done) / s.total : 0}%` }} />
                          </span>
                          <span className="t-footnote tabular w-14 text-right text-ink-2">
                            {done}/{s.total}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}

      {picked.length > 0 && (
        <div className="pointer-events-none sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 mt-6 flex justify-center md:bottom-6">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-[#14161c] py-2 pl-5 pr-2 text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.45)]">
            <span className="t-subhead whitespace-nowrap font-semibold">
              {picked.length} {picked.length === 1 ? 'topic' : 'topics'} selected
            </span>
            <button type="button" role="switch" aria-checked={shuffle} onClick={() => setShuffle(!shuffle)} className="t-footnote hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 font-semibold sm:flex">
              <Shuffle size={14} aria-hidden="true" /> Shuffle
              <span className={`flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${shuffle ? 'bg-[#2fb2f4]' : 'bg-white/30'}`}>
                <span className={`size-3 rounded-full bg-white transition-transform ${shuffle ? 'translate-x-3' : ''}`} />
              </span>
            </button>
            <button type="button" disabled={busy || countOf(picked) === 0} onClick={() => setChoose(picked)} className="t-subhead h-10 rounded-full bg-[#2fb2f4] px-5 font-bold text-[#06243f] hover:bg-[#5cc4f7] disabled:opacity-50">
              Start
            </button>
          </div>
        </div>
      )}

      {choose && (
        <ModeDialog
          subject={subject}
          available={countOf(choose)}
          busy={busy}
          onClose={() => setChoose(null)}
          onStart={(mode, count) => {
            setChoose(null);
            begin({
              subject,
              skills: choose,
              difficulty: difficulty || 'mixed',
              count,
              mode,
              unsolved,
              shuffle,
              seconds_per_question: mode === 'rush' ? SAT_PACE[subject] : 0,
            });
          }}
        />
      )}
      {dialog}
    </div>
  );
}

function Menu({ icon: I, label, active, options, value, onChange }: { icon: typeof Shuffle; label: string; active: boolean; options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <label className={`t-subhead relative inline-flex h-10 items-center gap-2 rounded-control border px-3 font-semibold ${active ? 'border-primary bg-accent-tint text-accent' : 'border-line bg-surface-2 text-ink'}`}>
      <I size={15} aria-hidden="true" />
      <span>{label}</span>
      <ChevronDown size={15} aria-hidden="true" />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function ModeDialog({ subject, available, busy, onClose, onStart }: { subject: Subject; available: number; busy: boolean; onClose: () => void; onStart: (mode: 'own_pace' | 'rush', count: number) => void }) {
  const [rushCount, setRushCount] = useState(Math.min(10, available));
  const pace = SAT_PACE[subject];
  const ownPace = Math.min(available, OWN_PACE_MAX);
  return (
    <Modal title="How would you like to practise?" onClose={onClose} width={480}>
      <div className="flex flex-col gap-3 pb-1">
        <section className="relative overflow-hidden rounded-card bg-surface-2 p-5">
          <h3 className="t-headline text-ink">At your own pace</h3>
          <p className="t-subhead mt-1 max-w-[300px] text-ink-2">
            Check each answer as you go and read its explanation. {ownPace === available ? `All ${ownPace}` : `The first ${ownPace}`} questions, no clock.
          </p>
          <button type="button" disabled={busy || ownPace === 0} onClick={() => onStart('own_pace', ownPace)} className="t-subhead mt-4 inline-flex h-10 items-center gap-1 rounded-full bg-[#14161c] px-4 font-bold text-white disabled:opacity-50">
            Continue <ChevronRight size={15} aria-hidden="true" />
          </button>
          <CircleCheck size={84} strokeWidth={1.4} className="pointer-events-none absolute -bottom-4 -right-3 text-ink opacity-[0.08]" aria-hidden="true" />
        </section>
        <section className="relative overflow-hidden rounded-card bg-surface-2 p-5">
          <h3 className="t-headline text-ink">Question Rush</h3>
          <p className="t-subhead mt-1 max-w-[300px] text-ink-2">
            Race the clock at the SAT’s pace, {Math.floor(pace / 60)}:{String(pace % 60).padStart(2, '0')} a question. Answers are checked when you hand in.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Questions in the rush">
            {[5, 10, 20, 30].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rushCount === n} disabled={n > available && n !== 5} onClick={() => setRushCount(n)} className={`t-footnote h-8 min-w-11 rounded-full border px-3 font-semibold disabled:opacity-40 ${rushCount === n ? 'border-ink bg-ink text-surface' : 'border-line-strong text-ink'}`}>
                {n}
              </button>
            ))}
          </div>
          <button type="button" disabled={busy || available === 0} onClick={() => onStart('rush', Math.max(1, Math.min(rushCount, available)))} className="t-subhead mt-4 inline-flex h-10 items-center gap-1 rounded-full bg-[#14161c] px-4 font-bold text-white disabled:opacity-50">
            <Timer size={15} aria-hidden="true" /> Continue <ChevronRight size={15} aria-hidden="true" />
          </button>
          <Zap size={84} strokeWidth={1.4} className="pointer-events-none absolute -bottom-4 -right-3 text-ink opacity-[0.08]" aria-hidden="true" />
        </section>
      </div>
    </Modal>
  );
}

// --- Saved questions.

export function SavedQuestions() {
  useTitle('Saved questions');
  const saved = useSavedQuestions();
  const { begin, busy, dialog, error } = useBegin();
  const list = saved.data ?? [];
  const bySubject = (s: Subject) => list.filter((q) => (s === 'math' ? MATH_DOMAINS : ENGLISH_DOMAINS).includes(q.domain));
  return (
    <div className="mx-auto w-full max-w-[860px]">
      <Back />
      <h1 className="text-[30px] font-semibold leading-9 tracking-[-0.02em] text-title">Saved questions</h1>
      <p className="t-subhead mt-1 text-ink-2">The questions you saved while practising. Open one, or practise them together.</p>
      {error && <div className="mt-3">{error}</div>}
      {saved.isPending ? (
        <div className="mt-5">
          <Skeleton height={200} radius={16} />
        </div>
      ) : saved.isError ? (
        <div className="mt-5">
          <ErrorState title="Couldn’t load your saved questions" message={describeError(saved.error)} onRetry={() => void saved.refetch()} retrying={saved.isFetching} />
        </div>
      ) : list.length === 0 ? (
        <div className="mt-5">
          <EmptyState icon={Bookmark} title="Nothing saved yet" message="While you practise, save a question with the bookmark to find it here." />
        </div>
      ) : (
        (['english', 'math'] as const).map((s) => {
          const qs = bySubject(s);
          if (qs.length === 0) return null;
          return (
            <section key={s} className="mt-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="t-headline text-ink">
                  {NAME[s]} <span className="tabular text-ink-3">{qs.length}</span>
                </h2>
                <button type="button" disabled={busy} onClick={() => begin({ subject: s, question_ids: qs.map((q) => q.id).slice(0, OWN_PACE_MAX), mode: 'own_pace' })} className="t-subhead h-9 rounded-full bg-[#14161c] px-4 font-bold text-white disabled:opacity-50">
                  Practise all {qs.length}
                </button>
              </div>
              <ul className="overflow-hidden rounded-card border border-line bg-surface">
                {qs.map((q, i) => (
                  <li key={q.id} className={i ? 'border-t border-line' : ''}>
                    <button type="button" disabled={busy} onClick={() => begin({ subject: s, question_ids: [q.id], mode: 'own_pace' })} className="flex w-full flex-col gap-1 p-4 text-left hover:bg-surface-2">
                      <span className="t-caption font-semibold text-ink-3">
                        {q.skill}
                        {q.difficulty && ` · ${q.difficulty}`}
                      </span>
                      <span className="t-subhead line-clamp-2 text-ink">{q.preview}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      {dialog}
    </div>
  );
}

const MATH_DOMAINS = ['Algebra', 'Advanced Math', 'Problem-Solving and Data Analysis', 'Geometry and Trigonometry'];
const ENGLISH_DOMAINS = ['Information and Ideas', 'Craft and Structure', 'Expression of Ideas', 'Standard English Conventions'];

// --- History.

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function PracticeHistory() {
  useTitle('Practice history');
  const sets = usePracticeSets();
  const discard = useDiscardPractice();
  const list = sets.data?.sets ?? [];
  return (
    <div className="mx-auto w-full max-w-[860px]">
      <Back />
      <h1 className="text-[30px] font-semibold leading-9 tracking-[-0.02em] text-title">Practice history</h1>
      <p className="t-subhead mt-1 text-ink-2">Every set you started: review the finished ones, continue or discard the open one.</p>
      <div className="mt-5">
        {sets.isPending ? (
          <Skeleton height={240} radius={16} />
        ) : sets.isError ? (
          <ErrorState title="Couldn’t load your sets" message={describeError(sets.error)} onRetry={() => void sets.refetch()} retrying={sets.isFetching} />
        ) : list.length === 0 ? (
          <EmptyState icon={History} title="No practice yet" message="Open a subject, choose topics and start." />
        ) : (
          <ul className="overflow-hidden rounded-card border border-line bg-surface">
            {list.map((s, i) => {
              const day = new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
              const tone = s.percent == null ? '' : s.percent >= 85 ? 'bg-good-tint text-good' : s.percent >= 60 ? 'bg-watch-tint text-watch' : 'bg-bad-tint text-bad';
              return (
                <li key={s.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${i ? 'border-t border-line' : ''}`}>
                  <span className="min-w-0 flex-1">
                    <span className="t-subhead block truncate font-semibold text-ink">{s.practice.title}</span>
                    <span className="t-footnote text-ink-3">
                      {day} · {s.practice.mode === 'own_pace' ? 'own pace' : 'rush'} · {s.questions} {s.questions === 1 ? 'question' : 'questions'}
                      {s.practice.seconds_per_question ? ` · ${clock(s.practice.seconds_per_question)} each` : ''}
                    </span>
                  </span>
                  {s.percent != null ? (
                    <>
                      <span className={`t-subhead tabular rounded-full px-2.5 py-0.5 font-bold ${tone}`}>
                        {s.correct}/{s.total}
                      </span>
                      <Link to={`/assessments/${s.id}`} className="t-subhead font-semibold text-accent hover:underline">
                        Review
                      </Link>
                    </>
                  ) : (
                    <>
                      <button type="button" disabled={discard.isPending} onClick={() => discard.mutate(s.id)} className="t-footnote font-semibold text-ink-2 hover:text-bad">
                        Discard
                      </button>
                      <Link to={`/assessments/${s.id}`} className="lift t-subhead inline-flex h-9 items-center rounded-control bg-primary px-3 font-bold text-on-primary">
                        Continue
                      </Link>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function OpenSetDialog({ open, onClose, onDiscarded }: { open: Assessment; onClose: () => void; onDiscarded: () => void }) {
  const discard = useDiscardPractice();
  const answered = Object.values(open.answers).filter((v) => v != null && v !== '').length;
  return (
    <Modal
      title="You have a set in progress"
      subtitle={`${open.title} · ${answered} of ${open.questions.length} answered`}
      onClose={onClose}
      width={460}
      footer={
        <>
          <Action variant="outline" disabled={discard.isPending} onClick={() => discard.mutate(open.id, { onSuccess: onDiscarded })}>
            Discard it, start the new one
          </Action>
          <Link to={`/assessments/${open.id}`} className="lift inline-flex h-10 items-center justify-center rounded-control bg-primary px-4 text-[14px] font-bold text-on-primary">
            Continue it
          </Link>
        </>
      }>
      <p className="t-body text-ink-2">One practice set at a time: finish this one, or discard it to start the new one. What you answered stays in your analytics.</p>
    </Modal>
  );
}
