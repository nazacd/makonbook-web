import {
  ArrowRight,
  BookOpenCheck,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  CalendarClock,
  Clock,
  Compass,
  Flame,
  GraduationCap,
  Layers,
  LineChart,
  Pencil,
  PlayCircle,
  Signpost,
  SpellCheck,
  Target,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { isDue, KIND, useMyAssignments, type StudentAssignment } from '@/api/assignments';
import { useGoals, type Goals } from '@/api/learning';
import { useRoadmaps } from '@/api/roadmaps';
import { useMe, useMyAttendance } from '@/api/queries';
import type { Profile } from '@/api/types';
import { satRange } from '@/api/universities';
import { examPath } from '@/components/assignments/AssignmentCard';
import { UniversityBadge } from '@/components/onboarding/Crest';
import { Flag } from '@/screens/roadmap/flags';
import { dueRelative, dueShort } from '@/components/assignments/format';
import { GoalsModal } from '@/components/dashboard/GoalsModal';
import { Skeleton } from '@/components/States';
import { Progress, Widget, WidgetLabel } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { normalCase, parseClassName, roomNumber } from '@/lib/groups';
import { useCatalog, useRuns } from '@/lib/practice/hooks';
import { toRepair, useAnswered, useResolved, type Answered } from '@/lib/practice/mistakes';
import { testName } from '@/lib/practice/run';
import { addDays, describeDay, nextClass, schoolDate } from '@/lib/schedule';
import { useTitle } from '@/lib/title';
import { useVocabToday } from '@/lib/vocab/today';


// The student's home (docs/design.md): today's plan, the next class, their
// SAT goal, the mistakes waiting, the week so far, what's half-finished,
// vocabulary and scores — each a widget tinted by its own colour.

const A = {
  plan: 'var(--color-primary)',
  classes: 'var(--color-orange)',
  mistakes: 'var(--color-blue)',
  week: 'var(--color-amber)',
  continue: 'var(--color-pink)',
  vocab: 'var(--color-violet)',
  scores: 'var(--color-slate)',
  roadmap: 'var(--color-teal)',
  due: 'var(--color-green)',
};

export function Dashboard() {
  useTitle('Dashboard');
  const profile = useMe().data as Profile;
  const now = useNow();
  const { answered, attempts, isPending } = useAnswered();
  const resolved = useResolved();
  const repair = toRepair(answered, resolved);
  const goals = useGoals();
  const vocab = useVocabToday(now);
  const runs = useRuns();
  const catalog = useCatalog();
  const [editGoals, setEditGoals] = useState(false);
  const assignments = useMyAssignments(profile.status !== 'registered');
  const soon = (assignments.data ?? []).filter((a) => isDue(a) && Date.parse(a.due_at) - now < 2 * 86_400_000).sort((a, b) => a.due_at.localeCompare(b.due_at))[0];

  const inProgress = Object.values(runs.data ?? {});
  const finishedCodes = new Set(attempts.map((a) => a.code));
  const nextTest = catalog.data?.find((t) => t.version != null && !finishedCodes.has(t.code) && !runs.data?.[t.code]);
  const totals = [...attempts].filter((a) => a.total != null).sort((a, b) => a.finished_at.localeCompare(b.finished_at));

  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <header className="mb-5 flex items-center gap-3 pt-1">
        <span className="text-[30px] leading-none" aria-hidden="true">
          👋
        </span>
        <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.02em] text-ink">Hi {normalCase(`${profile.first_name} ${profile.last_name}`)}</h1>
      </header>

      <div className="grid gap-3.5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.85fr)_minmax(0,1fr)]">
        <div className="lg:col-span-2 xl:col-span-1">
          <TodaysPlan due={soon} now={now} repair={repair} vocabToStudy={vocab.hasDeck ? vocab.toStudy : 0} run={inProgress[0]} nextTest={nextTest} loading={isPending} />
        </div>
        <NextClassWidget profile={profile} now={now} />
        <YourSat goals={goals.data} latest={totals.at(-1)?.total ?? null} now={now} onEdit={() => setEditGoals(true)} />
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Mistakes repair={repair} attempts={attempts.length} fixed={Object.keys(resolved).length} loading={isPending} />
        <ThisWeek answered={answered} reviewDays={vocab.hasDeck ? vocab.log.map((r) => schoolDate(Date.parse(r.reviewed_at))) : []} resolved={resolved} now={now} />
      </div>

      <div className="mt-3.5 grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        <DueWork list={assignments.data} loading={assignments.isPending && profile.status !== 'registered'} registered={profile.status === 'registered' || profile.groups.length === 0} now={now} />
        <Continue runs={inProgress} />
        <RoadmapWidget />
      </div>

      <div className="mt-3.5 grid gap-3.5 md:grid-cols-2">
        <VocabWidget v={vocab} now={now} />
        <Scores totals={totals.map((a) => ({ total: a.total!, at: a.finished_at, title: a.title }))} goal={goals.data?.target_total ?? null} />
      </div>

      {editGoals && <GoalsModal goals={goals.data} onClose={() => setEditGoals(false)} />}
    </div>
  );
}

