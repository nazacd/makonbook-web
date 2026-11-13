import { Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, History, Play, Search, Timer, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { describeError } from '@/api/errors';
import { BANK_PAGE, isPracticeLimit, leftToday, PracticeOpenError, SUBJECTS, useBankQuestions, useDiscardPractice, usePracticeSets, useStartPractice, useTopics, type Difficulty, type PracticeRequest, type Subject } from '@/api/practiceSets';
import type { Assessment } from '@/api/roadmaps';
import { Notice } from '@/components/Notice';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { Action, Modal, PageHeader, Segmented } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { useTitle } from '@/lib/title';

type Tab = 'rush' | 'questions' | 'history';

// The question bank (spec 22.8): Rush builds a practice set from chosen
// topics (difficulty, how many, time a question), Questions browses the
// bank and opens any question on its own, History lists the sets. A set
// runs in AssessmentRun and is graded on submit.
export function QuestionBank() {
  useTitle('Question bank');
  const [params, setParams] = useSearchParams();
  const tab = (['questions', 'history'].includes(params.get('tab') ?? '') ? params.get('tab') : 'rush') as Tab;
  const subject = (params.get('subject') === 'english' ? 'english' : 'math') as Subject;
  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };
  const sets = usePracticeSets();
  const now = useNow();
  const left = sets.data ? leftToday(sets.data.sets, sets.data.free_questions_a_day, now) : null;
  const start = useStartPractice();
  const navigate = useNavigate();
  const [openSet, setOpenSet] = useState<{ open: Assessment; retry: PracticeRequest } | null>(null);
  const begin = (body: PracticeRequest) =>
    start.mutate(body, {
      onSuccess: (a) => void navigate(`/assessments/${a.id}`),
      onError: (e) => e instanceof PracticeOpenError && setOpenSet({ open: e.open, retry: body }),
    });

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <PageHeader
        icon={Zap}
        title="Question bank"
        subtitle="Build a practice set from the topics you choose, or open any question on its own."
        actions={
          <Segmented<Tab>
            label="Question bank"
            value={tab}
            onChange={(t) => set({ tab: t === 'rush' ? null : t })}
            options={[
              { value: 'rush', label: 'Rush' },
              { value: 'questions', label: 'Questions' },
              { value: 'history', label: 'History' },
            ]}
          />
        }
      />
      {left != null && (
        <p className="t-subhead mb-3 rounded-control bg-accent-tint px-3 py-2 text-ink">
          <span className="font-bold">{left}</span> of {sets.data!.free_questions_a_day} practice questions left today on a free account. Enrolled students practise without a limit.
        </p>
      )}
      {start.error && !(start.error instanceof PracticeOpenError) && (
        <div className="mb-3">
          <Notice tone="error" title={isPracticeLimit(start.error) ? 'That’s today’s questions' : 'Couldn’t start the set'} message={isPracticeLimit(start.error) ? 'Free accounts practise 40 questions a day. More tomorrow, or fewer questions now.' : describeError(start.error)} />
        </div>
      )}
      {tab !== 'history' && (
        <div className="mb-4">
          <Segmented<Subject> label="Subject" value={subject} onChange={(s) => set({ subject: s === 'math' ? null : s, skill: null })} options={SUBJECTS} />
        </div>
      )}
      {tab === 'rush' && <Rush subject={subject} left={left} busy={start.isPending} onStart={begin} />}
      {tab === 'questions' && <Questions subject={subject} params={params} set={set} busy={start.isPending} onOpen={(id) => begin({ subject, question_ids: [id] })} />}
      {tab === 'history' && <HistoryTab />}
      {openSet && <OpenSetDialog open={openSet.open} onClose={() => setOpenSet(null)} onDiscarded={() => (setOpenSet(null), begin(openSet.retry))} />}
    </div>
  );
}

// --- Rush: choose topics, then the set's settings.

