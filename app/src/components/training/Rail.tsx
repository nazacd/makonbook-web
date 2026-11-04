import { ArrowRight, Flame, Lock, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { useMe } from '@/api/queries';
import { Avatar } from '@/components/Avatar';
import type { SkillSummary } from '@/lib/practice/mistakes';

import { SUBJECT_NAME } from './DomainCard';
import { nextTrophy, type Streak, type Totals, type Trophy } from './progress';

// The Training Hall's right rail, as the reference has it: your mini-card
// (overall mastery), the streak, the trophy shelf, the next trophy to unlock,
// recently mastered subtopics, and "Go to assessments →" at the bottom.

const pct = (v: number) => `${Math.round(v * 100)}%`;

function RailCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[18px] bg-surface-2 p-4 ${className}`}>{children}</section>;
}

function Bar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`block h-[5px] overflow-hidden rounded-full bg-line ${className}`} aria-hidden="true">
      <span className="block h-full rounded-full bg-fill-good transition-[width] duration-[400ms]" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </span>
  );
}

export function MasteryCard({ totals }: { totals: Totals }) {
  const me = useMe().data;
  return (
    <RailCard>
      <div className="flex items-center gap-3">
        {me && <Avatar kind={me.kind} firstName={me.first_name} lastName={me.last_name} id={me.id} size={36} />}
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold leading-[18px] text-ink">{me ? `${me.first_name} ${me.last_name}` : ''}</p>
          <p className="text-[12px] font-medium leading-4 text-ink-3">Mastery repair</p>
        </div>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-ink-3">Overall mastery</span>
        <span className="tabular text-[12px] font-bold text-ink">{pct(totals.mastery)}</span>
      </div>
      <Bar value={totals.mastery} className="mt-1.5" />
      <p className="mt-2 text-[12px] font-medium text-ink-3">
        {totals.mastered} of {totals.eligible} subtopics mastered
      </p>
    </RailCard>
  );
}

export function StreakCard({ streak }: { streak: Streak }) {
  const { current } = streak;
  return (
    <RailCard className="flex items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-watch-tint text-amber">
        <Flame size={16} strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-ink-3">
          <span className="tabular font-bold text-ink">{current}</span> day streak
        </p>
        <p className="mt-1 text-[12px] font-medium leading-4 text-ink-3">{current > 0 ? 'Keep drilling to extend it' : 'Drill a question to start one'}</p>
      </div>
    </RailCard>
  );
}

export function TrophyShelf({ trophies }: { trophies: Trophy[] }) {
  const earned = trophies.filter((t) => t.earned).length;
  return (
    <section aria-labelledby="trophy-shelf">
      <h2 id="trophy-shelf" className="t-micro mb-2 text-ink-3">
        Trophy shelf
      </h2>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-[12px] font-bold text-ink">Earned</span>
          <span className="tabular text-[12px] font-medium text-ink-3">
            {earned} of {trophies.length}
          </span>
        </div>
        <ul className="grid grid-cols-3 gap-px bg-line">
          {trophies.map((t) => (
            <li key={t.id} className="flex min-h-[86px] flex-col items-center gap-1.5 bg-surface px-1 pb-2.5 pt-3 text-center" title={`${t.name}: ${t.hint}${t.earned ? '' : ` (${t.have}/${t.need})`}`}>
              {t.earned ? (
                <span className="pop flex size-8 items-center justify-center rounded-[10px]" style={{ color: t.accent, background: `color-mix(in srgb, ${t.accent} 15%, transparent)` }}>
                  <t.icon size={16} strokeWidth={2} aria-hidden="true" />
                </span>
              ) : (
                <span className="flex size-8 items-center justify-center rounded-[10px] bg-surface-2 text-ink-3 opacity-60">
                  <Lock size={14} strokeWidth={1.9} aria-hidden="true" />
                </span>
              )}
              <span className={`max-w-[64px] text-[10.5px] font-medium leading-[13px] ${t.earned ? 'text-ink' : 'text-ink-3 opacity-70'}`}>{t.name}</span>
              <span className="sr-only">{t.earned ? ', earned' : `, locked: ${t.hint}`}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function NextTrophy({ trophies }: { trophies: Trophy[] }) {
  const next = nextTrophy(trophies);
  if (!next) return null;
  return (
    <section className="rounded-[18px] border border-line bg-surface px-4 py-3.5" aria-label="Next trophy to unlock">
      <p className="text-[12px] font-medium text-ink-3">Next trophy to unlock</p>
      <div className="mt-2.5 flex items-center gap-3" title={next.hint}>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-watch-tint text-amber">
          <Star size={15} strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{next.name}</span>
          <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <span className="block h-full rounded-full bg-amber" style={{ width: `${(next.have / next.need) * 100}%` }} />
          </span>
        </div>
        <span className="tabular shrink-0 text-[12px] font-medium text-ink-3">
          {next.have}/{next.need}
        </span>
      </div>
    </section>
  );
}

export function RecentlyMastered({ skills }: { skills: SkillSummary[] }) {
  if (skills.length === 0) return null;
  return (
    <section aria-labelledby="recently-mastered">
      <h2 id="recently-mastered" className="t-micro mb-2 text-ink-3">
        Recently mastered
      </h2>
      <ul className="flex flex-col gap-2">
        {skills.map((s) => (
          <li key={`${s.subject}|${s.domain}|${s.skill}`} className="flex items-center gap-2.5 rounded-[14px] bg-surface-2 px-3 py-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-good-tint text-good">
              <Star size={12} strokeWidth={2.4} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-ink">{s.skill}</span>
              <span className="block truncate text-[11px] font-medium text-ink-3">{SUBJECT_NAME[s.subject]}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AssessmentsButton({ className = '' }: { className?: string }) {
  return (
    <Link to="/practice" className={`lift flex h-[50px] items-center justify-center gap-2 whitespace-nowrap rounded-[25px] bg-primary px-3 text-[16px] font-semibold text-on-primary hover:bg-primary-hover ${className}`}>
      Go to assessments
      <ArrowRight size={20} strokeWidth={2.2} aria-hidden="true" />
    </Link>
  );
}
