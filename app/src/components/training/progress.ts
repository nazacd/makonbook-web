import { BookOpen, Crown, Flame, Gauge, Rocket, Sigma, Sparkles, Star, Target, type LucideIcon } from 'lucide-react';

import type { Answered, DomainSummary, SkillSummary } from '@/lib/practice/mistakes';
import type { Subject } from '@/lib/practice/types';
import { addDays, schoolDate } from '@/lib/schedule';

// The Training Hall's game layer, worked out in the browser from what the
// student did: finished tests and resolved questions make a streak, and nine
// trophies come from counts. Nothing here is stored; it is all derived.

/** A subtopic counts as mastered at 100% once it has been seen at least this often. */
export const MASTERED_SEEN = 3;

export type Totals = {
  seen: number;
  /** Questions still to repair. */
  left: number;
  /** (seen − left) / seen; 0 with nothing seen. */
  mastery: number;
  /** Subtopics tracked, and those with something to repair. */
  skills: number;
  toDrill: number;
  /** Subtopics seen often enough to be mastered, and those at 100%. */
  eligible: number;
  mastered: number;
  /** The best mastery of a whole topic. */
  bestDomain: number;
  bySubject: Partial<Record<Subject, { seen: number; mastery: number }>>;
};

export function totalsOf(domains: DomainSummary[]): Totals {
  const skills = domains.flatMap((d) => d.skills);
  const seen = domains.reduce((n, d) => n + d.seen, 0);
  const left = domains.reduce((n, d) => n + d.repair, 0);
  const bySubject: Totals['bySubject'] = {};
  for (const subject of ['math', 'english'] as const) {
    const mine = domains.filter((d) => d.subject === subject);
    const s = mine.reduce((n, d) => n + d.seen, 0);
    if (s) bySubject[subject] = { seen: s, mastery: (s - mine.reduce((n, d) => n + d.repair, 0)) / s };
  }
  const eligible = skills.filter((s) => s.seen >= MASTERED_SEEN);
  return {
    seen,
    left,
    mastery: seen ? (seen - left) / seen : 0,
    skills: skills.length,
    toDrill: skills.filter((s) => s.repair.length > 0).length,
    eligible: eligible.length,
    mastered: eligible.filter((s) => s.mastery === 1).length,
    bestDomain: domains.reduce((m, d) => Math.max(m, d.mastery), 0),
    bySubject,
  };
}

/** Mastered subtopics, the latest first, with when they got there (their last answer or fix). */
export function masteredSkills(domains: DomainSummary[], answered: Answered[], resolved: Record<string, string>): { skill: SkillSummary; at: string }[] {
  const latest = new Map<string, string>();
  for (const a of answered) {
    const k = `${a.subject}|${a.domain}|${a.skill}`;
    const fixed = resolved[a.id];
    const at = fixed && fixed >= a.at ? fixed : a.at;
    if (at > (latest.get(k) ?? '')) latest.set(k, at);
  }
  return domains
    .flatMap((d) => d.skills)
    .filter((s) => s.seen >= MASTERED_SEEN && s.mastery === 1)
    .map((skill) => ({ skill, at: latest.get(`${skill.subject}|${skill.domain}|${skill.skill}`) ?? '' }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export type Streak = { current: number; best: number; /** Something done today already. */ today: boolean };

/**
 * Days in a row (school dates, Tashkent) with a finished test or a resolved
 * question. Today still counts as open: a streak that reached yesterday is
 * alive until today ends.
 */
export function streakOf(finished: string[], resolved: Record<string, string>, now: number): Streak {
  const days = new Set([...finished, ...Object.values(resolved)].map((t) => schoolDate(Date.parse(t))));
  const today = schoolDate(now);
  let day = days.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (days.has(day)) {
    current++;
    day = addDays(day, -1);
  }
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...days].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current), today: days.has(today) };
}

export type Trophy = {
  id: string;
  name: string;
  /** How to earn it, in a few words. */
  hint: string;
  icon: LucideIcon;
  /** A category colour (a CSS colour value). */
  accent: string;
  have: number;
  need: number;
  earned: boolean;
};

/** The nine trophies on the shelf, in shelf order. */
export function trophiesOf(t: Totals, resolvedCount: number, streak: Streak): Trophy[] {
  const pct = (v: number) => Math.round(v * 100);
  const math = t.bySubject.math;
  const english = t.bySubject.english;
  const make = (id: string, name: string, hint: string, icon: LucideIcon, accent: string, have: number, need: number, earned = have >= need): Trophy => ({
    id,
    name,
    hint,
    icon,
    accent,
    have: Math.min(have, need),
    need,
    earned,
  });
  return [
    make('first-master', 'First master', `Master a subtopic (100%, ${MASTERED_SEEN}+ questions)`, Star, 'var(--color-amber)', t.mastered, 1),
    make('streak-4', '4-day streak', 'Drill 4 days in a row', Flame, 'var(--color-orange)', streak.best, 4),
    make('resolved-10', '10 resolved', 'Resolve 10 questions', Target, 'var(--color-teal)', resolvedCount, 10),
    make('streak-5', '5-day streak', 'Drill 5 days in a row', Rocket, 'var(--color-orange)', streak.best, 5),
    make('math-master', 'Math master', 'Reach 80% mastery in SAT Math', Sigma, 'var(--color-math)', math ? pct(math.mastery) : 0, 80),
    make('perfectionist', 'Perfectionist', 'Take a whole topic to 100%', Sparkles, 'var(--color-violet)', pct(t.bestDomain), 100, t.seen > 0 && t.bestDomain === 1),
    make('half-way', 'Half-way', 'Reach 50% overall mastery', Gauge, 'var(--color-blue)', pct(t.mastery), 50),
    make('rw-master', 'R&W master', 'Reach 80% mastery in Reading & Writing', BookOpen, 'var(--color-english)', english ? pct(english.mastery) : 0, 80),
    make('full-clear', 'Full clear', 'Nothing left to repair', Crown, 'var(--color-green)', t.seen - t.left, Math.max(1, t.seen), t.seen > 0 && t.left === 0),
  ];
}

/** The locked trophy closest to earning (the earlier one on a tie), if any is left. */
export function nextTrophy(trophies: Trophy[]): Trophy | null {
  let next: Trophy | null = null;
  for (const t of trophies) if (!t.earned && (!next || t.have / t.need > next.have / next.need)) next = t;
  return next;
}
