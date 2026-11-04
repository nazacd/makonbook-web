import { useQueries } from '@tanstack/react-query';
import { useMemo, useSyncExternalStore } from 'react';

import { isCorrect } from './grade';
import { packageQuery, useLocalAttempts, usePerson } from './hooks';
import type { LocalAttempt, StoredPackage } from './local';
import type { PackageQuestion, Subject } from './types';

// What the student's finished attempts say about each question: right or
// wrong, its domain and skill. The dashboard's "Incorrect questions" and the
// Training Hall are built on it. A question that comes up in several tests
// (the bank repeats some) counts once, by its latest answer.

export type Answered = {
  /** The question's id in the bank: the same question in two tests has one id. */
  id: string;
  attemptId: string;
  code: string;
  title: string;
  version: number;
  subject: Subject;
  module: number;
  position: number;
  domain: string;
  skill: string;
  difficulty: PackageQuestion['difficulty'];
  given: string | null;
  correct: boolean;
  /** When the attempt was finished. */
  at: string;
  question: PackageQuestion;
  /** The attempt's package, for drawing the question (images). */
  pkg: StoredPackage;
};

/** Every question of every finished attempt, latest answer per question. */
export function useAnswered() {
  const attempts = useLocalAttempts();
  const list = useMemo(() => (attempts.data ?? []).filter((a) => !a.rejected), [attempts.data]);
  // One package per test version the student has finished.
  const versions = useMemo(() => [...new Map(list.map((a) => [`${a.code}@${a.version}`, a])).values()], [list]);
  const packages = useQueries({
    queries: versions.map((a) => packageQuery(a.code, a.version)),
  });
  const ready = packages.every((p) => p.data || p.isError);
  const pkgData = packages.map((p) => p.data);
  const key = pkgData.map((p) => (p ? `${p.package.code}@${p.package.version}` : '-')).join(',');

  const answered = useMemo(() => {
    const byVersion = new Map<string, StoredPackage>();
    for (const p of pkgData) if (p) byVersion.set(`${p.package.code}@${p.package.version}`, p);
    const latest = new Map<string, Answered>();
    // Oldest first, so a later attempt's answer replaces an earlier one.
    for (const a of [...list].sort((x, y) => x.finished_at.localeCompare(y.finished_at))) {
      const pkg = byVersion.get(`${a.code}@${a.version}`);
      if (pkg) for (const item of answersOf(a, pkg)) latest.set(item.id, item);
    }
    return [...latest.values()];
    // pkgData changes identity every render; `key` says when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, key]);

  return { answered, isPending: attempts.isPending || !ready, attempts: list };
}

function answersOf(a: LocalAttempt, stored: StoredPackage): Answered[] {
  const given = new Map(a.answers.map((x) => [`${x.subject}-${x.module}-${x.position}`, x.answer]));
  const out: Answered[] = [];
  for (const section of stored.package.sections) {
    if (!a.sections.includes(section.subject)) continue;
    for (const mod of section.modules) {
      for (const q of mod.questions) {
        const answer = given.get(`${section.subject}-${mod.module}-${q.position}`) ?? null;
        out.push({
          id: q.id,
          attemptId: a.id,
          code: a.code,
          title: a.title,
          version: a.version,
          subject: section.subject,
          module: mod.module,
          position: q.position,
          domain: q.domain || 'Other',
          skill: q.skill || 'Other',
          difficulty: q.difficulty,
          given: answer,
          correct: isCorrect(q, answer),
          at: a.finished_at,
          question: q,
          pkg: stored,
        });
      }
    }
  }
  return out;
}

// Questions repaired in the Training Hall, kept in this browser per person:
// id → when. (Moves to the API with the accounts phase.)
const resolvedKey = (person: string) => `mb.training.${person}.resolved`;
const listeners = new Set<() => void>();
const cache = new Map<string, Record<string, string>>();

function readResolved(person: string): Record<string, string> {
  const hit = cache.get(person);
  if (hit) return hit;
  let value: Record<string, string>;
  try {
    value = JSON.parse(localStorage.getItem(resolvedKey(person)) ?? '{}') as Record<string, string>;
  } catch {
    value = {};
  }
  cache.set(person, value);
  return value;
}

export function markResolved(person: string, id: string) {
  const next = { ...readResolved(person), [id]: new Date().toISOString() };
  cache.set(person, next);
  try {
    localStorage.setItem(resolvedKey(person), JSON.stringify(next));
  } catch {
    // Kept for this visit only.
  }
  listeners.forEach((l) => l());
}

/** The questions this person repaired, by id → when. */
export function useResolved(): Record<string, string> {
  const person = usePerson();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => readResolved(person),
  );
}

/** A question to repair: answered wrong (or left blank) last time, and not repaired since. */
export function toRepair(answered: Answered[], resolved: Record<string, string>): Answered[] {
  return answered.filter((a) => !a.correct && !(resolved[a.id] && resolved[a.id]! >= a.at));
}

export type SkillSummary = {
  subject: Subject;
  domain: string;
  skill: string;
  seen: number;
  right: number;
  repair: Answered[];
  /** (right + repaired) / seen. */
  mastery: number;
};

export type DomainSummary = { subject: Subject; domain: string; skills: SkillSummary[]; seen: number; repair: number; mastery: number };

/** Per subject → domain → skill: how many seen, how many still to repair, the mastery. */
export function summarize(answered: Answered[], resolved: Record<string, string>): DomainSummary[] {
  const skills = new Map<string, SkillSummary>();
  const repair = new Set(toRepair(answered, resolved).map((a) => a.id));
  for (const a of answered) {
    const k = `${a.subject}|${a.domain}|${a.skill}`;
    const s = skills.get(k) ?? { subject: a.subject, domain: a.domain, skill: a.skill, seen: 0, right: 0, repair: [], mastery: 0 };
    s.seen++;
    if (repair.has(a.id)) s.repair.push(a);
    else s.right++;
    skills.set(k, s);
  }
  const domains = new Map<string, DomainSummary>();
  for (const s of skills.values()) {
    s.mastery = s.seen ? s.right / s.seen : 0;
    const k = `${s.subject}|${s.domain}`;
    const d = domains.get(k) ?? { subject: s.subject, domain: s.domain, skills: [], seen: 0, repair: 0, mastery: 0 };
    d.skills.push(s);
    d.seen += s.seen;
    d.repair += s.repair.length;
    domains.set(k, d);
  }
  for (const d of domains.values()) {
    d.mastery = d.seen ? (d.seen - d.repair) / d.seen : 0;
    d.skills.sort((a, b) => b.repair.length - a.repair.length || a.skill.localeCompare(b.skill));
  }
  return [...domains.values()].sort((a, b) => b.repair - a.repair || a.domain.localeCompare(b.domain));
}

// A drill session (/training-hall/drill): the questions to repair, narrowed
// to a subject, a domain or a skill (none: every mistake), at most DRILL_SIZE.

export const DRILL_SIZE = 20;

export type DrillFilter = { subject?: Subject; domain?: string; skill?: string };

/** The drill's address for a filter: "/training-hall/drill?subject=math&domain=Algebra". */
export function drillHref(f: DrillFilter = {}): string {
  const q = (['subject', 'domain', 'skill'] as const)
    .filter((k) => f[k])
    .map((k) => `${k}=${encodeURIComponent(f[k]!)}`)
    .join('&');
  return q ? `/training-hall/drill?${q}` : '/training-hall/drill';
}

/** The questions of a drill session: to repair, matching the filter, grouped by skill. */
export function drillQueue(answered: Answered[], resolved: Record<string, string>, f: DrillFilter = {}): Answered[] {
  return toRepair(answered, resolved)
    .filter((a) => (!f.subject || a.subject === f.subject) && (!f.domain || a.domain === f.domain) && (!f.skill || a.skill === f.skill))
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.domain.localeCompare(b.domain) || a.skill.localeCompare(b.skill) || b.at.localeCompare(a.at))
    .slice(0, DRILL_SIZE);
}