function Rush({ subject, left, busy, onStart }: { subject: Subject; left: number | null; busy: boolean; onStart: (r: PracticeRequest) => void }) {
  const topics = useTopics();
  const [chosen, setChosen] = useState<Record<Subject, string[]>>({ math: [], english: [] });
  const [settings, setSettings] = useState(false);
  const domains = topics.data?.[subject] ?? [];
  const picked = chosen[subject];
  const toggle = (skill: string) => setChosen((c) => ({ ...c, [subject]: c[subject].includes(skill) ? c[subject].filter((s) => s !== skill) : [...c[subject], skill] }));
  const skills = domains.flatMap((d) => d.skills);
  const inSet = picked.length ? skills.filter((s) => picked.includes(s.skill)) : skills;
  const available = { easy: 0, medium: 0, hard: 0, total: 0 };
  for (const s of inSet) {
    available.easy += s.easy;
    available.medium += s.medium;
    available.hard += s.hard;
    available.total += s.total;
  }

  if (topics.isPending) return <Skeleton height={320} radius={16} />;
  if (topics.isError) return <ErrorState title="Couldn’t load the topics" message={describeError(topics.error)} onRetry={() => void topics.refetch()} retrying={topics.isFetching} />;

  return (
    <>
      <div className="flex flex-col gap-5">
        {domains.map((d) => {
          const all = d.skills.every((s) => picked.includes(s.skill));
          return (
            <section key={d.domain}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="t-headline text-ink">{d.domain}</h2>
                <button
                  type="button"
                  onClick={() => setChosen((c) => ({ ...c, [subject]: all ? c[subject].filter((s) => !d.skills.some((k) => k.skill === s)) : [...new Set([...c[subject], ...d.skills.filter((k) => k.total > 0).map((k) => k.skill)])] }))}
                  className="t-footnote font-semibold text-accent hover:underline">
                  {all ? 'Clear' : 'Choose all'}
                </button>
              </div>
              <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {d.skills.map((s) => {
                  const on = picked.includes(s.skill);
                  const empty = s.total === 0;
                  return (
                    <li key={s.skill}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        disabled={empty}
                        onClick={() => toggle(s.skill)}
                        className={`flex h-full w-full items-start gap-3 rounded-card border p-3.5 text-left transition-colors disabled:opacity-45 ${on ? 'border-primary bg-accent-tint' : 'border-line bg-surface hover:border-primary/40'}`}>
                        <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 ${on ? 'border-primary bg-primary text-on-primary' : 'border-line-strong'}`}>{on && <Check size={13} strokeWidth={3.5} aria-hidden="true" />}</span>
                        <span className="min-w-0 flex-1">
                          <span className={`t-subhead block ${on ? 'font-bold text-ink' : 'font-semibold text-ink'}`}>{s.skill}</span>
                          <span className="t-footnote text-ink-3">{empty ? 'No questions yet' : `${s.total} ${s.total === 1 ? 'question' : 'questions'}`}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="sticky bottom-[calc(73px+env(safe-area-inset-bottom))] z-20 mt-5 md:bottom-4">
        <div className="mx-auto flex max-w-[760px] items-center gap-3 rounded-panel border border-line bg-surface p-3 shadow-[0_12px_32px_-8px_rgba(16,19,26,0.25)]">
          <p className="t-subhead min-w-0 flex-1 text-ink">
            <span className="font-bold">{picked.length ? `${picked.length} ${picked.length === 1 ? 'topic' : 'topics'}` : 'The whole subject'}</span>
            <span className="text-ink-2"> · {available.total.toLocaleString('en-US')} questions</span>
          </p>
          {picked.length > 0 && (
            <button type="button" onClick={() => setChosen((c) => ({ ...c, [subject]: [] }))} className="t-footnote shrink-0 font-semibold text-ink-2 hover:text-ink">
              Clear
            </button>
          )}
          <button type="button" disabled={available.total === 0 || left === 0} onClick={() => setSettings(true)} className="lift t-headline inline-flex h-11 shrink-0 items-center gap-2 rounded-control bg-primary px-5 text-on-primary disabled:opacity-45">
            <Play size={16} fill="currentColor" aria-hidden="true" /> Start
          </button>
        </div>
      </div>
      {settings && <SetSettings subject={subject} skills={picked} available={available} left={left} busy={busy} onClose={() => setSettings(false)} onStart={onStart} />}
    </>
  );
}

const DIFFICULTIES: { value: Difficulty | 'mixed'; label: string; note: string }[] = [
  { value: 'mixed', label: 'Mixed', note: 'A third easy, a third hard' },
  { value: 'easy', label: 'Easy', note: 'Warm up, build speed' },
  { value: 'medium', label: 'Medium', note: 'Most of the SAT' },
  { value: 'hard', label: 'Hard', note: 'For a 700+' },
];

/** The SAT's own pace: 64 min for 54 Reading and Writing questions, 70 for 44 Math ones. */
const SAT_PACE: Record<Subject, number> = { english: 71, math: 95 };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function SetSettings({ subject, skills, available, left, busy, onClose, onStart }: { subject: Subject; skills: string[]; available: Record<Difficulty | 'total', number>; left: number | null; busy: boolean; onClose: () => void; onStart: (r: PracticeRequest) => void }) {
  const [difficulty, setDifficulty] = useState<Difficulty | 'mixed'>('mixed');
  const max = Math.min(50, difficulty === 'mixed' ? available.total : available[difficulty] || available.total, left ?? 50);
  const [count, setCount] = useState(Math.min(10, max));
  const [secs, setSecs] = useState(SAT_PACE[subject]);
  const n = Math.max(1, Math.min(count, max));
  const PACES = [
    { value: 0, label: 'Untimed' },
    { value: SAT_PACE[subject], label: `SAT pace · ${clock(SAT_PACE[subject])}` },
    { value: 120, label: '2:00' },
  ];
  return (
    <Modal
      title="Your set"
      subtitle={skills.length ? skills.join(' · ') : `Every ${subject === 'math' ? 'Math' : 'Reading and Writing'} topic`}
      onClose={onClose}
      width={520}
      footer={
        <>
          <Action variant="outline" onClick={onClose}>
            Cancel
          </Action>
          <Action disabled={busy || max < 1} onClick={() => onStart({ subject, skills, difficulty, count: n, seconds_per_question: secs })}>
            <Zap size={15} aria-hidden="true" /> {busy ? 'Preparing…' : `Start ${n} ${n === 1 ? 'question' : 'questions'}`}
          </Action>
        </>
      }>
      <h3 className="t-micro mb-2 text-ink-3">Difficulty</h3>
      <div role="radiogroup" aria-label="Difficulty" className="grid grid-cols-2 gap-2">
        {DIFFICULTIES.map((d) => {
          const sel = difficulty === d.value;
          const have = d.value === 'mixed' ? available.total : available[d.value];
          return (
            <button key={d.value} type="button" role="radio" aria-checked={sel} onClick={() => setDifficulty(d.value)} className={`rounded-card border p-3 text-left ${sel ? 'border-primary bg-accent-tint' : 'border-line hover:border-primary/40'}`}>
              <span className="t-subhead block font-bold text-ink">{d.label}</span>
              <span className="t-footnote block text-ink-2">{d.note}</span>
              <span className="t-caption text-ink-3">{have} available</span>
            </button>
          );
        })}
      </div>
      <h3 className="t-micro mb-2 mt-5 text-ink-3">Questions</h3>
      <div className="flex flex-wrap gap-2">
        {[5, 10, 20, 30].map((c) => (
          <button key={c} type="button" disabled={c > max && c !== 5} aria-pressed={n === c} onClick={() => setCount(c)} className={`t-subhead h-10 min-w-14 rounded-control border px-3 font-semibold disabled:opacity-40 ${n === c ? 'border-primary bg-accent-tint text-accent' : 'border-line text-ink hover:border-line-strong'}`}>
            {c}
          </button>
        ))}
        <label className="t-subhead flex h-10 items-center gap-2 rounded-control border border-line px-3 text-ink-2">
          Other
          <input type="number" min={1} max={max} value={n} onChange={(e) => setCount(Number(e.target.value) || 1)} className="w-14 bg-transparent font-semibold text-ink outline-none" aria-label="Number of questions" />
        </label>
      </div>
      {left != null && <p className="t-caption mt-1.5 text-ink-3">Up to {left} more today on a free account.</p>}
      <h3 className="t-micro mb-2 mt-5 text-ink-3">Time a question</h3>
      <div role="radiogroup" aria-label="Time a question" className="flex flex-wrap gap-2">
        {PACES.map((p) => (
          <button key={p.value} type="button" role="radio" aria-checked={secs === p.value} onClick={() => setSecs(p.value)} className={`t-subhead inline-flex h-10 items-center gap-1.5 rounded-control border px-3 font-semibold ${secs === p.value ? 'border-primary bg-accent-tint text-accent' : 'border-line text-ink hover:border-line-strong'}`}>
            {p.value ? <Timer size={15} aria-hidden="true" /> : <Clock size={15} aria-hidden="true" />} {p.label}
          </button>
        ))}
      </div>
      {secs > 0 && <p className="t-footnote mt-2 text-ink-2">{clock(secs * n)} for the whole set. The clock keeps running if you leave, and the set is handed in when it ends.</p>}
    </Modal>
  );
}

// --- Questions: browse the bank and open one.

const DIFF_PILL: Record<Difficulty, string> = { easy: 'bg-good-tint text-good', medium: 'bg-watch-tint text-watch', hard: 'bg-bad-tint text-bad' };

function Questions({ subject, params, set, busy, onOpen }: { subject: Subject; params: URLSearchParams; set: (c: Record<string, string | null>) => void; busy: boolean; onOpen: (id: string) => void }) {
  const topics = useTopics();
  const skill = params.get('skill') ?? '';
  const difficulty = (params.get('difficulty') ?? '') as Difficulty | '';
  const [text, setText] = useState(params.get('q') ?? '');
  const q = params.get('q') ?? '';
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);
  const filter = useMemo(() => ({ subject, skill: skill || undefined, difficulty: difficulty || undefined, q: q || undefined }), [subject, skill, difficulty, q]);
  const list = useBankQuestions(filter, page);
  const done = new Set(list.data?.done ?? []);
  const total = list.data?.total ?? 0;
  const field = 't-subhead h-10 rounded-control border border-line bg-surface pl-3 text-ink';

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <form
          className="relative min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: text.trim() || null, page: null });
          }}>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input type="search" value={text} onChange={(e) => (setText(e.target.value), e.target.value === '' && set({ q: null, page: null }))} placeholder="Search the questions’ text" aria-label="Search questions" className="t-body h-10 w-full rounded-control border border-line bg-surface pl-9 pr-3 text-ink outline-none focus:border-primary" />
        </form>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <select value={skill} onChange={(e) => set({ skill: e.target.value || null, page: null })} aria-label="Topic" className={`${field} min-w-0 sm:w-56`}>
            <option value="">All topics</option>
            {(topics.data?.[subject] ?? []).map((d) => (
              <optgroup key={d.domain} label={d.domain}>
                {d.skills.map((s) => (
                  <option key={s.skill} value={s.skill}>
                    {s.skill}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <select value={difficulty} onChange={(e) => set({ difficulty: e.target.value || null, page: null })} aria-label="Difficulty" className={`${field} sm:w-40`}>
            <option value="">Any difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>
      {list.isPending ? (
        <div className="grid gap-2.5 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={96} radius={16} />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState title="Couldn’t load the questions" message={describeError(list.error)} onRetry={() => void list.refetch()} retrying={list.isFetching} />
      ) : total === 0 ? (
        <EmptyState icon={Search} title="No question matches" message="Try another topic, difficulty or words." />
      ) : (
        <>
          <p className="t-footnote mb-2 text-ink-2">
            {total.toLocaleString('en-US')} {total === 1 ? 'question' : 'questions'} · open one to answer it on its own, with its explanation after
          </p>
          <ul className="grid gap-2.5 md:grid-cols-2">
            {list.data!.questions.map((x, k) => (
              <li key={x.id}>
                <button type="button" disabled={busy} onClick={() => onOpen(x.id)} className="flex h-full w-full flex-col gap-2 rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-primary/40 disabled:opacity-60">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="t-caption tabular font-bold text-ink-3">#{page * BANK_PAGE + k + 1}</span>
                    {x.difficulty && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${DIFF_PILL[x.difficulty]}`}>{x.difficulty[0]!.toUpperCase() + x.difficulty.slice(1)}</span>}
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">{x.skill}</span>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">{x.type === 'mcq' ? 'Choice' : 'Grid-in'}</span>
                    {done.has(x.id) && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-good">
                        <CheckCircle2 size={14} aria-hidden="true" /> Done
                      </span>
                    )}
                  </span>
                  <span className="t-subhead line-clamp-2 text-ink">{x.preview}</span>
                </button>
              </li>
            ))}
          </ul>
          {total > BANK_PAGE && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button type="button" disabled={page === 0} onClick={() => set({ page: page - 1 ? String(page - 1) : null })} aria-label="Previous page" className="flex size-10 items-center justify-center rounded-control border border-line bg-surface text-ink disabled:opacity-40">
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <span className="t-subhead tabular text-ink-2">
                {page * BANK_PAGE + 1}–{Math.min(total, (page + 1) * BANK_PAGE)} of {total.toLocaleString('en-US')}
              </span>
              <button type="button" disabled={(page + 1) * BANK_PAGE >= total} onClick={() => set({ page: String(page + 1) })} aria-label="Next page" className="flex size-10 items-center justify-center rounded-control border border-line bg-surface text-ink disabled:opacity-40">
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

// --- History.

function HistoryTab() {
  const sets = usePracticeSets();
  const discard = useDiscardPractice();
  if (sets.isPending) return <Skeleton height={240} radius={16} />;
  if (sets.isError) return <ErrorState title="Couldn’t load your sets" message={describeError(sets.error)} onRetry={() => void sets.refetch()} retrying={sets.isFetching} />;
  const list = sets.data.sets;
  if (list.length === 0) return <EmptyState icon={History} title="No practice sets yet" message="Choose a few topics in Rush and start your first set." />;
  return (
    <ul className="overflow-hidden rounded-card border border-line bg-surface">
      {list.map((s, i) => {
        const day = new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const tone = s.percent == null ? '' : s.percent >= 80 ? 'bg-good-tint text-good' : s.percent >= 50 ? 'bg-watch-tint text-watch' : 'bg-bad-tint text-bad';
        return (
          <li key={s.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${i ? 'border-t border-line' : ''}`}>
            <span className="min-w-0 flex-1">
              <span className="t-subhead block truncate font-semibold text-ink">{s.practice.title}</span>
              <span className="t-footnote text-ink-3">
                {day} · {s.questions} {s.questions === 1 ? 'question' : 'questions'} · {s.practice.difficulty}
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
      <p className="t-body text-ink-2">One practice set at a time: finish this one, or discard it to start the new one.</p>
    </Modal>
  );
}
