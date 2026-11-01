// Copied from makonbook-mobile/src/lib/practice/grade.ts (docs/handoff.md section 5):
// must match the API's internal/practice/scoring.go. Keep in step with the phone.

import type { AnswerInput, Package, PackageQuestion, Score, Subject } from './types';

// Grading on the device, the same way the server grades an uploaded attempt
// (the API's internal/practice/scoring.go): the device shows results offline,
// the server's are the ones teachers see.

const NUMBER = /^-?(\d+(\.\d*)?|\.\d+)(\/\d+)?$/;

type Ratio = { n: bigint; d: bigint };

/** A grid-in answer as a fraction: an integer, a decimal or a fraction. */
export function parseNumber(s: string): Ratio | null {
  s = s.trim().replace(/−/g, '-');
  if (!NUMBER.test(s)) return null;
  const [num, den] = s.split('/');
  const negative = num!.startsWith('-');
  const [whole, frac = ''] = num!.replace('-', '').split('.');
  let n = BigInt((whole || '0') + frac);
  let d = 10n ** BigInt(frac.length);
  if (den !== undefined) {
    const by = BigInt(den);
    if (by === 0n) return null;
    d *= by;
  }
  if (negative) n = -n;
  return { n, d };
}

const normalize = (s: string) => s.trim().replace(/\s/g, '').replace(/−/g, '-');

/** Whether a student's answer is right: the letter, or for a grid-in one of the accepted forms or the same number. */
export function isCorrect(q: PackageQuestion, answer: string | null | undefined): boolean {
  const given = answer?.trim();
  if (!given) return false;
  if (q.type === 'mcq') return q.correct != null && given.toUpperCase() === q.correct.toUpperCase();
  const value = parseNumber(given);
  return (q.accepted ?? []).some((a) => {
    if (normalize(a) === normalize(given)) return true;
    const want = parseNumber(a);
    return want != null && value != null && want.n * value.d === value.n * want.d;
  });
}

/** Where a question sits in a test: "math-2-14". */
export function slotKey(subject: Subject, module: number, position: number): string {
  return `${subject}-${module}-${position}`;
}

/** The scores of each section taken, from the package's keys and scales. */
export function scoreAttempt(pkg: Package, sections: Subject[], answers: AnswerInput[]): Partial<Record<Subject, Score>> {
  const given = new Map(answers.map((a) => [slotKey(a.subject, a.module, a.position), a.answer]));
  const scores: Partial<Record<Subject, Score>> = {};
  for (const section of pkg.sections) {
    if (!sections.includes(section.subject)) continue;
    let raw = 0;
    let questions = 0;
    for (const m of section.modules) {
      for (const q of m.questions) {
        questions++;
        if (isCorrect(q, given.get(slotKey(section.subject, m.module, q.position)))) raw++;
      }
    }
    scores[section.subject] = { raw, questions, score: section.scale[raw] ?? 200 };
  }
  return scores;
}

export function totalOf(scores: Partial<Record<Subject, Score>>): number | null {
  return scores.english && scores.math ? scores.english.score + scores.math.score : null;
}
