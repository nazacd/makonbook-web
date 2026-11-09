import { ArrowLeft, Check, Clock, Lock, LockOpen, Pencil, Trash2, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { KIND, useAssignment, useAssignmentResults, useDeleteAssignment, useStudentWork, useUpdateAssignment, type AssignmentDetail as Detail, type AssignmentResults, type QuestionStats, type StudentResult } from '@/api/assignments';
import { ApiError } from '@/api/client';
import { describeError } from '@/api/errors';
import { Avatar } from '@/components/Avatar';
import { dueLong, dueRelative, fromLocalInput, KIND_COLOR, toLocalInput } from '@/components/assignments/format';
import { QuestionTags, QuestionView, useRichImages, type RichImages } from '@/components/assignments/QuestionView';
import { STATUS_PILL } from '@/components/assignments/TeacherAssignmentRow';
import { Notice } from '@/components/Notice';
import { clock, REF, SECTION_LABEL } from '@/components/practice/results/format';
import { SolidPill, ToneBar } from '@/components/practice/cards/TestCard';
import { EmptyState, Skeleton } from '@/components/States';
import { Modal, Segmented } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { useNow } from '@/lib/clock';
import { normalCase, parseClassName, teacherTitle } from '@/lib/groups';
import { testName } from '@/lib/practice/run';
import { useTitle } from '@/lib/title';
import { KIND_ICON } from '@/screens/StudentAssignments';

// "/assignments/:id": how the group did. The counts at the top, then the
// students (each one's result, opening their work), the questions (share
// right, which answers were picked, time) and the weakest skills. The
// teacher can change the dates, close it or reopen it, and delete it while
// nobody has started.

type Tab = 'students' | 'questions' | 'skills';
const pct = (n: number, of: number) => (of ? Math.round((100 * n) / of) : 0);

export function AssignmentDetail() {
  const { id = '' } = useParams();
  const detail = useAssignment(id);
  const results = useAssignmentResults(id);
  const now = useNow();
  const [tab, setTab] = useState<Tab>('students');
  const [editing, setEditing] = useState(false);
  const [work, setWork] = useState<StudentResult | null>(null);
  const a = results.data?.assignment ?? detail.data;
  useTitle(a ? testName(a.title) : 'Assignment');
  const img = useRichImages(detail.data?.images);

  if (detail.isPending) return <PageSkeleton />;
  if (detail.isError)
    return (
      <div className="mx-auto max-w-xl">
        <Notice tone="error" title="Couldn’t open this assignment" message={describeError(detail.error)} />
        <Link to="/assignments" className="t-subhead mt-3 inline-block font-bold text-accent">
          Back to assignments
        </Link>
      </div>
    );
  const d = detail.data;
  const I = KIND_ICON[d.kind];
  const s = (a ?? d).summary;
  const pill = STATUS_PILL[(a ?? d).status];
  const r = results.data;

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <Link to="/assignments" className="t-subhead mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> Assignments
      </Link>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-[12px]" style={{ color: KIND_COLOR[d.kind], background: `color-mix(in srgb, ${KIND_COLOR[d.kind]} 14%, transparent)` }}>
            <I size={21} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.02em] text-title">{testName((a ?? d).title)}</h1>
              <SolidPill color={pill.color}>{pill.text}</SolidPill>
            </div>
            <p className="t-subhead mt-1 text-ink-2">
              {KIND[d.kind].label} · <Link to={`/groups/${d.group_id}`} className="font-semibold text-accent hover:underline">{teacherTitle(parseClassName(d.group_name))}</Link> · due {dueLong((a ?? d).due_at)} ({dueRelative((a ?? d).due_at, now)})
            </p>
            {d.lesson && <p className="t-footnote mt-0.5 text-ink-3">{d.lesson.unit_title} · {d.lesson.title}</p>}
             {d.test && <p className="t-footnote mt-0.5 text-ink-3">{testName(d.test.title)} · {d.test.sections.map((x) => SECTION_LABEL[x]).join(' + ')}</p>}
            {(a ?? d).instructions && <p className="t-footnote mt-2 max-w-2xl whitespace-pre-line text-ink-2">{(a ?? d).instructions}</p>}
          </div>
        </div>
        <Actions d={d} hasWork={s.done + s.in_progress > 0} onEdit={() => setEditing(true)} />
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Tile label="Done" value={`${s.done}/${s.students}`} bar={s.students ? s.done / s.students : 0} color={KIND_COLOR[d.kind]} />
        <Tile label="Late" value={String(s.late)} tone={s.late ? 'text-bad' : undefined} />
        <Tile label="In progress" value={String(s.in_progress)} />
        <Tile label="Average" value={d.kind === 'exam' ? (s.average_score != null ? String(Math.round(s.average_score)) : '—') : s.average_percent != null ? `${Math.round(s.average_percent)}%` : '—'} />
      </div>

      <div className="mb-4">
        <Segmented
          label="Results by"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'students', label: 'Students', count: r?.students.length },
            { value: 'questions', label: 'Questions', count: r?.questions.length },
            { value: 'skills', label: 'Skills' },
          ]}
        />
      </div>

      {results.isPending ? (
        <Skeleton height={300} radius={16} />
      ) : results.isError ? (
        <Notice tone="error" title="Couldn’t load the results" message={describeError(results.error)} />
      ) : tab === 'students' ? (
        <Students r={results.data} onOpen={setWork} now={now} />
      ) : tab === 'questions' ? (
        <Questions r={results.data} d={d} img={img} />
      ) : (
        <Skills r={results.data} />
      )}

      {editing && <EditModal d={a ? { ...d, ...a } : d} onClose={() => setEditing(false)} />}
      {work && <WorkModal assignment={d} student={work} img={img} onClose={() => setWork(null)} />}
    </div>
  );
}