function Cta({ to, children, variant = 'primary' }: { to: string; children: string; variant?: 'primary' | 'outline' }) {
  return (
    <Link
      to={to}
      className={`inline-flex h-[42px] items-center gap-2 rounded-card px-5 text-[14px] font-bold ${variant === 'primary' ? 'lift bg-primary text-on-primary hover:bg-primary-hover' : 'border border-line-strong bg-surface text-ink hover:bg-surface-2'}`}>
      {children}
      <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
    </Link>
  );
}

function Chip({ icon: I, children }: { icon: LucideIcon; children: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 text-[12px] font-semibold text-ink-2">
      <I size={13} aria-hidden="true" />
      {children}
    </span>
  );
}

function topSkill(repair: Answered[]) {
  const counts = new Map<string, { n: number; a: Answered }>();
  for (const a of repair) {
    const c = counts.get(a.skill) ?? { n: 0, a };
    c.n++;
    counts.set(a.skill, c);
  }
  return [...counts.values()].sort((x, y) => y.n - x.n)[0];
}

// One suggestion, with why: work due within two days first, then mistakes,
// then words due, then the test half-done, then a test not yet tried.
function TodaysPlan({ due, now, repair, vocabToStudy, run, nextTest, loading }: { due?: StudentAssignment; now: number; repair: Answered[]; vocabToStudy: number; run?: { code: string; title: string }; nextTest?: { code: string; title: string }; loading: boolean }) {
  let body: { title: string; topic: string; chips: [LucideIcon, string][]; why: string; to: string; cta: string };
  const top = topSkill(repair);
  if (due) {
    const late = Date.parse(due.due_at) < now;
    body = {
      title: due.mine.status === 'in_progress' ? `Finish ${testName(due.title)}` : testName(due.title),
      topic: `${KIND[due.kind].label} · ${due.lesson?.title ?? parseClassName(due.group_name).title}`,
      chips: [
        [CalendarClock, late ? `was due ${dueRelative(due.due_at, now)}` : `due ${dueRelative(due.due_at, now)}`],
        [ClipboardList, `${due.questions} questions`],
      ],
      why: late ? 'The deadline has passed, but your teacher still takes it, marked late. Better late than blank.' : 'Your teacher set it, and the deadline is close. Get it done and the rest of the day is yours.',
      to: due.kind === 'exam' ? examPath(due) : KIND[due.kind].path,
      cta: due.mine.status === 'in_progress' ? 'Continue' : 'Start',
    };
  } else if (top) {
    const n = Math.min(20, top.n);
    body = {
      title: n === 1 ? 'One mistake to clear' : `Clear ${n} mistakes`,
      topic: top.a.skill,
      chips: [
        [Clock, `about ${Math.max(2, Math.round(n * 1.5))} min`],
        [Zap, `${top.n} to fix`],
      ],
      why: `You missed ${top.n === 1 ? 'this one' : 'these'} in ${testName(top.a.title)}. Fix them now and they won’t catch you on test day.`,
      to: `/training-hall/drill?${new URLSearchParams({ subject: top.a.subject, domain: top.a.domain, skill: top.a.skill })}`,
      cta: 'Start practising',
    };
  } else if (vocabToStudy > 0) {
    body = { title: `Review ${vocabToStudy} words`, topic: 'Vocabulary', chips: [[Clock, `about ${Math.max(2, Math.round(vocabToStudy / 4))} min`]], why: 'They’re due today: a quick look now keeps them from slipping away.', to: '/words/study', cta: 'Study now' };
  } else if (run) {
    body = { title: `Finish ${testName(run.title)}`, topic: 'Mock test', chips: [[PlayCircle, 'in progress']], why: 'Your answers are saved. Pick up where you stopped.', to: `/practice/run/${encodeURIComponent(run.code)}`, cta: 'Continue' };
  } else if (nextTest) {
    body = { title: `Take ${testName(nextTest.title)}`, topic: 'Mock test', chips: [[Clock, 'one section or the full test']], why: 'A fresh test shows what to work on next.', to: `/practice/test/${encodeURIComponent(nextTest.code)}`, cta: 'Start' };
  } else {
    body = { title: 'All caught up', topic: 'Nice work', chips: [], why: 'Nothing waiting right now. Words and tests will show up here when they’re due.', to: '/words', cta: 'Open Vocabulary' };
  }
  return (
    <Widget accent={A.plan} className="h-full">
      <WidgetLabel icon={Compass} label="Today’s plan" accent={A.plan} />
      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton width="70%" height={30} />
          <Skeleton width="40%" />
          <Skeleton height={42} width={180} radius={16} />
        </div>
      ) : (
        <>
          <h2 className="text-[26px] font-bold leading-8 tracking-[-0.02em] text-ink">{body.title}</h2>
          <p className="t-subhead mt-1 text-ink-2">{body.topic}</p>
          {body.chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {body.chips.map(([icon, text]) => (
                <Chip key={text} icon={icon}>
                  {text}
                </Chip>
              ))}
            </div>
          )}
          <p className="t-footnote mt-3 max-w-[60ch] text-ink-2">
            <b className="font-bold text-ink">Why:</b> {body.why}
          </p>
          <div className="mt-4">
            <Cta to={body.to}>{body.cta}</Cta>
          </div>
        </>
      )}
    </Widget>
  );
}

