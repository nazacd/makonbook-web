import { ArrowLeft, ArrowRight, BookOpenText, CalendarDays, Calculator, Check, Compass, GraduationCap, Layers, Minus, Plus } from 'lucide-react';
import { Suspense, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { LEVEL_LABEL, useSaveOnboarding, type Level, type Onboarding as Answers } from '@/api/roadmaps';
import { satRange, suggestedTarget, useUniversities, type University } from '@/api/universities';
import { BRAND, ShieldMark } from '@/components/brand/Logo';
import { Spinner } from '@/components/Button';
import { Globe } from '@/components/globe/lazy';
import type { GlobeMode } from '@/components/globe/scene';
import { UniversityBadge } from '@/components/onboarding/Crest';
import { Mascot } from '@/components/onboarding/Mascot';
import { DreamStep as Dream } from '@/components/onboarding/DreamStep';
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
  ['mon', 'Mo'],
  ['tue', 'Tu'],
  ['wed', 'We'],
  ['thu', 'Th'],
  ['fri', 'Fr'],
  ['sat', 'Sa'],
  ['sun', 'Su'],
] as const;
const MINUTES = [
  [15, 'Casual'],
  [30, 'Regular'],
  [45, 'Serious'],
  [60, 'Intense'],
] as const;

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
  const navigate = useNavigate();
  const save = useSaveOnboarding();
  const universities = useUniversities();
  const [step, setStep] = useState(0);
  const [dream, setDream] = useState<University | null>(null);
  const [browsing, setBrowsing] = useState(true); // the picker is open (else the chosen card shows)
  const [look, setLook] = useState<{ lat: number; lng: number } | null>(null);
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
  const sections = current.kind === 'sections' ? { math: current.math, rw: current.rw } : current.kind === 'total' ? { math: round10(current.total / 2), rw: round10(current.total / 2) } : null;
  const currentTotal = sections ? sections.math + sections.rw : null;
  // The target starts at the dream university's (the middle of its admitted
  // range, or its minimum); else 150 above today (or 1100). Split evenly.
  const defaultTarget = () => {
    const fromDream = suggestedTarget(dream?.sat);
    const t = clamp(fromDream ?? round10((currentTotal ?? 950) + 150), 400, 1600);
    return { math: round10(t / 2), rw: t - round10(t / 2) };
  };
  const tgt = target ?? defaultTarget();

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
              <Question title="When do you graduate from school?" icon={GraduationCap}>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['2027', '2028', '2029', '2030', '2031', '2032'] as const).map((y) => (
                    <Tile
                      key={y}
                      on={graduation === y}
                      onClick={() => {
                        setGraduation(y);
                        next();
                      }}>
                      Class of {y}
                    </Tile>
                  ))}
                  <Tile
                    on={graduation === 'graduated'}
                    onClick={() => {
                      setGraduation('graduated');
                      next();
                    }}
                    className="col-span-2">
                    Already graduated
                  </Tile>
                </div>
              </Question>
            )}

            {name === 'dates' && (
              <Question title="When are you taking the SAT?" hint="Pick every date you might sit it." icon={CalendarDays}>
                <div className="flex flex-col gap-2">
                  {SAT_DATES.map(({ date, expected }) => {
                    const on = !!dates?.includes(date);
                    return (
                      <Row key={date} on={on} onClick={() => setDates((d) => (on ? (d ?? []).filter((x) => x !== date) : [...(d ?? []), date].sort()))} icon={<CalendarDays size={18} aria-hidden="true" />}>
                        {formatDate(date)}
                        {expected && <span className="ml-2 text-[12px] font-medium text-[var(--onb-ink-3)]">expected</span>}
                      </Row>
                    );
                  })}
                  <Row on={dates?.length === 0} onClick={() => setDates([])} icon={<Layers size={18} aria-hidden="true" />}>
                    I haven’t decided yet
                  </Row>
                </div>
              </Question>
            )}

            {name === 'current' && (
              <Question title="What is your score right now?" hint="From a real SAT or a full practice test. A guess is fine.">
                <div role="radiogroup" aria-label="Score" className="mb-5 flex rounded-full border border-[var(--onb-line)] bg-[var(--onb-glass-2)] p-[3px]">
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
                {current.kind === 'total' && <ScorePicker label="Total" value={current.total} min={400} max={1600} onChange={(total) => setCurrent({ kind: 'total', total })} />}
                {current.kind === 'sections' && (
                  <div className="flex flex-col gap-5">
                    <ScorePicker label="Math" value={current.math} min={200} max={800} onChange={(math) => setCurrent({ ...current, math })} />
                    <ScorePicker label="Reading and Writing" value={current.rw} min={200} max={800} onChange={(rw) => setCurrent({ ...current, rw })} />
                    <p className="text-center text-[15px] text-[var(--onb-ink-2)]">
                      Total <b className="text-[var(--onb-ink)]">{current.math + current.rw}</b>
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  aria-pressed={current.kind === 'none'}
                  onClick={() => {
                    setCurrent({ kind: 'none' });
                    next();
                  }}
                  className="choice mt-5 w-full rounded-[16px] p-4 text-left">
                  <p className="text-[15px] font-semibold">I don’t have a score yet</p>
                  <p className="text-[13px] text-[var(--onb-ink-2)]">You’ll start at Foundation. You can change it later.</p>
                </button>
              </Question>
            )}

            {name === 'target' && (
              <Question
                title="What score are you aiming for?"
                hint={dream && suggestedTarget(dream.sat) != null && target == null ? `We started from ${dream.short_name ?? dream.name}’s admitted students.` : currentTotal != null ? `Today: ${currentTotal}. Students who practise with a plan often gain 100–200 points.` : 'Pick a goal; you can change it any time.'}>
                <div className="flex items-center justify-center gap-4">
                  <Stepper label="Lower the target" onClick={() => setTarget({ math: clamp(tgt.math - 10, 200, 800), rw: tgt.rw })} icon={Minus} />
                  <p className="w-[150px] text-center text-[56px] font-bold leading-none tabular text-[var(--onb-ink)]">{tgt.math + tgt.rw}</p>
                  <Stepper label="Raise the target" onClick={() => setTarget({ math: clamp(tgt.math + 10, 200, 800), rw: tgt.rw })} icon={Plus} />
                </div>
                <ScoreScale dream={dream} current={currentTotal} target={tgt.math + tgt.rw} />
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <SectionTarget label="Math" value={tgt.math} onChange={(math) => setTarget({ ...tgt, math })} />
                  <SectionTarget label="Reading and Writing" value={tgt.rw} onChange={(rw) => setTarget({ ...tgt, rw })} />
                </div>
              </Question>
            )}

            {name === 'focus' && (
              <Question title="What do you want to focus on?" hint="Each subject gets its own roadmap.">
                <div className="flex flex-col gap-2.5">
                  <Row on={focus === 'math'} onClick={() => setFocus('math')} icon={<Calculator size={18} aria-hidden="true" />} sub={`Starts at ${LEVEL_LABEL[levelFor(sections?.math ?? null)]}`}>
                    Math
                  </Row>
                  <Row on={focus === 'english'} onClick={() => setFocus('english')} icon={<BookOpenText size={18} aria-hidden="true" />} sub={`Starts at ${LEVEL_LABEL[levelFor(sections?.rw ?? null)]}`}>
                    Reading and Writing
                  </Row>
                  <Row on={focus === 'both'} onClick={() => setFocus('both')} icon={<Layers size={18} aria-hidden="true" />} sub="Two roadmaps, side by side">
                    Both
                  </Row>
                </div>
              </Question>
            )}

            {name === 'schedule' && (
              <Question title="How often can you study?">
                <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--onb-ink-3)]">Days</p>
                <div className="flex justify-between gap-1.5">
                  {DAYS.map(([d, short]) => {
                    const on = days.includes(d);
                    return (
                      <button key={d} type="button" aria-pressed={on} aria-label={d} onClick={() => setDays((x) => (on ? x.filter((y) => y !== d) : [...x, d]))} className="choice flex size-11 items-center justify-center rounded-full text-[13px] font-bold sm:size-12">
                        {short}
                      </button>
                    );
                  })}
                </div>
                <p className="mb-2.5 mt-6 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--onb-ink-3)]">Each session</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {MINUTES.map(([m, label]) => (
                    <Tile key={m} on={minutes === m} onClick={() => setMinutes(m)}>
                      <span className="block text-[20px] font-bold">{m}</span>
                      <span className="block text-[12px] font-medium opacity-80">min · {label}</span>
                    </Tile>
                  ))}
                </div>
                <p className="mt-5 rounded-[14px] bg-[var(--onb-glass-2)] p-3.5 text-[14px] text-[var(--onb-ink-2)]">
                  {days.length} {days.length === 1 ? 'day' : 'days'} a week · <b className="text-[var(--onb-ink)]">{Math.round((days.length * minutes) / 6) / 10} hours</b> a week · {7 - days.length} rest {7 - days.length === 1 ? 'day' : 'days'}
                </p>
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

/** The 400–1600 scale: the dream's admitted range, where the student is, where they aim. */
function ScoreScale({ dream, current, target }: { dream: University | null; current: number | null; target: number }) {
  const range = satRange(dream?.sat);
  const at = (v: number) => `${((clamp(v, 400, 1600) - 400) / 1200) * 100}%`;
  return (
    <div className="mt-6" aria-hidden="true">
      <div className="relative h-2.5 rounded-full bg-white/10">
        {range && <span className="absolute inset-y-0 rounded-full bg-[rgba(246,195,67,0.45)]" style={{ left: at(range.p25), width: `calc(${at(range.p75)} - ${at(range.p25)})` }} />}
        {current != null && <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--onb-sky)] bg-[#7fe3d4]" style={{ left: at(current) }} />}
        <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--onb-sky)] bg-[var(--onb-gold)] shadow-[0_0_14px_rgba(246,195,67,0.8)]" style={{ left: at(target) }} />
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-[var(--onb-ink-2)]">
        {current != null && (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#7fe3d4]" /> You today
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--onb-gold)]" /> Your goal
        </span>
        {range && dream && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-full bg-[rgba(246,195,67,0.45)]" /> {dream.short_name ?? 'Your dream'} admits {range.p25}–{range.p75}
          </span>
        )}
      </div>
    </div>
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

function Row({ on, onClick, icon, sub, children }: { on: boolean; onClick: () => void; icon: ReactNode; sub?: string; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="choice flex min-h-[56px] w-full items-center gap-3 rounded-[16px] px-4 py-3 text-left">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${on ? 'bg-[var(--onb-gold)] text-[var(--onb-gold-ink)]' : 'bg-white/10 text-[var(--onb-ink-2)]'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{children}</span>
        {sub && <span className="block text-[13px] text-[var(--onb-ink-2)]">{sub}</span>}
      </span>
      <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-[var(--onb-gold)] bg-[var(--onb-gold)] text-[var(--onb-gold-ink)]' : 'border-white/30'}`}>{on && <Check size={12} strokeWidth={3} aria-hidden="true" />}</span>
    </button>
  );
}

function ScorePicker({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-4">
        <Stepper label={`Lower ${label}`} onClick={() => onChange(clamp(value - 10, min, max))} icon={Minus} />
        <div className="w-[140px] text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--onb-ink-3)]">{label}</p>
          <p className="text-[44px] font-bold leading-[1.1] tabular">{value}</p>
        </div>
        <Stepper label={`Raise ${label}`} onClick={() => onChange(clamp(value + 10, min, max))} icon={Plus} />
      </div>
      <input type="range" min={min} max={max} step={10} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="mt-3 w-full accent-[var(--onb-gold)]" />
      <div className="flex justify-between text-[11px] font-semibold text-[var(--onb-ink-3)]">
        <span>{min}</span>
        <span>{(min + max) / 2}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function SectionTarget({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-[16px] border border-[var(--onb-line)] bg-[var(--onb-glass-2)] p-3 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--onb-ink-3)]">{label}</p>
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
