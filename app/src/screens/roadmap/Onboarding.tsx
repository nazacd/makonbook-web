import { ArrowLeft, ArrowRight, BookOpenText, CalendarDays, Calculator, Check, Compass, GraduationCap, Layers, Minus, Moon, Plus, Sprout, Telescope } from 'lucide-react';
import { Suspense, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { LEVEL_LABEL, useSaveOnboarding, type Level, type Onboarding as Answers } from '@/api/roadmaps';
import { satMinimum, satRange, suggestedTarget, useUniversities, type University } from '@/api/universities';
import { BRAND, ShieldMark } from '@/components/brand/Logo';
import { Spinner } from '@/components/Button';
import { Globe } from '@/components/globe/lazy';
import type { GlobeMode } from '@/components/globe/scene';
import { UniversityBadge } from '@/components/onboarding/Crest';
import { Mascot } from '@/components/onboarding/Mascot';
import { ScoreArc } from '@/components/onboarding/ScoreArc';
import { DreamStep as Dream } from '@/components/onboarding/DreamStep';
import { useNow } from '@/lib/clock';
import { SAT_DATES } from '@/lib/satDates';
import { useTitle } from '@/lib/title';

// Onboarding (free accounts; spec §22.3, §24): the first thing a new student
// sees. A night globe rises from the bottom of the page; they choose their
// dream university on it (the main goal), then answer a few questions about
// their SAT over it; the finale draws their road from Tashkent to the dream.
// The roadmap is built from the answers — each chosen subject at a level from
// its current score (below 450 Foundation, 450–590 Pre-SAT, 600+ Advanced).


const STEPS = ['welcome', 'dream', 'graduation', 'dates', 'current', 'target', 'focus', 'schedule', 'finale'] as const;
type Step = (typeof STEPS)[number];
const QUESTIONS = STEPS.length - 2; // what the progress counts: everything but the welcome and the finale

const DAYS = [
  ['mon', 'Mo', 'Monday'],
  ['tue', 'Tu', 'Tuesday'],
  ['wed', 'We', 'Wednesday'],
  ['thu', 'Th', 'Thursday'],
  ['fri', 'Fr', 'Friday'],
  ['sat', 'Sa', 'Saturday'],
  ['sun', 'Su', 'Sunday'],
] as const;
const MINUTES = [
  [15, 'light'],
  [30, 'steady'],
  [45, 'strong'],
  [60, 'all in'],
] as const;

/** "1 h 30 min". */
const duration = (min: number) => (min < 60 ? `${min} min` : min % 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min / 60} h`);
/** The grade (of Uzbekistan's 11) someone finishing school in `year` is in now; null outside 1–11. */
function gradeNow(year: number, now: number): number | null {
  const d = new Date(now);
  const schoolYearEnds = d.getUTCMonth() >= 8 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
  const grade = 11 - (year - schoolYearEnds);
  return grade >= 1 && grade <= 11 ? grade : null;
}

/** "Sat, 5 Dec 2026". */
const formatDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const round10 = (n: number) => Math.round(n / 10) * 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** The level a section score starts at (the API decides; this is the preview). */
export const levelFor = (section: number | null): Level => (section == null || section < 450 ? 'foundation' : section < 600 ? 'pre-sat' : 'advanced');

type Current = { kind: 'none' } | { kind: 'total'; total: number } | { kind: 'sections'; math: number; rw: number };

export function Onboarding() {
  useTitle('Your dream university');
  const me = useMe().data;
  const now = useNow();
  const navigate = useNavigate();
  const save = useSaveOnboarding();
  const universities = useUniversities();
  const [step, setStep] = useState(0);
  const [dream, setDream] = useState<University | null>(null);
  const [browsing, setBrowsing] = useState(true); // the picker is open (else the chosen card shows)
  const [look, setLook] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [matches, setMatches] = useState<string[]>([]);
  const [graduation, setGraduation] = useState<Answers['graduation'] | null>(null);
  const [dates, setDates] = useState<string[] | null>(null); // [] = not decided
  const [current, setCurrent] = useState<Current>({ kind: 'total', total: 1000 });
  const [target, setTarget] = useState<{ math: number; rw: number } | null>(null);
  const [focus, setFocus] = useState<Answers['focus'] | null>(null);
  const [days, setDays] = useState<Answers['schedule']['days']>(['mon', 'wed', 'fri']);
  const [minutes, setMinutes] = useState<Answers['schedule']['minutes']>(30);

  const list = universities.data;
  const points = useMemo(() => (list ?? []).filter((u) => u.location).map((u) => ({ id: u.id, lat: u.location!.lat, lng: u.location!.lng })), [list]);
  const countries = useMemo(() => new Set((list ?? []).map((u) => u.country)).size, [list]);

  if (me && (me.kind !== 'student' || me.status !== 'registered')) return <Navigate to="/roadmaps" replace />;

  const name: Step = STEPS[step]!;
  const sections = current.kind === 'sections' ? { math: current.math, rw: current.rw } : current.kind === 'total' ? { math: round10(current.total / 2), rw: current.total - round10(current.total / 2) } : null;
  const currentTotal = sections ? sections.math + sections.rw : null;
  // The target starts at the dream university's (the middle of its admitted
  // range, or its minimum); else 150 above today (or 1100). Split evenly.
  const defaultTarget = () => {
    const fromDream = suggestedTarget(dream?.sat);
    const t = clamp(fromDream ?? round10((currentTotal ?? 950) + 150), 400, 1600);
    return { math: round10(t / 2), rw: t - round10(t / 2) };
  };
  const tgt = target ?? defaultTarget();
  const goal = tgt.math + tgt.rw;
  // Dragging the goal keeps the lean between the sections (to within 10: the two must add up).
  const setGoal = (total: number) => {
    let lean = tgt.math - tgt.rw;
    if ((total + lean) % 20 !== 0) lean += lean > 0 ? -10 : 10;
    const math = clamp((total + lean) / 2, Math.max(200, total - 800), Math.min(800, total - 200));
    setTarget({ math, rw: total - math });
  };
  const range = satRange(dream?.sat);
  const minimum = satMinimum(dream?.sat);
  const dreamName = dream?.short_name ?? dream?.name ?? '';
  const dreamNote = !dream
    ? null
    : range
      ? goal < range.p25
        ? `${range.p25 - goal} points below ${dreamName}’s admitted range`
        : goal <= range.p75
          ? `Inside ${dreamName}’s admitted range`
          : `Above ${dreamName}’s admitted range`
      : minimum != null
        ? goal >= minimum
          ? `Meets the ${minimum} ${dreamName} asks for`
          : `${minimum - goal} points below the ${minimum} ${dreamName} asks for`
        : null;

  const canContinue: Record<Step, boolean> = {
    welcome: true,
    dream: dream != null && !browsing,
    graduation: graduation != null,
    dates: dates != null,
    current: true,
    target: true,
    focus: focus != null,
    schedule: days.length > 0,
    finale: true,
  };
  const go = (to: number) => {
    setStep(clamp(to, 0, STEPS.length - 1));
    window.scrollTo({ top: 0 });
  };
  const next = () => go(step + 1);
  const choose = (u: University) => {
    setDream(u);
    setBrowsing(false);
    setMatches([]);
    setTarget(null); // the target follows the dream until it is changed by hand
  };

  function build() {
    if (!graduation || !dates || !focus) return;
    save.mutate(
      {
        graduation,
        sat_dates: dates,
        current: current.kind === 'none' ? null : current.kind === 'total' ? { total: current.total } : { math: current.math, rw: current.rw },
        target: { total: tgt.math + tgt.rw, math: tgt.math, rw: tgt.rw },
        focus,
        schedule: { days, minutes },
        ...(dream ? { university_id: dream.id } : {}),
      },
      { onSuccess: (r) => void navigate(r.roadmaps.length === 1 ? `/roadmaps/${r.roadmaps[0]!.id}` : '/roadmaps', { replace: true }) },
    );
  }

  const building = save.isPending || save.isSuccess;
  const mode: GlobeMode = name === 'welcome' ? 'welcome' : name === 'dream' || name === 'finale' ? 'hero' : 'low';

  return (
    <div className="onb relative flex h-dvh flex-col overflow-hidden">
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <Globe
            points={points}
            selected={dream?.id ?? null}
            matches={matches}
            look={look}
            arcTo={name === 'finale' ? (dream?.id ?? null) : null}
            mode={mode}
            zoomable={name === 'dream'}
            onPick={(id) => {
              const u = list?.find((x) => x.id === id);
              if (u && name === 'dream') choose(u);
            }}
          />
        </Suspense>
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 py-4 md:px-8">
        <span className="flex items-center gap-2.5 text-[var(--onb-ink)]">
          <ShieldMark size={30} />
          <span className="text-[19px] font-extrabold tracking-[-0.03em]">{BRAND}</span>
        </span>
        {step > 0 && name !== 'finale' && !building && <Progress at={step} />}
      </header>

      <main className="pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col px-4 md:px-8">
        {building ? (
          <Panel>
            <div className="flex flex-col items-center py-10 text-center">
              <Spinner className="size-9 text-[var(--onb-gold)]" />
              <h1 className="mt-6 text-[26px] font-semibold">Building your road</h1>
              <p className="mt-1.5 max-w-sm text-[15px] text-[var(--onb-ink-2)]">{dream ? `To ${dream.name}, lesson by lesson.` : 'Lesson by lesson.'} Please keep this page open.</p>
            </div>
          </Panel>
        ) : name === 'welcome' ? (
          <Welcome count={list?.length ?? 0} countries={countries} onStart={next} />
        ) : name === 'dream' ? (
          <Dream
            list={list}
            loading={universities.isPending}
            failed={universities.isError}
            dream={dream}
            browsing={browsing}
            onBrowse={() => setBrowsing(true)}
            onChoose={choose}
            onLook={setLook}
            onMatches={setMatches}
          />
        ) : (
          <Panel side={name === 'finale'}>
            {name === 'graduation' && (
              <Question title="When do you finish school?" icon={GraduationCap}>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['2027', '2028', '2029', '2030', '2031', '2032'] as const).map((y) => {
                    const grade = gradeNow(Number(y), now);
                    return (
                      <Tile
                        key={y}
                        on={graduation === y}
                        onClick={() => {
                          setGraduation(y);
                          next();
                        }}>
                        <span className="block text-[17px] font-bold">Class of {y}</span>
                        {grade && <span className="block text-[12.5px] font-medium text-[var(--onb-ink-2)]">Grade {grade} now</span>}
                      </Tile>
                    );
                  })}
                  <Tile
                    on={graduation === 'graduated'}
                    onClick={() => {
                      setGraduation('graduated');
                      next();
                    }}
                    className="col-span-2">
                    I’ve already finished
                  </Tile>
                </div>
              </Question>
            )}

            {name === 'dates' && (
              <Question title="When will you sit the SAT?" hint="Pick every date you might sit it." icon={CalendarDays}>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {SAT_DATES.filter(({ date }) => Date.parse(`${date}T23:59:59Z`) >= now).map(({ date, expected }) => {
                    const on = !!dates?.includes(date);
                    return <DateLeaf key={date} date={date} expected={!!expected} now={now} on={on} onClick={() => setDates((d) => (on ? (d ?? []).filter((x) => x !== date) : [...(d ?? []), date].sort()))} />;
                  })}
                  <button type="button" aria-pressed={dates?.length === 0} onClick={() => setDates([])} className="choice flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] px-4 text-[15px] font-semibold sm:col-span-2">
                    <Telescope size={17} aria-hidden="true" /> I haven’t decided yet
                  </button>
                </div>
              </Question>
            )}

            {name === 'current' && (
              <Question title="Where are you today?" hint="Your latest SAT or full practice test. A rough guess is fine: drag the light along the arc.">
                <div role="radiogroup" aria-label="Score" className="mb-4 flex rounded-full border border-[var(--onb-line)] bg-[var(--onb-glass-2)] p-[3px]">
                  {(
                    [
                      ['total', 'Total'],
                      ['sections', 'By section'],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={current.kind === k}
                      onClick={() => setCurrent(k === 'total' ? { kind: 'total', total: currentTotal ?? 1000 } : { kind: 'sections', math: sections?.math ?? 500, rw: sections?.rw ?? 500 })}
                      className={`h-9 flex-1 rounded-full text-[13px] font-semibold ${current.kind === k ? 'bg-white/15 text-[var(--onb-ink)]' : 'text-[var(--onb-ink-2)]'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {current.kind !== 'sections' && (
                  <ScoreArc label="Your score today" min={400} max={1600} value={current.kind === 'total' ? current.total : 1000} tone="today" onChange={(total) => setCurrent({ kind: 'total', total })}>
                    <div className="flex items-center gap-3">
                      <Stepper small label="Lower your score" onClick={() => setCurrent({ kind: 'total', total: clamp((currentTotal ?? 1000) - 10, 400, 1600) })} icon={Minus} />
                      <p className="w-[124px] text-[46px] font-bold leading-none tabular">{current.kind === 'total' ? current.total : '—'}</p>
                      <Stepper small label="Raise your score" onClick={() => setCurrent({ kind: 'total', total: clamp((currentTotal ?? 1000) + 10, 400, 1600) })} icon={Plus} />
                    </div>
                    <p className="mt-1.5 text-[12.5px] font-semibold text-[#7fe3d4]">{current.kind === 'total' ? `Your road starts at ${LEVEL_LABEL[levelFor(current.total / 2)]}` : 'No score yet'}</p>
                  </ScoreArc>
                )}
                {current.kind === 'sections' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {(
                        [
                          ['math', 'Math'],
                          ['rw', 'Reading & Writing'],
                        ] as const
                      ).map(([k, label]) => (
                        <div key={k}>
                          <ScoreArc label={`${label} today`} min={200} max={800} value={current[k]} tone="today" onChange={(v) => setCurrent({ ...current, [k]: v })}>
                            <p className="text-[26px] font-bold leading-none tabular">{current[k]}</p>
                          </ScoreArc>
                          <p className="mt-1.5 text-center text-[13px] font-semibold">{label}</p>
                          <p className="text-center text-[12px] font-semibold text-[#7fe3d4]">{LEVEL_LABEL[levelFor(current[k])]}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 rounded-[14px] bg-[var(--onb-glass-2)] py-2.5 text-center text-[14px] text-[var(--onb-ink-2)]">
                      Together <b className="text-[18px] text-[var(--onb-ink)] tabular">{current.math + current.rw}</b>
                    </p>
                  </>
                )}
                <button
                  type="button"
                  aria-pressed={current.kind === 'none'}
                  onClick={() => {
                    setCurrent({ kind: 'none' });
                    next();
                  }}
                  className="choice mt-4 flex w-full items-center gap-3 rounded-[16px] p-3.5 text-left">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-white/10 text-[var(--onb-ink-2)]">
                    <Sprout size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold">I haven’t taken a test yet</span>
                    <span className="block text-[13px] text-[var(--onb-ink-2)]">No problem: your road starts at Foundation.</span>
                  </span>
                </button>
              </Question>
            )}

            {name === 'target' && (
              <Question title="What score are you going for?" hint={dream && suggestedTarget(dream.sat) != null && target == null ? `We started from ${dream.short_name ?? dream.name}’s admitted students. Drag the gold light to change it.` : 'Drag the gold light along the arc. You can change it any time.'}>
                <ScoreArc label="Your goal" min={400} max={1600} value={goal} today={currentTotal} band={range ? { from: range.p25, to: range.p75 } : null} onChange={setGoal}>
                  <p className="text-[46px] font-bold leading-none tabular">{goal}</p>
                  <p className="mt-1.5 text-[12.5px] font-semibold text-[var(--onb-gold)]">{currentTotal != null && goal > currentTotal ? `+${goal - currentTotal} from today` : 'Your goal'}</p>
                </ScoreArc>
                <p className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] text-[var(--onb-ink-2)]">
                  {currentTotal != null && (
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#7fe3d4]" /> Today {currentTotal}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[var(--onb-gold)]" /> Your goal
                  </span>
                  {range && (
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-3 rounded-[2px] bg-[rgba(246,195,67,0.55)]" /> {dream?.short_name ?? 'Your dream'} admits {range.p25}–{range.p75}
                    </span>
                  )}
                </p>
                {dreamNote && <p className="mt-3 rounded-[14px] bg-[var(--onb-glass-2)] px-3 py-2.5 text-center text-[13.5px] font-semibold">{dreamNote}</p>}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <SectionTarget label="Math" value={tgt.math} onChange={(math) => setTarget({ ...tgt, math })} />
                  <SectionTarget label="Reading & Writing" value={tgt.rw} onChange={(rw) => setTarget({ ...tgt, rw })} />
                </div>
              </Question>
            )}

            {name === 'focus' && (
              <Question title="What will you work on?" hint="Each subject becomes its own road.">
                <div className="grid grid-cols-2 gap-2.5">
                  <FocusCard on={focus === 'math'} onClick={() => setFocus('math')} icon={Calculator} title="Math" sub={`Starts at ${LEVEL_LABEL[levelFor(sections?.math ?? null)]}`} />
                  <FocusCard on={focus === 'english'} onClick={() => setFocus('english')} icon={BookOpenText} title="Reading & Writing" sub={`Starts at ${LEVEL_LABEL[levelFor(sections?.rw ?? null)]}`} />
                  <FocusCard wide on={focus === 'both'} onClick={() => setFocus('both')} icon={Layers} title="Both" sub="Two roads, side by side" />
                </div>
              </Question>
            )}

            {name === 'schedule' && (
              <Question title="When can you study?" hint="Tap the days. The rest are for resting.">
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS.map(([d, short, long]) => {
                    const on = days.includes(d);
                    const nth = DAYS.filter(([x]) => days.includes(x)).findIndex(([x]) => x === d);
                    const math = focus === 'math' || (focus !== 'english' && nth % 2 === 0);
                    const I = on ? (math ? Calculator : BookOpenText) : Moon;
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        aria-label={`${long}: ${on ? `${minutes} minutes of ${math ? 'Math' : 'Reading and Writing'}` : 'rest'}`}
                        onClick={() => setDays((x) => (on ? x.filter((y) => y !== d) : [...x, d]))}
                        className="choice flex h-[96px] flex-col items-center justify-between rounded-[14px] py-2.5">
                        <I size={16} className={on ? 'text-[var(--onb-gold)]' : 'text-[var(--onb-ink-3)]'} aria-hidden="true" />
                        <span className={`text-[13px] font-bold tabular ${on ? '' : 'invisible'}`}>{minutes}′</span>
                        <span className={`text-[12px] font-bold ${on ? '' : 'text-[var(--onb-ink-3)]'}`}>{short}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--onb-ink-3)]">Each sitting</p>
                <div className="grid grid-cols-4 gap-2">
                  {MINUTES.map(([m, label]) => (
                    <Tile key={m} on={minutes === m} onClick={() => setMinutes(m)}>
                      <span className="block whitespace-nowrap text-[16px] font-bold leading-6">
                        {m}
                        <span className="text-[12px] font-semibold opacity-80"> min</span>
                      </span>
                      <span className="block text-[11.5px] font-medium opacity-80">{label}</span>
                    </Tile>
                  ))}
                </div>
                <dl className="mt-4 grid grid-cols-3 divide-x divide-[var(--onb-line)] rounded-[14px] bg-[var(--onb-glass-2)] py-3 text-center">
                  <Stat value={String(days.length)} label={days.length === 1 ? 'study day' : 'study days'} />
                  <Stat value={duration(days.length * minutes)} label="a week" />
                  <Stat value={String(7 - days.length)} label={7 - days.length === 1 ? 'day to rest' : 'days to rest'} />
                </dl>
              </Question>
            )}

            {name === 'finale' && (
              <div className="rise">
                <div className="flex flex-col items-center text-center">
                  <Mascot pose="cheer" size={84} />
                  <h1 className="mt-1 text-[28px] font-semibold leading-9 tracking-[-0.02em]">{dream ? 'Your road is drawn' : 'Your plan is ready'}</h1>
                  {dream && (
                    <p className="mt-1 text-[15px] text-[var(--onb-ink-2)]">
                      From Tashkent to <b className="text-[var(--onb-ink)]">{dream.name}</b>
                    </p>
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2">
                  {dream && (
                    <div className="col-span-2 flex items-center gap-3 rounded-[14px] border border-[var(--onb-line)] bg-[var(--onb-glass-2)] px-3 py-2.5">
                      <UniversityBadge id={dream.id} name={dream.name} logo={dream.logo_url} size={34} />
                      <div className="min-w-0">
                        <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--onb-ink-3)]">Dream university</dt>
                        <dd className="truncate text-[14.5px] font-semibold">{dream.name}</dd>
                      </div>
                    </div>
                  )}
                  <Summary label="Goal score" value={String(tgt.math + tgt.rw)} />
                  {/* On phones only the dream and the goal, so the road on the globe shows. */}
                  <Summary label="Current score" value={currentTotal != null ? String(currentTotal) : 'Not yet'} />
                  <Summary wide label="Test date" value={dates && dates.length ? dates.map((d) => formatDate(d)).join(', ') : 'Not decided'} />
                  <Summary wide label="Weekly plan" value={`${days.length} × ${minutes} min`} />
                  {focus !== 'english' && <Summary wide label="Math roadmap" value={LEVEL_LABEL[levelFor(sections?.math ?? null)]} />}
                  {focus !== 'math' && <Summary wide label="English roadmap" value={LEVEL_LABEL[levelFor(sections?.rw ?? null)]} />}
                </dl>
                {save.isError && <p className="mt-4 rounded-[12px] bg-[rgba(255,90,90,0.15)] px-3 py-2.5 text-[14px] text-[#ffb4b4]">{describeError(save.error)}</p>}
              </div>
            )}
          </Panel>
        )}
      </main>

      {!building && name !== 'welcome' && (
        <footer className="relative z-10 mx-auto flex w-full max-w-[560px] items-center justify-between px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3">
          <button type="button" onClick={() => go(step - 1)} className="flex h-11 items-center gap-1 rounded-full px-3 text-[15px] font-semibold text-[var(--onb-ink-2)] hover:bg-white/10 hover:text-[var(--onb-ink)]">
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
          {name === 'dream' && browsing && !dream ? (
            <button type="button" onClick={next} className="h-11 rounded-full px-4 text-[14px] font-semibold text-[var(--onb-ink-2)] hover:bg-white/10 hover:text-[var(--onb-ink)]">
              I’m not sure yet
            </button>
          ) : name === 'finale' ? (
            <button type="button" onClick={build} className="cta flex h-12 items-center gap-2 rounded-full px-6 text-[15.5px] font-bold">
              Build my roadmap <ArrowRight size={17} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" onClick={next} disabled={!canContinue[name]} className="cta flex h-12 items-center gap-2 rounded-full px-6 text-[15.5px] font-bold">
              {name === 'dream' ? 'This is my dream' : 'Continue'} <ArrowRight size={17} aria-hidden="true" />
            </button>
          )}
        </footer>
      )}
    </div>
  );
}