function Tile({ label, value, bar, color, tone }: { label: string; value: string; bar?: number; color?: string; tone?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="t-micro text-ink-2">{label}</p>
      <p className={`t-number mt-1 text-[28px] leading-8 ${tone ?? 'text-ink'}`}>{value}</p>
      {bar != null && <ToneBar className="mt-2" value={bar} color={color!} />}
    </div>
  );
}

function Actions({ d, hasWork, onEdit }: { d: Detail; hasWork: boolean; onEdit: () => void }) {
  const navigate = useNavigate();
  const update = useUpdateAssignment(d.id);
  const remove = useDeleteAssignment();
  const closed = !!d.closed_at;
  const toggle = () =>
    update.mutate({ title: d.title, instructions: d.instructions, opens_at: d.opens_at, due_at: d.due_at, closed: !closed });
  const del = () =>
    confirm({
      title: `Delete “${d.title}”?`,
      message: 'Nobody has started it. Its notifications go too.',
      onConfirm: () => remove.mutate(d.id, { onSuccess: () => void navigate('/assignments', { replace: true }) }),
    });
  const err = update.error ?? remove.error;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onEdit} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-bold text-ink hover:bg-surface-2">
          <Pencil size={15} aria-hidden="true" /> Edit
        </button>
        <button type="button" onClick={toggle} disabled={update.isPending} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-bold text-ink hover:bg-surface-2 disabled:opacity-60">
          {closed ? <LockOpen size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />} {closed ? 'Reopen' : 'Close'}
        </button>
        {!hasWork && (
          <button type="button" onClick={del} disabled={remove.isPending} aria-label="Delete" title="Delete" className="inline-flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface text-bad hover:bg-bad-tint disabled:opacity-60">
            <Trash2 size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      {err && <p className="t-footnote max-w-xs text-right text-bad">{err instanceof ApiError && err.code === 'has_work' ? 'A student has started it: close it instead.' : describeError(err)}</p>}
    </div>
  );
}

function standingText(st: StudentResult, exam: boolean): { score: string; detail: string } {
  if (st.status === 'new') return { score: '—', detail: 'Not started' };
  if (st.status === 'in_progress' && !st.finished_at) return { score: '—', detail: 'Working on it' };
  if (exam) return { score: String(st.total_score ?? '—'), detail: Object.entries(st.scores ?? {}).map(([k, v]) => `${k === 'math' ? 'Math' : 'R&W'} ${v.score}`).join(' · ') };
  return { score: `${st.percent}%`, detail: `${st.correct} of ${st.total} right` };
}

