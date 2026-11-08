import { ArrowLeft, ArrowRight, CalendarDays, Check, Calculator, BookOpenText, Layers, Minus, Plus, Signpost } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { LEVEL_LABEL, useSaveOnboarding, type Level, type Onboarding as Answers } from '@/api/roadmaps';
import { Wordmark } from '@/components/brand/Logo';
import { Spinner } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { SAT_DATES } from '@/lib/satDates';
import { useTitle } from '@/lib/title';

// Onboarding (free accounts): a few questions about their SAT, then the
// roadmap is built — each chosen subject at a level from its current score
// (below 450 Foundation, 450–590 Pre-SAT, 600+ Advanced; no score: Foundation).
// Full screen, one question at a time, like the reference.

const STEPS = 7;
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
  useTitle('Your roadmap');
  const me = useMe().data;
  const navigate = useNavigate();
  const save = useSaveOnboarding();
  const [step, setStep] = useState(0);
  const [graduation, setGraduation] = useState<string | null>(null);
  const [dates, setDates] = useState<string[] | null>(null); // [] = not decided
  const [current, setCurrent] = useState<Current>({ kind: 'total', total: 1000 });
  const [target, setTarget] = useState<{ math: number; rw: number } | null>(null);
  const [focus, setFocus] = useState<Answers['focus'] | null>(null);
  const [days, setDays] = useState<string[]>(['mon', 'wed', 'fri']);
  const [minutes, setMinutes] = useState<Answers['schedule']['minutes']>(30);

  if (me && (me.kind !== 'student' || me.status !== 'registered')) return <Navigate to="/roadmaps" replace />;

  const sections = current.kind === 'sections' ? { math: current.math, rw: current.rw } : current.kind === 'total' ? { math: round10(current.total / 2), rw: round10(current.total / 2) } : null;
  const currentTotal = sections ? sections.math + sections.rw : null;
  // The target starts 150 above today (or at 1100), split between the sections.
  const defaultTarget = () => {
    const base = currentTotal ?? 950;
    const t = clamp(round10(base + 150), 400, 1600);
    return { math: round10(t / 2), rw: t - round10(t / 2) };
  };
  const tgt = target ?? defaultTarget();

  const canContinue = [graduation != null, dates != null, true, true, focus != null, days.length > 0, true][step]!;
  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));

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
      },
      { onSuccess: (r) => void navigate(r.roadmaps.length === 1 ? `/roadmaps/${r.roadmaps[0]!.id}` : '/roadmaps', { replace: true }) },
    );
  }

  if (save.isPending || save.isSuccess) {
    return (
      <Frame step={STEPS - 1} chrome={false}>
        <div className="rise flex flex-col items-center py-16 text-center">
          <Spinner className="size-9 text-primary" />
          <h1 className="mt-6 text-[26px] font-semibold text-title">Building your roadmap</h1>
          <p className="t-subhead mt-1.5 max-w-sm text-ink-2">We’re setting up your plan, lesson by lesson. Please keep this page open.</p>
        </div>
      </Frame>
    );
  }

  return (
    <Frame
      step={step}
      footer={
        <>
          {step > 0 ? (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="t-subhead flex items-center gap-1 font-semibold text-ink-2 hover:text-ink">
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </button>
          ) : (
            <span />
          )}
          {step < STEPS - 1 ? (
            <button type="button" onClick={next} disabled={!canContinue} className="lift flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[15px] font-bold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-ink-3">
              Continue <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" onClick={build} className="lift flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[15px] font-bold text-on-primary hover:bg-primary-hover">
              Build my roadmap <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </>
      }>
      {step === 0 && (
        <Question title="When do you graduate from school?">
          <div className="grid grid-cols-2 gap-2.5">
            {['2027', '2028', '2029', '2030', '2031', '2032'].map((y) => (
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

      {step === 1 && (
        <Question title="When are you taking the SAT?" hint="Pick every date you might sit it.">
          <div className="flex flex-col gap-2">
            {SAT_DATES.map(({ date, expected }) => {
              const on = !!dates?.includes(date);
              return (
                <Row key={date} on={on} onClick={() => setDates((d) => (on ? (d ?? []).filter((x) => x !== date) : [...(d ?? []), date].sort()))} icon={<CalendarDays size={18} aria-hidden="true" />}>
                  {formatDate(date)}
                  {expected && <span className="ml-2 text-[12px] font-medium text-ink-3">expected</span>}
                </Row>
              );
            })}
            <Row on={dates?.length === 0} onClick={() => setDates([])} icon={<Layers size={18} aria-hidden="true" />}>
              I haven’t decided yet
            </Row>
          </div>
        </Question>
      )}

      {step === 2 && (
        <Question title="What is your score right now?" hint="From a real SAT or a full practice test. A guess is fine.">
          <div role="radiogroup" aria-label="Score" className="mb-5 flex rounded-full border border-line bg-surface-2 p-[3px]">
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
                className={`h-9 flex-1 rounded-full text-[13px] font-semibold ${current.kind === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`}>
                {label}
              </button>
            ))}
          </div>
          {current.kind === 'total' && <ScorePicker label="Total" value={current.total} min={400} max={1600} onChange={(total) => setCurrent({ kind: 'total', total })} />}
          {current.kind === 'sections' && (
            <div className="flex flex-col gap-5">
              <ScorePicker label="Math" value={current.math} min={200} max={800} onChange={(math) => setCurrent({ ...current, math })} />
              <ScorePicker label="Reading and Writing" value={current.rw} min={200} max={800} onChange={(rw) => setCurrent({ ...current, rw })} />
              <p className="t-subhead text-center text-ink-2">
                Total <b className="text-ink">{current.math + current.rw}</b>
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setCurrent({ kind: 'none' });
              setTarget(null);
              next();
            }}
            className={`mt-5 w-full rounded-card border p-4 text-left ${current.kind === 'none' ? 'border-primary bg-accent-tint' : 'border-line bg-surface hover:bg-surface-2'}`}>
            <p className="t-headline text-ink">I don’t have a score yet</p>
            <p className="t-footnote text-ink-2">You’ll start at Foundation. You can change it later.</p>
          </button>
        </Question>
      )}

      {step === 3 && (
        <Question title="What score are you aiming for?" hint={currentTotal != null ? `Today: ${currentTotal}. Most students who practise with a plan gain 100–200 points.` : 'Pick a goal; you can change it any time.'}>
          <div className="flex items-center justify-center gap-4">
            <Stepper label="Lower the target" onClick={() => setTarget({ math: clamp(tgt.math - 10, 200, 800), rw: tgt.rw })} icon={Minus} />
            <p className="t-number w-[150px] text-center text-[56px] leading-none text-ink">{tgt.math + tgt.rw}</p>
            <Stepper label="Raise the target" onClick={() => setTarget({ math: clamp(tgt.math + 10, 200, 800), rw: tgt.rw })} icon={Plus} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <SectionTarget label="Math" value={tgt.math} onChange={(math) => setTarget({ ...tgt, math })} />
            <SectionTarget label="Reading and Writing" value={tgt.rw} onChange={(rw) => setTarget({ ...tgt, rw })} />
          </div>
        </Question>
      )}

      {step === 4 && (
        <Question title="What do you want to focus on?" hint="Each subject gets its own roadmap.">
          <div className="flex flex-col gap-2.5">
            <Row on={focus === 'math'} onClick={() => setFocus('math')} icon={<Calculator size={18} aria-hidden="true" />} sub={sections ? `Starts at ${LEVEL_LABEL[levelFor(sections.math)]}` : 'Starts at Foundation'}>
              Math
            </Row>
            <Row on={focus === 'english'} onClick={() => setFocus('english')} icon={<BookOpenText size={18} aria-hidden="true" />} sub={sections ? `Starts at ${LEVEL_LABEL[levelFor(sections.rw)]}` : 'Starts at Foundation'}>
              Reading and Writing
            </Row>
            <Row on={focus === 'both'} onClick={() => setFocus('both')} icon={<Layers size={18} aria-hidden="true" />} sub="Two roadmaps, side by side">
              Both
            </Row>
          </div>
        </Question>
      )}

      {step === 5 && (
        <Question title="How often can you study?">
          <p className="t-micro mb-2.5 text-ink-3">Days</p>
          <div className="flex justify-between gap-1.5">
            {DAYS.map(([d, short]) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={d}
                  onClick={() => setDays((x) => (on ? x.filter((y) => y !== d) : [...x, d]))}
                  className={`flex size-11 items-center justify-center rounded-full border text-[13px] font-bold sm:size-12 ${on ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-ink-2 hover:bg-surface-2'}`}>
                  {short}
                </button>
              );
            })}
          </div>
          <p className="t-micro mb-2.5 mt-6 text-ink-3">Each session</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {MINUTES.map(([m, label]) => (
              <Tile key={m} on={minutes === m} onClick={() => setMinutes(m)}>
                <span className="block text-[20px] font-bold">{m}</span>
                <span className="block text-[12px] font-medium opacity-80">min · {label}</span>
              </Tile>
            ))}
          </div>
          <p className="t-subhead mt-5 rounded-card bg-surface-2 p-3.5 text-ink-2">
            {days.length} {days.length === 1 ? 'day' : 'days'} a week · <b className="text-ink">{Math.round((days.length * minutes) / 6) / 10} hours</b> a week · {7 - days.length} rest {7 - days.length === 1 ? 'day' : 'days'}
          </p>
        </Question>
      )}

      {step === 6 && (
        <div className="rise">
          <div className="flex flex-col items-center text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-good-tint text-good">
              <Check size={30} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-[28px] font-semibold leading-9 tracking-[-0.02em] text-title">Your plan is ready</h1>
          </div>
          <dl className="mt-6 divide-y divide-line rounded-card border border-line bg-surface">
            <Summary label="Goal score" value={String(tgt.math + tgt.rw)} />
            <Summary label="Current score" value={currentTotal != null ? String(currentTotal) : 'Not yet'} />
            <Summary label="Test date" value={dates && dates.length ? dates.map((d) => formatDate(d)).join(', ') : 'Not decided'} />
            <Summary label="Weekly plan" value={`${days.length} × ${minutes} min`} />
            {focus !== 'english' && <Summary label="Math roadmap" value={LEVEL_LABEL[levelFor(sections?.math ?? null)]} />}
            {focus !== 'math' && <Summary label="English roadmap" value={LEVEL_LABEL[levelFor(sections?.rw ?? null)]} />}
          </dl>
          {save.isError && (
            <div className="mt-4">
              <Notice tone="error" message={describeError(save.error)} />
            </div>
          )}
        </div>
      )}
    </Frame>
  );
}

function Frame({ step, children, footer, chrome = true }: { step: number; children: ReactNode; footer?: ReactNode; chrome?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col bg-brand" style={{ background: 'radial-gradient(60% 40% at 50% 0%, var(--color-accent-tint), transparent 70%), var(--color-brand)' }}>
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        <Wordmark />
        {chrome && (
          <div className="flex items-center gap-3" aria-label={`Step ${step + 1} of ${STEPS}`}>
            <div className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
              {Array.from({ length: STEPS }, (_, i) => (
                <span key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : i < step ? 'w-2 bg-primary/60' : 'w-2 bg-line-strong'}`} />
              ))}
            </div>
            <span className="t-footnote font-semibold text-ink-2">
              {step + 1} of {STEPS}
            </span>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-[520px] flex-1 px-4 pb-6 pt-4 md:pt-10">{children}</main>
      {footer && <footer className="sticky bottom-0 mx-auto flex w-full max-w-[520px] items-center justify-between bg-brand/90 px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 backdrop-blur">{footer}</footer>}
    </div>
  );
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rise">
      <span className="mb-3 flex size-10 items-center justify-center rounded-[11px] bg-accent-tint text-primary">
        <Signpost size={19} aria-hidden="true" />
      </span>
      <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.02em] text-title">{title}</h1>
      {hint && <p className="t-subhead mt-1.5 text-ink-2">{hint}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Tile({ on, onClick, children, className = '' }: { on: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`min-h-[52px] rounded-card border px-3 py-2.5 text-[15px] font-semibold transition-colors ${on ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-ink hover:bg-surface-2'} ${className}`}>
      {children}
    </button>
  );
}

function Row({ on, onClick, icon, sub, children }: { on: boolean; onClick: () => void; icon: ReactNode; sub?: string; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`flex min-h-[56px] w-full items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors ${on ? 'border-primary bg-accent-tint' : 'border-line bg-surface hover:bg-surface-2'}`}>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${on ? 'bg-primary text-on-primary' : 'bg-surface-2 text-ink-2'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="t-headline block text-ink">{children}</span>
        {sub && <span className="t-footnote block text-ink-2">{sub}</span>}
      </span>
      <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-primary bg-primary text-on-primary' : 'border-line-strong'}`}>{on && <Check size={12} strokeWidth={3} aria-hidden="true" />}</span>
    </button>
  );
}

function ScorePicker({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-4">
        <Stepper label={`Lower ${label}`} onClick={() => onChange(clamp(value - 10, min, max))} icon={Minus} />
        <div className="w-[140px] text-center">
          <p className="t-micro text-ink-3">{label}</p>
          <p className="t-number text-[44px] leading-[1.1] text-ink">{value}</p>
        </div>
        <Stepper label={`Raise ${label}`} onClick={() => onChange(clamp(value + 10, min, max))} icon={Plus} />
      </div>
      <input type="range" min={min} max={max} step={10} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="mt-3 w-full accent-[var(--color-primary)]" />
      <div className="flex justify-between text-[11px] font-semibold text-ink-3">
        <span>{min}</span>
        <span>{(min + max) / 2}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function SectionTarget({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-card border border-line bg-surface p-3 text-center">
      <p className="t-micro text-ink-3">{label}</p>
      <div className="mt-1 flex items-center justify-between">
        <Stepper small label={`Lower ${label}`} onClick={() => onChange(clamp(value - 10, 200, 800))} icon={Minus} />
        <span className="t-number text-[24px] text-ink">{value}</span>
        <Stepper small label={`Raise ${label}`} onClick={() => onChange(clamp(value + 10, 200, 800))} icon={Plus} />
      </div>
    </div>
  );
}

function Stepper({ label, onClick, icon: I, small = false }: { label: string; onClick: () => void; icon: typeof Plus; small?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`flex shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-surface-2 ${small ? 'size-8' : 'size-11'}`}>
      <I size={small ? 15 : 18} aria-hidden="true" />
    </button>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="t-subhead text-ink-2">{label}</dt>
      <dd className="t-headline text-right text-ink">{value}</dd>
    </div>
  );
}
