import { ArrowLeft, ArrowRight, BookOpenCheck, CalendarClock, Check, ClipboardCheck, Minus, Plus, RefreshCw, Replace, Shuffle, Trash2, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { drawQuestions, useCreateAssignment, useTeacherCurriculum, useTeacherTaxonomy, type AssignmentKind, type AssignmentQuestion, type CurriculumCourse, type DrawInput, type ImageLinks, type Mix } from '@/api/assignments';
import { ApiError } from '@/api/client';
import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import type { Group } from '@/api/types';
import { fromLocalInput, KIND_COLOR, toLocalInput } from '@/components/assignments/format';
import { QuestionPicker } from '@/components/assignments/QuestionPicker';
import { QuestionTags, QuestionView, useRichImages } from '@/components/assignments/QuestionView';
import { Spinner } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { SECTION_LABEL } from '@/components/practice/results/format';
import { Skeleton } from '@/components/States';
import { groupTitle } from '@/components/TeacherGroupRow';
import { Segmented } from '@/components/ui';
import { parseClassName } from '@/lib/groups';
import { useCatalog } from '@/lib/practice/hooks';
import { testName } from '@/lib/practice/run';
import type { Subject } from '@/lib/practice/types';
import { useTitle } from '@/lib/title';

// "/assignments/new": give a group work with a deadline, in four steps:
// 1. the group and the kind; 2. where the questions come from (a curriculum
// lesson, skills and a mix, or a mock test); 3. the questions themselves,
// drawn from the approved bank, to swap or remove one by one; 4. the title,
// instructions and dates. Every student of the group gets the same set and a
// notification.

type Source = 'curriculum' | 'custom';
type Step = 1 | 2 | 3 | 4;

const KINDS: { kind: AssignmentKind; label: string; text: string; icon: LucideIcon }[] = [
  { kind: 'homework', label: 'Homework', text: 'A practice set: from a lesson, or your own pick of skills.', icon: BookOpenCheck },
  { kind: 'level_check', label: 'Level check', text: 'A lesson’s check: passing it at 70% counts on their roadmap.', icon: ClipboardCheck },
  { kind: 'exam', label: 'Exam', text: 'A mock test, full or one section, timed like the SAT.', icon: CalendarClock },
];

/** The course a group's name and discipline point to, e.g. "math-pre-sat". */
function courseOf(g: Group | undefined): string | null {
  if (!g) return null;
  const n = parseClassName(g.name, g.discipline);
  if (!n.subject) return null;
  const level = n.level === 'presat' ? 'pre-sat' : (n.level ?? 'foundation');
  return `${n.subject === 'Math' ? 'math' : 'english'}-${level}`;
}

/** Three days from now at 18:00, school time. */
function defaultDue(now: number): string {
  const d = new Date(now + 3 * 86_400_000 + 5 * 3_600_000);
  d.setUTCHours(18, 0, 0, 0);
  return new Date(d.getTime() - 5 * 3_600_000).toISOString();
}

export function NewAssignment() {
  useTitle('New assignment');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groups = useMe().data?.groups ?? [];
  const curriculum = useTeacherCurriculum();
  const catalog = useCatalog();
  const create = useCreateAssignment();
  const [startedAt] = useState(() => Date.now());

  const [step, setStep] = useState<Step>(1);
  const [groupId, setGroupId] = useState<number | null>(() => Number(params.get('group')) || (groups.length === 1 ? groups[0]!.id : null));
  const group = groups.find((g) => g.id === groupId);
  const [kind, setKind] = useState<AssignmentKind>((params.get('kind') as AssignmentKind) || 'homework');
  const [source, setSource] = useState<Source>('curriculum');
  const [pickedCourse, setCourse] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [setIndex, setSetIndex] = useState(0);
  const [subject, setSubject] = useState<Subject>('math');
  const [skills, setSkills] = useState<string[]>([]);
  const [mix, setMix] = useState<Mix>({ easy: 4, medium: 4, hard: 2 });
  const [test, setTest] = useState<string | null>(null);
  const [sections, setSections] = useState<'full' | Subject>('full');
  const [items, setItems] = useState<AssignmentQuestion[]>([]);
  const [links, setLinks] = useState<ImageLinks>({});
  const [drawing, setDrawing] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [opensLater, setOpensLater] = useState(false);
  const [opensAt, setOpensAt] = useState(() => toLocalInput(new Date(startedAt).toISOString()));
  const [dueAt, setDueAt] = useState(() => toLocalInput(defaultDue(startedAt)));
  const img = useRichImages(links);

  // The course picked, else the group's own, else the first.
  const courses = curriculum.data ?? [];
  const groupCourse = courseOf(group);
  const course = pickedCourse ?? courses.find((x) => x.id === groupCourse)?.id ?? courses[0]?.id ?? null;
  const c = courses.find((x) => x.id === course);
  const lessons = c?.units.flatMap((u) => u.lessons.map((l) => ({ ...l, unit: u }))) ?? [];
  const lesson = lessons.find((l) => l.id === lessonId);
  const published = (catalog.data ?? []).filter((t) => t.version != null);
  const chosenTest = published.find((t) => t.code === test);
  const fromLesson = kind === 'level_check' || (kind === 'homework' && source === 'curriculum');
  const effectiveSubject: Subject = fromLesson ? (c?.subject ?? 'math') : subject;

  const ready2 = kind === 'exam' ? !!chosenTest : fromLesson ? !!lesson && (kind === 'level_check' || !!lesson.homework[setIndex]) : skills.length > 0 && mix.easy + mix.medium + mix.hard > 0;

  async function draw(ids?: string[]) {
    setDrawing(true);
    setDrawError(null);
    const body: DrawInput = ids
      ? { subject: effectiveSubject, question_ids: ids }
      : fromLesson
        ? { group_id: groupId ?? undefined, course: course!, lesson_id: lessonId!, ...(kind === 'homework' ? { homework_index: setIndex } : {}) }
        : { group_id: groupId ?? undefined, subject, skills, mix };
    try {
      const r = await drawQuestions(body);
      setItems(r.items);
      setLinks((x) => ({ ...x, ...r.images }));
    } catch (e) {
      setDrawError(e instanceof ApiError && e.code === 'no_questions' ? 'The bank has no approved questions for this yet. Pick other skills or another lesson.' : describeError(e));
    } finally {
      setDrawing(false);
    }
  }

  const defaultTitle = kind === 'exam' ? (chosenTest ? testName(chosenTest.title) : '') : kind === 'level_check' ? (lesson ? `${lesson.title} · Level check` : '') : source === 'curriculum' ? (lesson?.homework[setIndex]?.title ?? '') : `Homework: ${skills.slice(0, 2).join(', ')}${skills.length > 2 ? '…' : ''}`;

  const go = (to: Step) => {
    if (to === 3 && kind !== 'exam') void draw();
    if (to === 4 && !title) setTitle(defaultTitle);
    setStep(to);
    window.scrollTo(0, 0);
  };
  const next = () => go(step === 2 && kind === 'exam' ? 4 : ((step + 1) as Step));
  const back = () => setStep(step === 4 && kind === 'exam' ? 2 : ((step - 1) as Step));

  const fields = create.error instanceof ApiError ? create.error.fields : undefined;
  const publish = () => {
    if (!groupId) return;
    create.mutate(
      {
        group_id: groupId,
        kind,
        title: title.trim() || defaultTitle,
        instructions: instructions.trim(),
        ...(opensLater ? { opens_at: fromLocalInput(opensAt) } : {}),
        due_at: fromLocalInput(dueAt),
        ...(kind === 'exam'
          ? { test: test!, sections: sections === 'full' ? (['english', 'math'] as Subject[]).filter((s) => chosenTest![s] > 0) : [sections] }
          : {
              question_ids: items.map((q) => q.id),
              ...(fromLesson ? { course: course!, lesson_id: lessonId!, ...(kind === 'homework' ? { homework_index: setIndex } : {}) } : { subject, skills, mix }),
            }),
      },
      { onSuccess: (a) => void navigate(`/assignments/${a.id}`, { replace: true }) },
    );
  };

  const canContinue = step === 1 ? !!groupId : step === 2 ? ready2 : step === 3 ? items.length > 0 && !drawing : true;
  const dueBad = Date.parse(fromLocalInput(dueAt)) <= Date.parse(opensLater ? fromLocalInput(opensAt) : new Date(startedAt).toISOString());

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <Link to="/assignments" className="t-subhead mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> Assignments
      </Link>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.03em] text-title">New assignment</h1>
        <Steps step={step} skip3={kind === 'exam'} />
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-6">
          <Section title="Which group?">
            {groups.length === 0 ? (
              <Notice tone="info" message="Your groups appear once you teach one in HolliHop." />
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {groups.map((g) => (
                  <Option key={g.id} on={g.id === groupId} onClick={() => setGroupId(g.id)} title={groupTitle(g)} text={`${g.office} · ${g.schedule[0] ? `${g.schedule[0].begin_time}, ${g.schedule[0].weekdays.join(' ')}` : 'no schedule'}`} />
                ))}
              </div>
            )}
          </Section>
          <Section title="What kind?">
            <div className="grid gap-2.5 sm:grid-cols-3">
              {KINDS.map((k) => (
                <button key={k.kind} type="button" onClick={() => setKind(k.kind)} aria-pressed={kind === k.kind} className={`flex flex-col gap-2 rounded-card border p-4 text-left transition-colors ${kind === k.kind ? 'border-primary bg-accent-tint' : 'border-line bg-surface hover:border-line-strong'}`}>
                  <span className="flex size-10 items-center justify-center rounded-[11px]" style={{ color: KIND_COLOR[k.kind], background: `color-mix(in srgb, ${KIND_COLOR[k.kind]} 14%, transparent)` }}>
                    <k.icon size={19} aria-hidden="true" />
                  </span>
                  <span className={`t-headline ${kind === k.kind ? 'text-accent' : 'text-ink'}`}>{k.label}</span>
                  <span className="t-footnote text-ink-2">{k.text}</span>
                </button>
              ))}
            </div>
          </Section>
        </div>
      )}

      {step === 2 && kind === 'exam' && (
        <Section title="Which mock test?">
          {catalog.isPending ? (
            <Skeleton height={120} radius={16} />
          ) : (
            <div className="flex flex-col gap-4">
              <select value={test ?? ''} onChange={(e) => setTest(e.target.value || null)} aria-label="Mock test" className="h-11 rounded-control border border-line bg-surface px-3 text-[15px] text-ink">
                <option value="">Choose a test…</option>
                {published.map((t) => (
                  <option key={t.code} value={t.code}>
                    {testName(t.title)} · {t.questions} questions
                  </option>
                ))}
              </select>
              {chosenTest && (
                <div className="grid grid-cols-3 gap-2">
                  {(['full', 'english', 'math'] as const).map((s) => {
                    const off = s !== 'full' && chosenTest[s] === 0;
                    return (
                      <button key={s} type="button" disabled={off} onClick={() => setSections(s)} aria-pressed={sections === s} className={`flex flex-col gap-0.5 rounded-[10px] border px-3 py-2.5 text-left disabled:opacity-40 ${sections === s ? 'border-primary bg-accent-tint' : 'border-line bg-surface hover:border-line-strong'}`}>
                        <span className={`text-[14px] font-semibold ${sections === s ? 'text-accent' : 'text-ink'}`}>{s === 'full' ? 'Full test' : SECTION_LABEL[s]}</span>
                        <span className="text-[12px] text-ink-2 tabular">{s === 'full' ? chosenTest.questions : chosenTest[s]} questions</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="t-footnote text-ink-2">Students take it as the mock test itself. Their first attempt finished after it opens counts; retakes are practice.</p>
            </div>
          )}
        </Section>
      )}

      {step === 2 && kind !== 'exam' && (
        <div className="flex flex-col gap-5">
          {kind === 'homework' && (
            <Segmented
              label="Where the questions come from"
              value={source}
              onChange={setSource}
              options={[
                { value: 'curriculum', label: 'From a lesson' },
                { value: 'custom', label: 'Pick skills' },
              ]}
            />
          )}
          {fromLesson ? (
            <LessonPicker courses={courses} loading={curriculum.isPending} error={curriculum.error} course={course} setCourse={(x) => (setCourse(x), setLessonId(null))} lessonId={lessonId} setLessonId={(x) => (setLessonId(x), setSetIndex(0))} groupCourse={groupCourse} />
          ) : (
            <SkillPicker subject={subject} setSubject={(x) => (setSubject(x), setSkills([]))} skills={skills} setSkills={setSkills} mix={mix} setMix={setMix} />
          )}
          {fromLesson && lesson && kind === 'homework' && (
            <Section title="Which homework set?">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {lesson.homework.map((h) => (
                  <Option key={h.index} on={setIndex === h.index} onClick={() => setSetIndex(h.index)} title={h.title} text={`${h.questions} questions · ${h.difficulty} · ${h.skills.join(', ')}`} />
                ))}
              </div>
            </Section>
          )}
          {fromLesson && lesson && kind === 'level_check' && (
            <p className="t-subhead rounded-control border border-line bg-surface p-4 text-ink-2">
              {lesson.level_check.questions} questions: {lesson.level_check.mix.easy} easy, {lesson.level_check.mix.medium} medium, {lesson.level_check.mix.hard} hard, on {lesson.level_check.skills.join(', ')}. 70% passes, and a pass counts on the student’s roadmap.
            </p>
          )}
        </div>
      )}

      {step === 3 && (
        <Review items={items} drawing={drawing} error={drawError} img={img} subject={effectiveSubject} onRedraw={() => void draw()} onSet={(ids) => void draw(ids)} onRemove={(id) => setItems(items.filter((q) => q.id !== id))} />
      )}

      {step === 4 && (
        <div className="flex flex-col gap-5">
          <Section title="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={defaultTitle} aria-label="Title" aria-invalid={!!fields?.title} className="h-11 w-full rounded-control border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-accent" />
            {fields?.title && <p className="t-footnote mt-1 text-bad">{fields.title}</p>}
          </Section>
          <Section title="Instructions (optional)">
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={2000} rows={3} placeholder="Anything the students should know: pages to read first, how long to spend…" aria-label="Instructions" className="w-full rounded-control border border-line bg-surface px-3 py-2.5 text-[15px] text-ink outline-none focus:border-accent" />
          </Section>
          <div className="grid gap-5 sm:grid-cols-2">
            <Section title="Opens">
              <Segmented
                label="When it opens"
                value={opensLater ? 'later' : 'now'}
                onChange={(v) => setOpensLater(v === 'later')}
                options={[
                  { value: 'now', label: 'Now' },
                  { value: 'later', label: 'Later' },
                ]}
              />
              {opensLater && <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} aria-label="Opens at" className="mt-2.5 h-11 w-full rounded-control border border-line bg-surface px-3 text-[15px] text-ink" />}
              <p className="t-caption mt-1.5 font-normal text-ink-3">Students see it, and get a notification, once it opens.</p>
            </Section>
            <Section title="Deadline">
              <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} aria-label="Deadline" aria-invalid={dueBad || !!fields?.due_at} className="h-11 w-full rounded-control border border-line bg-surface px-3 text-[15px] text-ink aria-[invalid=true]:border-bad" />
              <p className={`t-caption mt-1.5 font-normal ${dueBad ? 'text-bad' : 'text-ink-3'}`}>{dueBad ? 'The deadline must be after it opens.' : 'Tashkent time. Work after it is still taken, marked late.'}</p>
            </Section>
          </div>
          <Summary group={group} kind={kind} title={title || defaultTitle} questions={kind === 'exam' ? (chosenTest ? (sections === 'full' ? chosenTest.questions : chosenTest[sections]) : 0) : items.length} />
          {create.isError && <Notice tone="error" title="Couldn’t publish it" message={fields ? Object.values(fields).join(' ') : describeError(create.error)} />}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
        {step > 1 ? (
          <button type="button" onClick={back} className="t-subhead inline-flex h-11 items-center gap-1 rounded-full px-3 font-semibold text-ink-2 hover:text-ink">
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
        ) : (
          <span />
        )}
        {step < 4 ? (
          <button type="button" onClick={next} disabled={!canContinue} className="lift inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-[15px] font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-default disabled:bg-line disabled:text-ink-3">
            Continue <ArrowRight size={17} aria-hidden="true" />
          </button>
        ) : (
          <button type="button" onClick={publish} disabled={create.isPending || dueBad} className="lift inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-[15px] font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60">
            {create.isPending ? <Spinner className="size-5" /> : <Check size={17} aria-hidden="true" />} Publish to the group
          </button>
        )}
      </div>
    </div>
  );
}

function Steps({ step, skip3 }: { step: Step; skip3: boolean }) {
  const all = (skip3 ? [1, 2, 4] : [1, 2, 3, 4]) as Step[];
  const labels: Record<Step, string> = { 1: 'Group', 2: 'Source', 3: 'Questions', 4: 'Details' };
  return (
    <ol className="flex items-center gap-1.5" aria-label="Steps">
      {all.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5" aria-current={s === step ? 'step' : undefined}>
          <span className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold ${s === step ? 'bg-primary text-on-primary' : s < step ? 'bg-accent-tint text-accent' : 'bg-surface-2 text-ink-3'}`}>
            {s < step ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : i + 1} <span className="hidden sm:inline">{labels[s]}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="t-micro mb-2.5 text-ink-2">{title}</h2>
      {children}
    </section>
  );
}

function Option({ on, onClick, title, text }: { on: boolean; onClick: () => void; title: string; text: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`flex items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors ${on ? 'border-primary bg-accent-tint' : 'border-line bg-surface hover:border-line-strong'}`}>
      <span className="min-w-0 flex-1">
        <span className={`t-headline block truncate ${on ? 'text-accent' : 'text-ink'}`}>{title}</span>
        <span className="t-footnote block truncate text-ink-2">{text}</span>
      </span>
      <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-primary bg-primary text-on-primary' : 'border-line-strong'}`}>{on && <Check size={12} strokeWidth={3} aria-hidden="true" />}</span>
    </button>
  );
}

function LessonPicker({ courses, loading, error, course, setCourse, lessonId, setLessonId, groupCourse }: { courses: CurriculumCourse[]; loading: boolean; error: unknown; course: string | null; setCourse: (c: string) => void; lessonId: string | null; setLessonId: (l: string) => void; groupCourse: string | null }) {
  if (loading) return <Skeleton height={140} radius={16} />;
  if (error) return <Notice tone="error" message={describeError(error)} />;
  if (courses.length === 0) return <Notice tone="info" message="No curriculum is loaded on the server yet. Pick skills instead." />;
  const c = courses.find((x) => x.id === course);
  return (
    <div className="flex flex-col gap-5">
      <Section title="Course">
        <select value={course ?? ''} onChange={(e) => setCourse(e.target.value)} aria-label="Course" className="h-11 w-full rounded-control border border-line bg-surface px-3 text-[15px] text-ink">
          {courses.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}
              {x.id === groupCourse ? ' (this group’s)' : ''}
            </option>
          ))}
        </select>
      </Section>
      <Section title="Lesson">
        <select value={lessonId ?? ''} onChange={(e) => setLessonId(e.target.value)} aria-label="Lesson" className="h-11 w-full rounded-control border border-line bg-surface px-3 text-[15px] text-ink">
          <option value="">Choose a lesson…</option>
          {c?.units.map((u, ui) => (
            <optgroup key={u.id} label={`${ui + 1}. ${u.title} · ${u.university}`}>
              {u.lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Section>
    </div>
  );
}

function SkillPicker({ subject, setSubject, skills, setSkills, mix, setMix }: { subject: Subject; setSubject: (s: Subject) => void; skills: string[]; setSkills: (s: string[]) => void; mix: Mix; setMix: (m: Mix) => void }) {
  const taxonomy = useTeacherTaxonomy();
  const domains = taxonomy.data?.subjects[subject] ?? [];
  const toggle = (s: string) => setSkills(skills.includes(s) ? skills.filter((x) => x !== s) : [...skills, s]);
  const total = mix.easy + mix.medium + mix.hard;
  return (
    <div className="flex flex-col gap-5">
      <Segmented
        label="Subject"
        value={subject}
        onChange={setSubject}
        options={[
          { value: 'math', label: 'Math' },
          { value: 'english', label: 'Reading & Writing' },
        ]}
      />
      <Section title={`Skills${skills.length ? ` · ${skills.length} chosen` : ''}`}>
        {taxonomy.isPending ? (
          <Skeleton height={200} radius={16} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {domains.map((d) => (
              <div key={d.domain} className="rounded-card border border-line bg-surface p-3.5">
                <p className="t-caption mb-2 text-ink-2">{d.domain}</p>
                <ul className="flex flex-col gap-1">
                  {d.skills.map((s) => {
                    const on = skills.includes(s.skill);
                    return (
                      <li key={s.skill}>
                        <button type="button" onClick={() => toggle(s.skill)} aria-pressed={on} disabled={s.total === 0} className={`flex w-full items-center gap-2.5 rounded-chip px-2 py-1.5 text-left text-[14px] disabled:opacity-40 ${on ? 'bg-accent-tint text-accent' : 'text-ink hover:bg-surface-2'}`}>
                          <span className={`flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 ${on ? 'border-primary bg-primary text-on-primary' : 'border-line-strong'}`}>{on && <Check size={11} strokeWidth={3} aria-hidden="true" />}</span>
                          <span className="min-w-0 flex-1">{s.skill}</span>
                          <span className="text-[11.5px] text-ink-3 tabular" title={`${s.easy} easy, ${s.medium} medium, ${s.hard} hard`}>
                            {s.total}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title={`How many · ${total}`}>
        <div className="grid grid-cols-3 gap-2.5">
          {(['easy', 'medium', 'hard'] as const).map((d) => (
            <div key={d} className="flex flex-col items-center gap-1.5 rounded-card border border-line bg-surface p-3">
              <span className="t-caption capitalize text-ink-2">{d}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setMix({ ...mix, [d]: Math.max(0, mix[d] - 1) })} aria-label={`One fewer ${d}`} className="flex size-8 items-center justify-center rounded-full border border-line-strong text-ink hover:bg-surface-2">
                  <Minus size={14} aria-hidden="true" />
                </button>
                <span className="t-number w-7 text-center text-[22px] text-ink">{mix[d]}</span>
                <button type="button" onClick={() => setMix({ ...mix, [d]: Math.min(30, mix[d] + 1) })} disabled={total >= 60} aria-label={`One more ${d}`} className="flex size-8 items-center justify-center rounded-full border border-line-strong text-ink hover:bg-surface-2 disabled:opacity-40">
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Review({ items, drawing, error, img, subject, onRedraw, onSet, onRemove }: { items: AssignmentQuestion[]; drawing: boolean; error: string | null; img: ReturnType<typeof useRichImages>; subject: Subject; onRedraw: () => void; onSet: (ids: string[]) => void; onRemove: (id: string) => void }) {
  const [swap, setSwap] = useState<AssignmentQuestion | 'add' | null>(null);
  const ids = items.map((q) => q.id);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="t-subhead text-ink-2">
          <b className="text-ink">{items.length} questions</b>, easy to hard, the same for every student. Swap or remove any; questions the group hasn’t had come first.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setSwap('add')} disabled={drawing || items.length >= 60} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] font-bold text-ink hover:bg-surface-2 disabled:opacity-50">
            <Plus size={14} aria-hidden="true" /> Add
          </button>
          <button type="button" onClick={onRedraw} disabled={drawing} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] font-bold text-ink hover:bg-surface-2 disabled:opacity-50">
            <Shuffle size={14} aria-hidden="true" /> Draw again
          </button>
        </div>
      </div>
      {error && (
        <div className="mb-4">
          <Notice tone="error" message={error} />
        </div>
      )}
      {drawing && items.length === 0 ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={160} radius={16} />
          ))}
        </div>
      ) : (
        <ol className={`flex flex-col gap-3 ${drawing ? 'opacity-60' : ''}`}>
          {items.map((q, i) => (
            <li key={q.id} className="rounded-card border border-line bg-surface p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-[8px] bg-ink text-[13px] font-bold text-surface tabular">{i + 1}</span>
                  <QuestionTags q={q} />
                </span>
                <span className="flex gap-1">
                  <button type="button" onClick={() => setSwap(q)} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-bold text-accent hover:bg-accent-tint">
                    <Replace size={14} aria-hidden="true" /> Swap
                  </button>
                  <button type="button" onClick={() => onRemove(q.id)} disabled={items.length <= 1} aria-label={`Remove question ${i + 1}`} className="inline-flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-bad-tint hover:text-bad disabled:opacity-30">
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </span>
              </div>
              <QuestionView q={q} img={img} compact />
            </li>
          ))}
        </ol>
      )}
      {drawing && items.length > 0 && (
        <p className="t-footnote mt-3 flex items-center gap-2 text-ink-2">
          <RefreshCw size={14} className="animate-spin" aria-hidden="true" /> Updating…
        </p>
      )}
      {swap && (
        <QuestionPicker
          subject={subject}
          skill={swap === 'add' ? undefined : swap.skill}
          difficulty={swap === 'add' ? undefined : swap.difficulty}
          exclude={ids}
          title={swap === 'add' ? 'Add a question' : 'Swap the question'}
          onClose={() => setSwap(null)}
          onPick={(id) => {
            onSet(swap === 'add' ? [...ids, id] : ids.map((x) => (x === swap.id ? id : x)));
            setSwap(null);
          }}
        />
      )}
    </div>
  );
}

function Summary({ group, kind, title, questions }: { group?: Group; kind: AssignmentKind; title: string; questions: number }) {
  return (
    <p className="t-subhead rounded-card border border-line bg-surface-2 px-4 py-3 text-ink-2">
      <b className="text-ink">{title || 'Untitled'}</b> · {KINDS.find((k) => k.kind === kind)!.label} · {questions} questions · for {group ? groupTitle(group) : '—'}. Every student of the group gets a notification.
    </p>
  );
}
