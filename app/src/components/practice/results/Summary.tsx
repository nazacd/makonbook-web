import { ArrowRight, BarChart3, BookOpenText, CircleCheck, CircleX, Target, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { ShieldMark } from '@/components/brand/Logo';

import { REF } from './format';

// The results page's top (three counts as cards), the "Next step" card that
// sends the questions missed to the Training Hall, and the completion screen
// a test ends on. Laid out as the design reference has them.

type StatCard = { icon: LucideIcon; label: string; short: string; value: number; color: string };

/** Total, right and wrong (blanks count as wrong), each a card with a coloured chip and a big number. */
export function StatCards({ total, correct }: { total: number; correct: number }) {
  const cards: StatCard[] = [
    { icon: BookOpenText, label: 'Total questions', short: 'Total', value: total, color: REF.navy },
    { icon: CircleCheck, label: 'Correct answers', short: 'Correct', value: correct, color: REF.green },
    { icon: CircleX, label: 'Incorrect answers', short: 'Incorrect', value: total - correct, color: REF.red },
  ];
  return (
    <div className="grid grid-cols-3 gap-2.5 md:gap-[26px]">
      {cards.map((c) => (
        <section key={c.label} aria-label={`${c.label}: ${c.value}`} className="relative flex h-[112px] flex-col overflow-hidden rounded-card border border-line bg-surface p-2.5 md:h-[150px] md:p-[14px]">
          <span className="relative inline-flex w-fit max-w-full items-center gap-1.5 rounded-[8px] px-2 py-1 text-[12px] font-semibold text-white ring-1 ring-inset ring-white/15 md:gap-2 md:px-3 md:py-2.5 md:text-[15px]" style={{ background: c.color }}>
            <c.icon size={18} strokeWidth={2} aria-hidden="true" className="hidden shrink-0 sm:block" />
            <span className="truncate sm:hidden">{c.short}</span>
            <span className="hidden truncate sm:inline">{c.label}</span>
          </span>
          <p className="relative mt-auto text-[30px] font-semibold leading-none text-ink tabular md:mb-1 md:ml-0.5 md:text-[44px]" aria-hidden="true">
            {c.value}
          </p>
          <ShieldMark size={110} className="pointer-events-none absolute -bottom-6 -right-3 origin-bottom-right scale-[0.6] text-ink opacity-[0.07] md:scale-100" />
        </section>
      ))}
    </div>
  );
}

export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2.5 md:gap-[26px]" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="shimmer h-[112px] rounded-card md:h-[150px]" />
      ))}
    </div>
  );
}

/** "200 / 800" or "Correct 1" in a small bordered chip, as over each results table. */
export function Chip({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <span aria-label={label} className="inline-flex h-[34px] items-center gap-1 whitespace-nowrap rounded-[8px] border border-line bg-surface px-2.5 text-[14px] font-semibold text-ink tabular">
      {children}
    </span>
  );
}