function Progress({ at }: { at: number }) {
  return (
    <div className="flex items-center gap-3" aria-label={`Question ${at} of ${QUESTIONS}`}>
      <div className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
        {Array.from({ length: QUESTIONS }, (_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i + 1 === at ? 'w-6 bg-[var(--onb-gold)]' : i + 1 < at ? 'w-1.5 bg-[var(--onb-gold)]/60' : 'w-1.5 bg-white/20'}`} />
        ))}
      </div>
      <span className="text-[13px] font-semibold text-[var(--onb-ink-2)] tabular">
        {Math.min(at, QUESTIONS)} of {QUESTIONS}
      </span>
    </div>
  );
}

function Welcome({ count, countries, onStart }: { count: number; countries: number; onStart: () => void }) {
  return (
    <section className="rise pointer-events-auto mx-auto mt-[4vh] flex w-full max-w-[640px] flex-col items-center text-center md:mt-[8vh]">
      <Mascot pose="wave" size={120} />
      <h1 className="mt-2 text-[34px] font-bold leading-[1.1] tracking-[-0.03em] md:text-[52px]">Where will your SAT take you?</h1>
      <p className="mt-3 max-w-[480px] text-[16px] leading-6 text-[var(--onb-ink-2)] md:text-[17px]">Choose your dream university. We’ll build the road there from Tashkent, lesson by lesson.</p>
      {count > 0 && (
        <p className="mt-4 text-[13px] font-semibold text-[var(--onb-ink-3)]">
          {count.toLocaleString('en-US')} universities · {countries} countries
        </p>
      )}
      <button type="button" onClick={onStart} className="cta mt-6 flex h-[52px] items-center gap-2 rounded-full px-7 text-[16px] font-bold">
        <Compass size={18} aria-hidden="true" /> Choose my dream
      </button>
    </section>
  );
}

/** The glass the questions float on; `side` keeps it to the left on laptops, so the globe shows. */
function Panel({ children, side = false }: { children: ReactNode; side?: boolean }) {
  return (
    <div className={`glass pointer-events-auto max-h-[calc(100dvh-170px)] w-full overflow-y-auto overscroll-contain rounded-[22px] p-5 md:p-6 ${side ? 'mx-auto max-w-[520px] md:mx-0 md:w-[420px]' : 'mx-auto max-w-[520px] md:mt-[2vh]'}`}>
      {children}
    </div>
  );
}

function Question({ title, hint, icon: I, children }: { title: string; hint?: string; icon?: typeof Plus; children: ReactNode }) {
  return (
    <section className="rise">
      {I && (
        <span className="mb-3 flex size-10 items-center justify-center rounded-[11px] bg-[rgba(246,195,67,0.15)] text-[var(--onb-gold)]">
          <I size={19} aria-hidden="true" />
        </span>
      )}
      <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] md:text-[26px]">{title}</h1>
      {hint && <p className="mt-1.5 text-[14.5px] text-[var(--onb-ink-2)]">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Tile({ on, onClick, children, className = '' }: { on: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`choice min-h-[52px] rounded-[16px] px-3 py-2.5 text-[15px] font-semibold ${className}`}>
      {children}
    </button>
  );
}

/** An SAT date as a calendar leaf, with how far away it is. */
function DateLeaf({ date, expected, now, on, onClick }: { date: string; expected: boolean; now: number; on: boolean; onClick: () => void }) {
  const d = new Date(`${date}T00:00:00Z`);
  const days = Math.max(0, Math.ceil((d.getTime() - now) / 86_400_000));
  const away = days === 0 ? 'today' : days < 21 ? `${days} ${days === 1 ? 'day' : 'days'} away` : `${Math.round(days / 7)} weeks away`;
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-GB', { timeZone: 'UTC', ...o });
  return (
    <button type="button" aria-pressed={on} aria-label={`${part({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${away}${expected ? ', expected' : ''}`} onClick={onClick} className="choice relative flex items-center gap-3 rounded-[16px] p-3 text-left">
      <span className="flex w-[52px] shrink-0 flex-col overflow-hidden rounded-[11px] border border-[var(--onb-line)] text-center">
        <span className={`py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] ${on ? 'bg-[var(--onb-gold)] text-[var(--onb-gold-ink)]' : 'bg-white/10 text-[var(--onb-gold)]'}`}>{part({ month: 'short' })}</span>
        <span className="py-0.5 text-[22px] font-bold leading-7 tabular">{d.getUTCDate()}</span>
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold">
          {part({ weekday: 'long' })} <span className="text-[var(--onb-ink-3)]">{d.getUTCFullYear()}</span>
        </span>
        <span className="block text-[12.5px] text-[var(--onb-ink-2)]">
          {away}
          {expected && ' · expected'}
        </span>
      </span>
      {on && (
        <span className="absolute right-2 top-2 flex size-[18px] items-center justify-center rounded-full bg-[var(--onb-gold)] text-[var(--onb-gold-ink)]">
          <Check size={11} strokeWidth={3.5} aria-hidden="true" />
        </span>
      )}
    </button>
  );
}

function FocusCard({ on, onClick, icon: I, title, sub, wide = false }: { on: boolean; onClick: () => void; icon: typeof Plus; title: string; sub: string; wide?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`choice relative flex rounded-[18px] p-4 text-left ${wide ? 'col-span-2 items-center gap-3.5' : 'min-h-[132px] flex-col justify-between'}`}>
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-[13px] ${on ? 'bg-[var(--onb-gold)] text-[var(--onb-gold-ink)] shadow-[0_0_24px_rgba(246,195,67,0.5)]' : 'bg-white/10 text-[var(--onb-ink-2)]'}`}>
        <I size={21} aria-hidden="true" />
      </span>
      <span>
        <span className="block text-[16px] font-bold leading-5">{title}</span>
        <span className="mt-0.5 block text-[12.5px] text-[var(--onb-ink-2)]">{sub}</span>
      </span>
      {on && (
        <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-[var(--onb-gold)] text-[var(--onb-gold-ink)]">
          <Check size={12} strokeWidth={3.5} aria-hidden="true" />
        </span>
      )}
    </button>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-1">
      <dd className="text-[17px] font-bold leading-6 tabular">{value}</dd>
      <dt className="text-[11.5px] text-[var(--onb-ink-2)]">{label}</dt>
    </div>
  );
}

function SectionTarget({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-[16px] border border-[var(--onb-line)] bg-[var(--onb-glass-2)] p-3 text-center">
      <p className="whitespace-nowrap text-[10.5px] font-bold uppercase tracking-[0.03em] text-[var(--onb-ink-3)]">{label}</p>
      <div className="mt-1 flex items-center justify-between">
        <Stepper small label={`Lower ${label}`} onClick={() => onChange(clamp(value - 10, 200, 800))} icon={Minus} />
        <span className="text-[24px] font-bold tabular">{value}</span>
        <Stepper small label={`Raise ${label}`} onClick={() => onChange(clamp(value + 10, 200, 800))} icon={Plus} />
      </div>
    </div>
  );
}

function Stepper({ label, onClick, icon: I, small = false }: { label: string; onClick: () => void; icon: typeof Plus; small?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`choice flex shrink-0 items-center justify-center rounded-full ${small ? 'size-8' : 'size-11'}`}>
      <I size={small ? 15 : 18} aria-hidden="true" />
    </button>
  );
}

function Summary({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 rounded-[14px] border border-[var(--onb-line)] bg-[var(--onb-glass-2)] px-3 py-2.5 ${wide ? 'hidden md:block' : ''}`}>
      <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--onb-ink-3)]">{label}</dt>
      <dd className="truncate text-[14.5px] font-semibold">{value}</dd>
    </div>
  );
}