function NextClassWidget({ profile, now }: { profile: Profile; now: number }) {
  const next = nextClass(profile.groups, now);
  const attendance = useMyAttendance();
  const sums = (attendance.data?.groups ?? []).map((g) => g.summary).filter((s) => s && s.lessons > 0);
  const lessons = sums.reduce((n, s) => n + s.lessons, 0);
  const rate = lessons ? sums.reduce((n, s) => n + s.present + s.late, 0) / lessons : null;
  return (
    <Widget accent={A.classes} className="h-full">
      <WidgetLabel icon={CalendarClock} label="Next class" accent={A.classes} />
      {next ? (
        <Link to="/classes" className="block rounded-control">
          <p className="t-number text-[28px] leading-8 text-ink">
            {next.start <= now ? 'Now' : next.slot.begin_time}
          </p>
          <p className="t-subhead text-ink-2">{next.start <= now ? `until ${next.slot.end_time}` : describeDay(next.start, now)}</p>
          <p className="t-headline mt-3 truncate text-ink">{parseClassName(next.group.name, next.group.discipline).title}</p>
          <p className="t-footnote text-ink-2">{[next.slot.classroom && `Room ${roomNumber(next.slot.classroom)}`, next.slot.end_time && `${next.slot.begin_time}–${next.slot.end_time}`].filter(Boolean).join(' · ')}</p>
        </Link>
      ) : (
        <p className="t-subhead text-ink-2">{profile.groups.length ? 'No class in the next week.' : 'Classes show up here once you’re in a SATMAKON group.'}</p>
      )}
      {rate != null && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between">
            <span className="t-caption text-ink-2">Attendance</span>
            <span className="t-caption tabular text-ink">{Math.round(rate * 100)}%</span>
          </div>
          <Progress value={rate} tone={rate >= 0.9 ? 'good' : rate >= 0.7 ? 'watch' : 'primary'} />
        </div>
      )}
    </Widget>
  );
}