/** The questions to try again: a purple card with the weakest skills and the way to the Training Hall. */
export function NextStep({ repair, skills, onLater }: { repair: number; skills: { skill: string; count: number }[]; onLater?: () => void }) {
  return (
    <section
      className="relative flex flex-col gap-3 overflow-hidden rounded-[14px] p-4 text-white shadow-[0_10px_30px_-12px_color-mix(in_srgb,var(--color-primary)_70%,transparent)] sm:flex-row sm:items-center sm:gap-5 sm:px-5"
      style={{ background: 'linear-gradient(120deg, var(--color-primary) 0%, var(--color-primary-deep) 100%)' }}
      aria-label="Next step">
      <div className="relative min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/80">
          <Target size={13} strokeWidth={2.2} aria-hidden="true" />
          Next step
        </p>
        <p className="mt-1.5 text-[17px] font-bold leading-6">
          <span className="text-[21px] font-extrabold tabular">{repair}</span> {repair === 1 ? 'question' : 'questions'} to try again
        </p>
        <p className="mt-1 text-[12.5px] font-medium leading-[18px] text-white/85">The same questions, one after another, like a test. This result stays as it is.</p>
        {skills.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Weakest skills">
            {skills.map((s) => (
              <li key={s.skill} className="inline-flex h-[22px] max-w-full items-center gap-1.5 rounded-full border border-white/35 bg-white/10 px-2.5 text-[11.5px] font-semibold">
                <span className="truncate">{s.skill}</span>
                <span className="font-bold tabular">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="relative flex shrink-0 flex-col items-center gap-1.5">
        <Link to="/training-hall/drill" className="lift inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-white px-5 text-[14px] font-bold text-primary">
          Start practice
          <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />
        </Link>
        {onLater && (
          <button type="button" onClick={onLater} className="h-7 rounded-full px-3 text-[12.5px] font-semibold text-white/85 hover:text-white">
            Later
          </button>
        )}
      </div>
    </section>
  );
}

const VERDICTS: [number, string][] = [
  [0.9, 'Outstanding'],
  [0.75, 'Great work'],
  [0.5, 'Solid progress'],
  [0, 'Room to grow'],
];

/** The ring of the share right, drawn in purple on a grey track. */
function Ring({ share }: { share: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[104px]">
      <svg viewBox="0 0 104 104" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="52" cy="52" r={r} fill="none" strokeWidth="8" className="stroke-line" />
        <circle cx="52" cy="52" r={r} fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset] duration-700" strokeDasharray={c} strokeDashoffset={c * (1 - share)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[32px] font-extrabold tracking-[-0.03em] text-ink tabular">{Math.round(share * 100)}%</span>
    </div>
  );
}

/** Where a finished test lands: the share right, the counts, the next step, and the way to the details. */
export function Completion({ name, total, correct, repair, skills, onDetails, onLater, showNext }: { name: string; total: number; correct: number; repair: number; skills: { skill: string; count: number }[]; onDetails: () => void; onLater: () => void; showNext: boolean }) {
  const share = total ? correct / total : 0;
  const verdict = VERDICTS.find(([at]) => share >= at)![1];
  return (
    <div className="rise mx-auto flex w-full max-w-[640px] flex-col items-center pt-6 text-center md:pt-14">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-2">Assessment complete</p>
      <div className="mt-4" role="img" aria-label={`${Math.round(share * 100)} percent right`}>
        <Ring share={share} />
      </div>
      <p className="mt-4 text-[15px] font-bold text-primary">{verdict}</p>
      <h1 className="mt-1.5 text-[15px] font-medium text-ink-2">{name}</h1>
      <p className="mt-4 flex flex-wrap justify-center gap-2">
        <CountPill value={total} word="total" color="var(--color-ink)" />
        <CountPill value={correct} word="correct" color={REF.green} />
        <CountPill value={total - correct} word="incorrect" color={REF.redText} />
      </p>
      {showNext && repair > 0 && (
        <div className="mt-6 w-full text-left">
          <NextStep repair={repair} skills={skills} onLater={onLater} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-2.5">
        <button type="button" onClick={onDetails} className="inline-flex h-10 min-w-[150px] items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-4 text-[14px] font-semibold text-ink transition-colors duration-150 hover:bg-surface-2">
          <BarChart3 size={16} strokeWidth={2} aria-hidden="true" />
          View details
        </button>
        <Link to="/practice" className="inline-flex h-10 min-w-[150px] items-center justify-center rounded-control border border-line-strong bg-surface px-4 text-[14px] font-semibold text-ink transition-colors duration-150 hover:bg-surface-2">
          Back to mock tests
        </Link>
      </div>
    </div>
  );
}

function CountPill({ value, word, color }: { value: number; word: string; color: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-surface px-3 text-[12px] font-medium text-ink-2">
      <span className="text-[13px] font-extrabold tabular" style={{ color }}>
        {value}
      </span>
      {word}
    </span>
  );
}
