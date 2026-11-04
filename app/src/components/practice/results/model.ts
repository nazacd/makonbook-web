import { isCorrect, slotKey } from '@/lib/practice/grade';
import { stagesOf } from '@/lib/practice/run';
import type { AnswerInput, Package, PackageQuestion, Subject } from '@/lib/practice/types';

// A finished attempt, question by question, for the results page: what was
// given, whether it was right, how long it took, grouped by module in the
// order the test takes them.

export type Outcome = 'correct' | 'incorrect' | 'skipped';

export type ResultRow = {
  /** "math-2-14": the question's place in the test, as the URL names it. */
  slot: string;
  subject: Subject;
  module: number;
  position: number;
  q: PackageQuestion;
  given: string | null;
  outcome: Outcome;
  seconds: number;
};

export type ModuleResult = { subject: Subject; module: number; minutes: number; rows: ResultRow[] };

export function resultModules(pkg: Package, sections: Subject[], answers: AnswerInput[]): ModuleResult[] {
  const byslot = new Map(answers.map((a) => [slotKey(a.subject, a.module, a.position), a]));
  return stagesOf(pkg, sections).map((stage) => ({
    subject: stage.subject,
    module: stage.module.module,
    minutes: stage.module.minutes,
    rows: stage.module.questions.map((q) => {
      const slot = slotKey(stage.subject, stage.module.module, q.position);
      const a = byslot.get(slot);
      const given = a?.answer?.trim() ? a.answer.trim() : null;
      return { slot, subject: stage.subject, module: stage.module.module, position: q.position, q, given, outcome: !given ? 'skipped' : isCorrect(q, given) ? 'correct' : 'incorrect', seconds: a?.seconds ?? 0 };
    }),
  }));
}

/** The key: the letter, or a grid-in's first accepted form. */
export const keyOf = (q: PackageQuestion) => (q.type === 'mcq' ? (q.correct ?? '—') : (q.accepted?.[0] ?? '—'));

/** Every accepted form of a grid-in: "9 (also 9.0, 27/3)". */
export function acceptedLine(q: PackageQuestion): string {
  if (q.type === 'mcq') return q.correct ?? '—';
  const [first, ...rest] = q.accepted ?? [];
  if (!first) return '—';
  return rest.length ? `${first} (also ${rest.join(', ')})` : first;
}

/** The skills behind the questions still to repair, most first. */
export function weakestSkills(rows: ResultRow[], limit = 3): { skill: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const skill = r.q.skill || r.q.domain || 'Other';
    counts.set(skill, (counts.get(skill) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill))
    .slice(0, limit);
}
