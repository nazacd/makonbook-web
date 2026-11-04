import { ArrowRight, CircleCheck, List } from 'lucide-react';
import { Link } from 'react-router';

import { DRILL_SIZE, drillHref, type DomainSummary, type SkillSummary } from '@/lib/practice/mistakes';
import type { Subject } from '@/lib/practice/types';

// One topic (domain) of the Training Hall, as the reference draws it: a 76px
// header (icon tile, name, "SAT Math · N questions · M to repair", the
// percentage over a four-square meter), its subtopics two to a row, and a
// footer with the session that repairs it.

export const SUBJECT_NAME: Record<Subject, string> = { math: 'SAT Math', english: 'Reading & Writing' };

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Four 12px squares: one per quarter of mastery reached, never fewer than one. */
export function MasteryMeter({ value }: { value: number }) {
  const filled = Math.max(1, Math.min(4, Math.floor(value * 4)));
  return (
    <span className="flex gap-[3px]" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`size-3 rounded-[2px] ${i < filled ? 'bg-[#e24b4a]' : 'border border-line-strong'}`} />
      ))}
    </span>
  );
}

export function DomainCard({ domain: d }: { domain: DomainSummary }) {
  const clear = d.repair === 0;
  const session = Math.min(DRILL_SIZE, d.repair);
  // A topic that is its own only subtopic has nothing more to list.
  const rows = d.skills.length > 1 || d.skills[0]?.skill.toLowerCase() !== d.domain.toLowerCase() ? d.skills : [];
  return (
    <article className="overflow-hidden rounded-[18px] border border-line-strong bg-surface" aria-label={`${d.domain}, ${SUBJECT_NAME[d.subject]}, ${pct(d.mastery)} mastered`}>
      <header className="flex min-h-[76px] items-center gap-3.5 py-3 pl-4 pr-4 sm:pr-5">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-surface-2 ${d.subject === 'math' ? 'text-math' : 'text-english'}`}>
          <List size={15} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-medium leading-6 text-ink sm:truncate">{d.domain}</h2>
          <p className="mt-0.5 truncate text-[12px] font-medium leading-4 text-ink-3">
            {SUBJECT_NAME[d.subject]}
            <Dot />
            {d.seen} {d.seen === 1 ? 'question' : 'questions'}
            <Dot />
            {clear ? <span className="text-good">all clear</span> : <span className="text-accent">{d.repair} to repair</span>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`tabular text-[16px] font-medium leading-5 ${clear ? 'text-good' : 'text-accent'}`}>{pct(d.mastery)}</span>
          <MasteryMeter value={d.mastery} />
        </div>
      </header>

      {rows.length > 0 && (
        <ul className="grid grid-cols-1 gap-px border-t border-line bg-line xl:grid-cols-2">
          {rows.map((s) => (
            <li key={s.skill} className="bg-surface">
              <SkillRow skill={s} />
            </li>
          ))}
          {rows.length % 2 === 1 && <li aria-hidden="true" className="hidden bg-surface xl:block" />}
        </ul>
      )}

      <footer className="flex min-h-[58px] items-center justify-between gap-3 border-t border-line px-4 py-2.5 sm:pr-5">
        {clear ? (
          <>
            <span className="text-[12px] font-medium text-ink-3">Nothing left to repair here</span>
            <span className="inline-flex h-[30px] items-center gap-1.5 rounded-[20px] bg-good-tint px-3.5 text-[13px] font-semibold text-good">
              <CircleCheck size={15} strokeWidth={2.2} aria-hidden="true" />
              All clear
            </span>
          </>
        ) : (
          <>
            <span className="text-[12px] font-medium text-ink-3">
              {session} {session === 1 ? 'question' : 'questions'} in session
            </span>
            <Link
              to={drillHref({ subject: d.subject, domain: d.domain })}
              aria-label={`Start session: ${d.domain}`}
              className="lift group inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-[20px] bg-primary px-4 text-[13.5px] font-semibold text-on-primary hover:bg-primary-hover">
              Start session
              <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-[3px]" />
            </Link>
          </>
        )}
      </footer>
    </article>
  );
}

function Dot() {
  return (
    <span aria-hidden="true" className="mx-1.5 text-line-strong">
      ·
    </span>
  );
}

// A subtopic: its name, a thin bar, the percentage and a small red count of
// questions to repair (a dash when none). With some to repair it opens a
// session on that subtopic alone.
function SkillRow({ skill: s }: { skill: SkillSummary }) {
  const n = s.repair.length;
  const body = (
    <>
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink" title={s.skill}>
        {s.skill}
      </span>
      <span className="hidden h-[3px] w-[84px] shrink-0 overflow-hidden rounded-full bg-surface-2 min-[420px]:block" aria-hidden="true">
        <span className="block h-full rounded-full bg-primary transition-[width] duration-[400ms]" style={{ width: pct(s.mastery) }} />
      </span>
      <span className="tabular w-9 shrink-0 text-right text-[12px] font-medium text-ink-3">{pct(s.mastery)}</span>
      {n > 0 ? (
        <span className="tabular flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-bad-tint px-1.5 text-[11px] font-bold text-bad">{n}</span>
      ) : (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center text-[12px] text-ink-3" aria-hidden="true">
          —
        </span>
      )}
    </>
  );
  const label = `${s.skill}: ${pct(s.mastery)}, ${n ? `${n} to repair` : 'nothing to repair'}`;
  if (!n) {
    return (
      <div role="group" aria-label={label} className="flex h-[38px] items-center gap-3 px-4 xl:px-[22px]">
        {body}
      </div>
    );
  }
  return (
    <Link to={drillHref({ subject: s.subject, domain: s.domain, skill: s.skill })} aria-label={`${label}. Start a session on it`} className="flex h-[38px] items-center gap-3 px-4 transition-colors duration-150 hover:bg-surface-2 xl:px-[22px]">
      {body}
    </Link>
  );
}