function daysUntil(date: string, now: number): number {
  const today = schoolDate(now);
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

// The one solid card: the goal, the countdown, and how far the last mock was.
function YourSat({ goals, latest, now, onEdit }: { goals?: Goals; latest: number | null; now: number; onEdit: () => void }) {
  const days = goals?.exam_date ? daysUntil(goals.exam_date, now) : null;
  const target = goals?.target_total ?? null;
  const dream = goals?.university ?? null;
  const range = satRange(dream?.sat);
  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-card p-[18px] text-white" style={{ background: 'linear-gradient(160deg, #5a12bf, #3e008e 52%, #2a0063)' }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-[7px] border border-white/25 bg-white/15">
            <Target size={13} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="t-micro text-white/85">Your SAT</span>
        </span>
        <button type="button" onClick={onEdit} aria-label="Edit your SAT goal" className="flex size-8 items-center justify-center rounded-[9px] border border-white/25 bg-white/10 hover:bg-white/20">
          <Pencil size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="flex items-center gap-4">
        {dream ? (
          <Link to="/dream" aria-label={`Your dream university: ${dream.name}. Change it`} className="shrink-0 rounded-full">
            <UniversityBadge id={dream.id} name={dream.name} logo={dream.logo_url} size={64} ring="white" />
          </Link>
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white text-primary">
            <GraduationCap size={28} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <p className="t-micro text-white/75">Aiming at</p>
          {target ? (
            <p className="t-number text-[32px] leading-9">{target}</p>
          ) : (
            <button type="button" onClick={onEdit} className="text-[17px] font-bold underline-offset-2 hover:underline">
              Not chosen yet — set one →
            </button>
          )}
          {days != null && days >= 0 ? (
            <p className="mt-0.5 text-[14px] font-semibold text-white/90">
              <span className="t-number text-[18px]">{days}</span> {days === 1 ? 'day' : 'days'} to go
            </p>
          ) : (
            <button type="button" onClick={onEdit} className="mt-1 inline-flex h-7 items-center rounded-full bg-black/25 px-3 text-[12px] font-bold hover:bg-black/35">
              + Set exam date
            </button>
          )}
        </div>
      </div>
      {dream ? (
        <Link to="/dream" className="mt-3 flex min-w-0 items-center gap-2 rounded-[10px] bg-black/20 px-2.5 py-2 text-[13px] font-semibold hover:bg-black/30">
          <Flag code={dream.country} size={18} className="ring-0" />
          <span className="truncate">{dream.name}</span>
          <span className="ml-auto shrink-0 text-[12px] font-bold text-white/70">Change</span>
        </Link>
      ) : (
        <Link to="/dream" className="mt-3 flex items-center justify-between rounded-[10px] bg-black/20 px-2.5 py-2 text-[13px] font-semibold hover:bg-black/30">
          Choose your dream university <ChevronRight size={15} aria-hidden="true" />
        </Link>
      )}
      <p className="mt-auto border-t border-white/20 pt-3 text-[13px] text-white/85">
        {latest != null && range
          ? latest >= range.p25
            ? `Your last mock, ${latest}, is in ${dream?.short_name ?? 'your dream'}’s admitted range.`
            : `Last mock ${latest} · ${range.p25 - latest} points to ${dream?.short_name ?? 'your dream'}’s range.`
          : latest == null
          ? target
            ? `Take your first mock to start the climb to ${target}.`
            : 'Set a score target →'
          : target
            ? latest >= target
              ? `Your last mock, ${latest}, is on target. Keep it there.`
              : `Last mock ${latest} · ${target - latest} points to go.`
            : `Your last mock: ${latest}.`}
      </p>
    </section>
  );
}

function Mistakes({ repair, attempts, fixed, loading }: { repair: Answered[]; attempts: number; fixed: number; loading: boolean }) {
  const bySkill = new Map<string, number>();
  for (const a of repair) bySkill.set(a.skill, (bySkill.get(a.skill) ?? 0) + 1);
  const weakest = [...bySkill.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  return (
    <Widget accent={A.mistakes}>
      <WidgetLabel icon={XCircle} label="Incorrect questions" accent={A.mistakes} />
      {loading ? (
        <Skeleton width="50%" height={30} />
      ) : attempts === 0 ? (
        <p className="t-subhead text-ink-2">Questions you miss in mock tests collect here, ready to practise.</p>
      ) : (
        <div className="flex flex-col gap-x-8 gap-y-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-ink">
              <span className="t-number text-[28px]">{repair.length}</span> <span className="t-subhead text-ink-2">{repair.length === 1 ? 'question to fix' : 'questions to fix'}</span>
            </p>
            <p className="t-footnote text-ink-2">
              From {attempts} {attempts === 1 ? 'assessment' : 'assessments'}
              {fixed > 0 && ` · ${fixed} already fixed`}. Practise them 20 at a time.
            </p>
            {repair.length > 0 && (
              <div className="mt-3">
                <Cta to="/training-hall/drill">Practise them</Cta>
              </div>
            )}
          </div>
          {weakest.length > 0 && (
            <div className="min-w-0 sm:flex-1">
              <p className="t-micro mb-2 text-ink-2">Weakest topics</p>
              <div className="flex flex-wrap gap-2">
                {weakest.map(([skill, n], i) => (
                  <span key={skill} className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold ${i === 0 ? 'border-primary/30 bg-accent-tint text-accent' : 'border-line bg-surface text-ink-2'}`}>
                    {skill} <span className="text-bad">{n} wrong</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Widget>
  );
}

function ThisWeek({ answered, reviewDays, resolved, now }: { answered: Answered[]; reviewDays: string[]; resolved: Record<string, string>; now: number }) {
  const today = schoolDate(now);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const byDay = new Map<string, { right: number; all: number }>();
  for (const a of answered) {
    const d = schoolDate(Date.parse(a.at));
    const c = byDay.get(d) ?? { right: 0, all: 0 };
    c.all++;
    if (a.correct) c.right++;
    byDay.set(d, c);
  }
  const active = new Set([...byDay.keys(), ...reviewDays, ...Object.values(resolved).map((t) => schoolDate(Date.parse(t)))]);
  let streak = 0;
  for (let d = today; active.has(d); d = addDays(d, -1)) streak++;
  const week = days.slice(7).filter((d) => active.has(d)).length;
  const recent = answered.filter((a) => days.includes(schoolDate(Date.parse(a.at))));
  const share = (subject: 'math' | 'english') => {
    const list = recent.filter((a) => a.subject === subject);
    return list.length ? Math.round((list.filter((a) => a.correct).length / list.length) * 100) : null;
  };
  const math = share('math');
  const english = share('english');
  return (
    <Widget accent={A.week}>
      <WidgetLabel icon={Flame} label="This week" accent={A.week} />
      <p className="text-ink">
        <Flame size={18} className="-mt-1 mr-1 inline text-fill-watch" aria-hidden="true" />
        <span className="t-number text-[28px]">{streak}</span> <span className="t-subhead text-ink-2">day streak</span>
      </p>
      <p className="t-footnote text-ink-2">{week} of the last 7 days active</p>
      <div className="mt-3 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1" role="img" aria-label="The last 14 days: how many answers were right each day">
        {days.map((d) => {
          const c = byDay.get(d);
          const share = c ? c.right / c.all : null;
          const cls = share == null ? (active.has(d) ? 'bg-accent-tint' : 'border border-line') : share >= 0.7 ? 'bg-fill-good' : share >= 0.4 ? 'bg-fill-watch' : 'bg-fill-bad';
          return <span key={d} className={`aspect-square rounded-[4px] ${cls}`} title={d} />;
        })}
      </div>
      <p className="t-caption mt-2 flex flex-wrap gap-x-3 gap-y-1 text-ink-2">
        <span>
          <i className="mr-1 inline-block size-2 rounded-full bg-fill-good" />
          mostly right
        </span>
        <span>
          <i className="mr-1 inline-block size-2 rounded-full bg-fill-watch" />
          mixed
        </span>
        <span>
          <i className="mr-1 inline-block size-2 rounded-full bg-fill-bad" />
          mostly wrong · last 14 days
        </span>
      </p>
      {(math != null || english != null) && (
        <p className="t-footnote mt-2 text-ink">
          {[math != null && `Math ${math}% right`, english != null && `Reading & Writing ${english}% right`].filter(Boolean).join(' · ')}
        </p>
      )}
    </Widget>
  );
}

// The current roadmap: progress, where you are, and Continue (the reference's Roadmap widget).
function RoadmapWidget() {
  const list = useRoadmaps();
  const [k, setK] = useState(0);
  const all = list.data ?? [];
  const r = all[Math.min(k, all.length - 1)];
  const pct = r && r.lessons_total ? Math.round((100 * r.lessons_done) / r.lessons_total) : 0;
  const ring = 2 * Math.PI * 22;
  return (
    <Widget accent={A.roadmap}>
      <WidgetLabel
        icon={Signpost}
        label="Roadmap"
        accent={A.roadmap}
        right={
          all.length > 1 ? (
            <span className="flex gap-1">
              {all.map((x, i) => (
                <button key={x.id} type="button" onClick={() => setK(i)} aria-label={x.title} aria-pressed={i === k} className={`size-2 rounded-full ${i === k ? 'bg-green' : 'bg-line-strong'}`} />
              ))}
            </span>
          ) : undefined
        }
      />
      {list.isPending ? (
        <Skeleton height={96} radius={12} />
      ) : !r ? (
        <div className="py-3 text-center">
          <p className="t-subhead text-ink-2">Build your study roadmap, one stop at a time.</p>
          <Link to="/roadmaps" className="t-subhead mt-2 inline-flex items-center gap-1 font-bold text-accent hover:underline">
            Open roadmaps <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="relative size-14 shrink-0">
              <svg viewBox="0 0 56 56" className="size-full -rotate-90" aria-hidden="true">
                <circle cx="28" cy="28" r="22" fill="none" stroke="var(--color-track)" strokeWidth="6" />
                <circle cx="28" cy="28" r="22" fill="none" stroke="var(--color-green)" strokeWidth="6" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (1 - pct / 100)} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-ink">{pct}%</span>
            </div>
            <div className="min-w-0">
              <p className="t-headline truncate text-ink">{r.title}</p>
              <p className="t-caption truncate text-ink-2">{r.current ? `${r.current.unit_title} · ${r.current.university}` : r.lessons_done === r.lessons_total ? 'Journey complete' : 'Enrol to continue'}</p>
            </div>
          </div>
          <p className="t-caption mt-3 text-ink-2">
            {r.units_done} stops done · {r.units_total - r.units_done} to go · Lessons {r.lessons_done}/{r.lessons_total}
          </p>
          <Link to={r.current ? `/roadmaps/${r.id}/lessons/${r.current.lesson_id}` : `/roadmaps/${r.id}`} className="t-subhead mt-2 inline-flex items-center gap-1 font-bold text-accent hover:underline">
            {r.current ? 'Continue' : 'Open the map'} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </>
      )}
    </Widget>
  );
}

const DUE_ICON = { homework: BookOpenCheck, level_check: ClipboardCheck, exam: CalendarClock };

// What the teachers set and isn't done, soonest deadline first, with a pill
// per group to narrow it down (the reference's Due work).
function DueWork({ list, loading, registered, now }: { list?: StudentAssignment[]; loading: boolean; registered: boolean; now: number }) {
  const [group, setGroup] = useState<number | null>(null);
  const all = list ?? [];
  const groups = [...new Map(all.map((a) => [a.group_id, parseClassName(a.group_name).title])).entries()];
  const inGroup = all.filter((a) => group == null || a.group_id === group);
  const due = inGroup.filter(isDue).sort((a, b) => a.due_at.localeCompare(b.due_at));
  const done = inGroup.filter((a) => a.mine.finished_at).length;
  return (
    <Widget accent={A.due}>
      <WidgetLabel
        icon={CalendarClock}
        label="Due work"
        accent={A.due}
        right={
          groups.length > 1 ? (
            <div className="flex max-w-[60%] gap-1.5 overflow-x-auto no-scrollbar">
              {[[null, 'All'] as const, ...groups].map(([id, title]) => (
                <button key={id ?? 'all'} type="button" onClick={() => setGroup(id)} aria-pressed={group === id} className={`h-6 shrink-0 whitespace-nowrap rounded-full border px-2.5 text-[11.5px] font-semibold ${group === id ? 'border-green/40 bg-green/10 text-green' : 'border-line text-ink-2 hover:text-ink'}`}>
                  {title}
                </button>
              ))}
            </div>
          ) : undefined
        }
      />
      {registered ? (
        <div className="py-4 text-center">
          <p className="t-subhead text-ink-2">Teachers’ homework shows up here once you’re in a group. Your roadmap has some for every lesson.</p>
          <Link to="/roadmaps" className="t-subhead mt-2 inline-flex items-center gap-1 font-bold text-accent hover:underline">
            Open roadmaps <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton height={52} radius={12} />
          <Skeleton height={52} radius={12} />
        </div>
      ) : due.length === 0 ? (
        <p className="t-subhead py-6 text-center text-ink-2">{all.length ? 'All done. Nothing due right now.' : 'Nothing set yet. Homework, level checks and exams from your teachers land here.'}</p>
      ) : (
        <ul className="flex max-h-[188px] flex-col gap-2 overflow-y-auto overscroll-contain">
          {due.map((a) => {
            const I = DUE_ICON[a.kind];
            const late = Date.parse(a.due_at) < now;
            return (
              <li key={a.id}>
                <Link to={a.kind === 'exam' ? examPath(a) : KIND[a.kind].path} className="flex items-center gap-3 rounded-control bg-surface-2 px-3 py-2.5 hover:bg-line">
                  <I size={17} className="shrink-0 text-green" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="t-headline block truncate text-ink">{testName(a.title)}</span>
                    <span className={`t-caption ${late ? 'text-bad' : 'text-ink-2'}`}>
                      {KIND[a.kind].label} · {late ? 'overdue' : 'due'} {dueShort(a.due_at, now)}
                    </span>
                  </span>
                  <ChevronRightIcon />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {!registered && all.length > 0 && (
        <Link to="/homework" className="t-caption mt-3 flex justify-end font-bold text-green hover:underline">
          {done}/{inGroup.length} done →
        </Link>
      )}
    </Widget>
  );
}

function ChevronRightIcon() {
  return <ArrowRight size={15} className="shrink-0 text-ink-2" aria-hidden="true" />;
}

function Continue({ runs }: { runs: { code: string; title: string; stage: number; sections: string[]; startedAt: string }[] }) {
  return (
    <Widget accent={A.continue}>
      <WidgetLabel icon={PlayCircle} label="Continue" accent={A.continue} />
      {runs.length === 0 ? (
        <p className="t-subhead py-6 text-center text-ink-2">Nothing half-finished. Clean slate.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {runs.map((r) => (
            <li key={r.code}>
              <Link to={`/practice/run/${encodeURIComponent(r.code)}`} className="flex items-center gap-3 rounded-control bg-surface-2 px-3 py-2.5 hover:bg-line">
                <Layers size={18} className="shrink-0 text-pink" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="t-headline block truncate text-ink">{testName(r.title)}</span>
                  <span className="t-caption text-ink-2">Module {r.stage + 1} · saved</span>
                </span>
                <ArrowRight size={16} className="text-ink-2" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

function VocabWidget({ v, now }: { v: ReturnType<typeof useVocabToday>; now: number }) {
  if (!v.hasDeck) {
    return (
      <Widget accent={A.vocab}>
        <WidgetLabel icon={SpellCheck} label="Vocabulary" accent={A.vocab} />
        {v.ready ? <p className="t-subhead text-ink-2">Turn on a word list to start. A few minutes a day adds up.</p> : <Skeleton height={60} />}
        <div className="mt-3">
          <Cta to="/words" variant="outline">
            Open Vocabulary
          </Cta>
        </div>
      </Widget>
    );
  }
  const pct = v.total ? v.learned / v.total : 0;
  const today = schoolDate(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const reviewed = new Set(v.log.map((r) => schoolDate(Date.parse(r.reviewed_at))));
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <Widget accent={A.vocab}>
      <WidgetLabel icon={SpellCheck} label="Vocabulary" accent={A.vocab} />
      <div className="flex items-center gap-4">
        <svg width="60" height="60" viewBox="0 0 60 60" role="img" aria-label={`${Math.round(pct * 100)}% learned`}>
          <circle cx="30" cy="30" r={r} fill="none" stroke="var(--color-track)" strokeWidth="6" />
          <circle cx="30" cy="30" r={r} fill="none" stroke="var(--color-violet)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 30 30)" />
          <text x="30" y="34" textAnchor="middle" className="fill-ink text-[12px] font-extrabold">
            {Math.round(pct * 100)}%
          </text>
        </svg>
        <div>
          <p className="text-ink">
            <span className="t-number text-[26px]">{v.toStudy}</span> <span className="t-subhead text-ink-2">to study today</span>
          </p>
          <p className="t-footnote text-ink-2">
            {v.total} words in {v.lists} {v.lists === 1 ? 'list' : 'lists'} · {v.learned} learned
          </p>
        </div>
      </div>
      {v.total > 0 && (
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-track" aria-hidden="true">
          <span className="bg-violet" style={{ width: `${(v.learned / v.total) * 100}%` }} />
          <span className="bg-violet/45" style={{ width: `${(v.learning / v.total) * 100}%` }} />
        </div>
      )}
      <div className="mt-3 grid grid-cols-7 gap-1.5" aria-label="Days you studied this week">
        {days.map((d) => (
          <span key={d} className={`flex h-8 items-center justify-center rounded-[8px] text-[11px] font-bold ${d === today ? (reviewed.has(d) ? 'bg-primary text-on-primary' : 'border-2 border-primary text-primary') : reviewed.has(d) ? 'bg-accent-tint text-accent' : 'border border-line text-ink-3'}`}>
            {'SMTWTFS'[new Date(`${d}T00:00:00Z`).getUTCDay()]}
          </span>
        ))}
      </div>
      <div className="mt-3">
        <Cta to={v.toStudy > 0 ? '/words/study' : '/words'} variant={v.toStudy > 0 ? 'primary' : 'outline'}>
          {v.toStudy > 0 ? 'Review' : 'Open Vocabulary'}
        </Cta>
      </div>
    </Widget>
  );
}

function Scores({ totals, goal }: { totals: { total: number; at: string; title: string }[]; goal: number | null }) {
  const last = totals.at(-1);
  const best = totals.reduce((m, t) => Math.max(m, t.total), 0);
  const w = 260;
  const h = 70;
  const lo = Math.min(400, ...totals.map((t) => t.total), goal ?? 1600) - 40;
  const hi = Math.max(...totals.map((t) => t.total), goal ?? 0, lo + 200) + 40;
  const y = (v: number) => h - ((v - lo) / (hi - lo)) * h;
  const pts = totals.map((t, i) => `${totals.length === 1 ? w / 2 : (i / (totals.length - 1)) * w},${y(t.total)}`).join(' ');
  return (
    <Widget accent={A.scores}>
      <WidgetLabel icon={LineChart} label="Mock scores" accent={A.scores} />
      {!last ? (
        <p className="t-subhead py-4 text-ink-2">Finish a full mock test (both sections) to see your score climb here.</p>
      ) : (
        <>
          <div className="flex gap-8">
            <div>
              <p className="t-number text-[28px] leading-8 text-ink">{last.total}</p>
              <p className="t-caption text-ink-2">Latest · {testName(last.title)}</p>
            </div>
            <div>
              <p className="t-number text-[28px] leading-8 text-ink">{best}</p>
              <p className="t-caption text-ink-2">Best</p>
            </div>
          </div>
          <svg viewBox={`-6 -6 ${w + 12} ${h + 12}`} className="mt-3 h-[82px] w-full" role="img" aria-label={`Scores over time, latest ${last.total}`}>
            {goal && <line x1="0" x2={w} y1={y(goal)} y2={y(goal)} stroke="var(--color-teal)" strokeDasharray="4 4" strokeWidth="1.5" opacity="0.7" />}
            {totals.length > 1 && <polyline points={pts} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
            {totals.map((t, i) => (
              <circle key={t.at} cx={totals.length === 1 ? w / 2 : (i / (totals.length - 1)) * w} cy={y(t.total)} r="3.5" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="2" />
            ))}
          </svg>
          {goal && (
            <p className="t-caption mt-1 flex items-center gap-2 text-ink-2">
              <span className="inline-block w-5 border-t-2 border-dashed border-teal" aria-hidden="true" />
              Your goal, {goal}
            </p>
          )}
        </>
      )}
    </Widget>
  );
}