function Students({ r, onOpen, now }: { r: AssignmentResults; onOpen: (s: StudentResult) => void; now: number }) {
  const exam = r.assignment.kind === 'exam';
  if (r.students.length === 0) return <EmptyState icon={Users} title="No students in this group yet" />;
  const order = { done: 0, in_progress: 1, new: 2 } as const;
  const list = [...r.students].sort((a, b) => order[a.status] - order[b.status] || a.last_name.localeCompare(b.last_name));
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="hidden grid-cols-[minmax(0,2fr)_110px_90px_minmax(0,1.3fr)_90px] gap-3 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-white md:grid" style={{ background: REF.slate }}>
        <span>Student</span>
        <span>Status</span>
        <span>Score</span>
        <span>Finished</span>
        <span className="text-right">Work</span>
      </div>
      <ul className="divide-y divide-line">
        {list.map((st) => {
          const t = standingText(st, exam);
          const done = !!st.finished_at;
          const pill = done ? (st.late ? { text: 'Late', color: REF.deadline } : { text: 'Done', color: REF.finished }) : st.status === 'in_progress' ? { text: 'Working', color: 'var(--color-primary)' } : { text: 'Not started', color: REF.omitted };
          const name = normalCase(`${st.first_name} ${st.last_name}`);
          return (
            <li key={st.client_id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:grid-cols-[minmax(0,2fr)_110px_90px_minmax(0,1.3fr)_90px]">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar kind="student" firstName={st.first_name} lastName={st.last_name} id={st.client_id} size={34} />
                <span className="min-w-0">
                  <span className="t-subhead block truncate font-semibold text-ink">{name}</span>
                  <span className="t-caption block font-normal text-ink-3 md:hidden">
                    {pill.text === t.detail ? pill.text : `${pill.text} · ${t.detail}`}
                  </span>
                </span>
              </span>
              <span className="hidden md:block">
                <SolidPill color={pill.color}>{pill.text}</SolidPill>
              </span>
              <span className="text-right md:text-left">
                <span className={`t-headline tabular ${!exam && st.passed === false ? 'text-bad' : 'text-ink'}`}>{t.score}</span>
                {st.tries > 1 && <span className="t-caption block font-normal text-ink-3">best {exam ? st.best : `${st.best}%`} · {st.tries} tries</span>}
              </span>
              <span className="t-footnote hidden text-ink-2 md:block">
                {done ? `${dueRelative(st.finished_at!, now)} · ${t.detail}` : t.detail}
              </span>
              <span className="col-span-2 text-right md:col-span-1">
                {done && (
                  <button type="button" onClick={() => onOpen(st)} className="t-footnote inline-flex h-8 items-center rounded-[8px] border border-line px-3 font-semibold text-ink hover:bg-surface-2">
                    Review
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const LETTERS = ['A', 'B', 'C', 'D'];

function Questions({ r, d, img }: { r: AssignmentResults; d: Detail; img: RichImages }) {
  const [open, setOpen] = useState<string | null>(null);
  if (r.questions.length === 0) return <EmptyState icon={Users} title="No answers yet" message="Per-question numbers appear once students finish." />;
  const byId = new Map(d.items.map((q) => [q.id, q]));
  return (
    <ol className="flex flex-col gap-2.5">
      {r.questions.map((q) => {
        const share = q.answered ? q.correct / q.answered : null;
        const item = byId.get(q.question_id);
        const isOpen = open === q.question_id;
        return (
          <li key={`${q.question_id}-${q.position}`} className="rounded-card border border-line bg-surface">
            <button type="button" onClick={() => item && setOpen(isOpen ? null : q.question_id)} aria-expanded={item ? isOpen : undefined} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-3.5 text-left">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-ink text-[13px] font-bold text-surface tabular">{q.position}</span>
              <span className="min-w-0 flex-1 basis-48">
                <QuestionTags q={{ skill: q.skill, difficulty: q.difficulty, type: item?.type ?? 'mcq' }} />
                {q.module != null && <span className="t-caption font-normal text-ink-3">{SECTION_LABEL[q.subject]} · Module {q.module}</span>}
              </span>
              <span className="flex w-40 flex-col gap-1">
                <span className="flex justify-between text-[12.5px]">
                  <span className={`font-bold tabular ${share == null ? 'text-ink-3' : share >= 0.7 ? 'text-good' : share >= 0.4 ? 'text-watch' : 'text-bad'}`}>{share == null ? '—' : `${Math.round(share * 100)}% right`}</span>
                  <span className="text-ink-3 tabular">
                    {q.correct}/{q.answered}
                  </span>
                </span>
                <ToneBar value={share ?? 0} color={share == null ? REF.omitted : share >= 0.7 ? REF.finished : share >= 0.4 ? REF.medium : REF.deadline} />
              </span>
              <Distribution q={q} correct={item?.correct ?? null} />
              <span className="t-caption flex w-14 items-center gap-1 font-medium text-ink-2 tabular" title="Average time">
                <Clock size={12} aria-hidden="true" /> {q.avg_seconds != null ? clock(q.avg_seconds) : '—'}
              </span>
            </button>
            {isOpen && item && (
              <div className="border-t border-line p-4">
                <QuestionView q={item} img={img} side={(l) => <span className="t-caption shrink-0 font-semibold text-ink-3 tabular">{q.answers[l] ?? 0}</span>} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Distribution({ q, correct }: { q: QuestionStats; correct: string | null }) {
  const keys = 'A' in q.answers || 'B' in q.answers ? [...LETTERS, 'blank'] : ['correct', 'wrong', 'blank'];
  return (
    <span className="flex gap-1" aria-label="Answers given">
      {keys.map((k) => {
        const n = q.answers[k] ?? 0;
        const right = k === correct || k === 'correct';
        return (
          <span key={k} title={`${k}: ${n}`} className={`flex h-7 min-w-9 items-center justify-center gap-1 rounded-[7px] border px-1.5 text-[11.5px] font-bold tabular ${right ? 'border-good/50 bg-good-tint text-good' : n ? 'border-line bg-surface-2 text-ink' : 'border-line text-ink-3'}`}>
            {k === 'blank' ? '–' : k === 'correct' ? <Check size={12} aria-hidden="true" /> : k === 'wrong' ? <X size={12} aria-hidden="true" /> : k}
            <span>{n}</span>
          </span>
        );
      })}
    </span>
  );
}

function Skills({ r }: { r: AssignmentResults }) {
  if (r.skills.length === 0) return <EmptyState icon={Users} title="No answers yet" message="The weakest skills show once students finish." />;
  return (
    <ul className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4">
      {r.skills.map((s) => (
        <li key={s.skill} className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="t-subhead min-w-0 flex-1 basis-56 font-semibold text-ink">{s.skill}</span>
          <span className="w-56">
            <ToneBar value={s.total ? s.wrong / s.total : 0} color={REF.deadline} />
          </span>
          <span className="t-footnote w-36 text-right text-ink-2 tabular">
            {s.wrong} wrong of {s.total} · {pct(s.wrong, s.total)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function EditModal({ d, onClose }: { d: Detail; onClose: () => void }) {
  const update = useUpdateAssignment(d.id);
  const [title, setTitle] = useState(d.title);
  const [instructions, setInstructions] = useState(d.instructions);
  const [opensAt, setOpensAt] = useState(toLocalInput(d.opens_at));
  const [dueAt, setDueAt] = useState(toLocalInput(d.due_at));
  const fields = update.error instanceof ApiError ? update.error.fields : undefined;
  const save = () => update.mutate({ title: title.trim(), instructions: instructions.trim(), opens_at: fromLocalInput(opensAt), due_at: fromLocalInput(dueAt), closed: !!d.closed_at }, { onSuccess: onClose });
  return (
    <Modal
      title="Edit the assignment"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-[14px] font-bold text-ink-2 hover:text-ink">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={update.isPending || !title.trim()} className="lift h-10 rounded-full bg-primary px-5 text-[14px] font-bold text-on-primary hover:bg-primary-hover disabled:opacity-60">
            Save
          </button>
        </>
      }>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="t-caption text-ink-2">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="h-11 rounded-control border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="t-caption text-ink-2">Instructions</span>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={2000} rows={3} className="rounded-control border border-line bg-surface px-3 py-2.5 text-[15px] text-ink outline-none focus:border-accent" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="t-caption text-ink-2">Opens</span>
            <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} className="h-11 rounded-control border border-line bg-surface px-3 text-[15px] text-ink" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="t-caption text-ink-2">Deadline</span>
            <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="h-11 rounded-control border border-line bg-surface px-3 text-[15px] text-ink" />
          </label>
        </div>
        <p className="t-caption font-normal text-ink-3">Tashkent time. The questions can’t change once it is published.</p>
        {update.isError && <Notice tone="error" message={fields ? Object.values(fields).join(' ') : describeError(update.error)} />}
      </div>
    </Modal>
  );
}

function WorkModal({ assignment, student, img, onClose }: { assignment: Detail; student: StudentResult; img: RichImages; onClose: () => void }) {
  const work = useStudentWork(assignment.id, student.client_id);
  const name = normalCase(`${student.first_name} ${student.last_name}`);
  const t = standingText(student, assignment.kind === 'exam');
  const a = work.data?.assessment;
  const attempt = work.data?.attempt;
  const workImg = useRichImages(a?.images);
  const shown = a ? workImg : img;
  return (
    <Modal title={name} subtitle={`${testName(assignment.title)} · ${t.score} · ${t.detail}${student.late ? ' · late' : ''}`} onClose={onClose} width={760}>
      {work.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton height={140} radius={16} />
          <Skeleton height={140} radius={16} />
        </div>
      ) : work.isError ? (
        <Notice tone="error" message={describeError(work.error)} />
      ) : a ? (
        <ol className="flex flex-col gap-3">
          {a.questions.map((q, i) => {
            const item = a.result?.items.find((x) => x.question_id === q.id);
            const full = { ...q, correct: q.correct ?? null, accepted: q.accepted ?? null, explanation: q.explanation ?? item?.explanation ?? '' };
            return (
              <li key={q.id} className="rounded-card border border-line bg-surface p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2.5">
                    <span className={`flex size-7 items-center justify-center rounded-[8px] text-[13px] font-bold text-white tabular ${item?.correct ? 'bg-good' : 'bg-bad'}`}>{i + 1}</span>
                    <QuestionTags q={q} />
                    {item && item.given == null && <span className="rounded-full bg-surface-2 px-2 text-[11.5px] font-bold text-ink-2">Left blank</span>}
                  </span>
                  <span className="t-caption flex items-center gap-1 font-medium text-ink-2 tabular">
                    <Clock size={12} aria-hidden="true" /> {clock(a.times[q.id])}
                  </span>
                </div>
                <QuestionView q={full} img={shown} given={item?.given ?? null} compact />
              </li>
            );
          })}
        </ol>
      ) : attempt ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {attempt.sections.map((s) => (
              <span key={s} className="inline-flex h-[34px] items-center gap-1 rounded-[8px] border border-line bg-surface px-2.5 text-[14px] font-semibold text-ink">
                <span className="font-medium text-ink-2">{SECTION_LABEL[s]}</span> {attempt.scores[s]?.score} / 800 · {attempt.scores[s]?.raw} of {attempt.scores[s]?.questions} right
              </span>
            ))}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
            {attempt.answers.map((x) => (
              <span key={`${x.subject}-${x.module}-${x.position}`} className="flex flex-col items-center rounded-[8px] border border-line bg-surface-2 py-1.5" title={`${SECTION_LABEL[x.subject]} M${x.module} #${x.position}: ${x.answer ?? 'blank'}, ${clock(x.seconds)}`}>
                <span className="text-[10.5px] font-semibold text-ink-3">
                  {x.subject === 'math' ? 'M' : 'RW'}
                  {x.module}·{x.position}
                </span>
                <span className="text-[14px] font-bold text-ink">{x.answer ?? '–'}</span>
                <span className="text-[10.5px] text-ink-3 tabular">{clock(x.seconds)}</span>
              </span>
            ))}
          </div>
          <p className="t-caption font-normal text-ink-3">Each answer with its time. The question-by-question picture of the group is on the Questions tab.</p>
        </div>
      ) : (
        <EmptyState icon={Users} title="Nothing finished yet" />
      )}
    </Modal>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <Skeleton height={80} radius={16} />
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={92} radius={16} />
        ))}
      </div>
      <Skeleton height={300} radius={16} />
    </div>
  );
}
