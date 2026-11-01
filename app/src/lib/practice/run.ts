// Copied from makonbook-mobile/src/lib/practice/run.ts (docs/handoff.md section 5):
// modules, timing, the finished attempt. Keep in step with the phone.

import { scoreAttempt, slotKey, totalOf } from './grade';
import type { LocalAttempt, Run } from './local';
import type { Package, PackageModule, PackageQuestion, Subject } from './types';

export const SUBJECT_LABEL: Record<Subject, string> = { english: 'Reading and Writing', math: 'Math' };

/** Where space is short: next to a score. */
export const SUBJECT_SHORT: Record<Subject, string> = { english: 'R&W', math: 'Math' };

/** "DAY1" -> "Day 1"; other titles as they are. Display only. */
export function testName(title: string): string {
  const day = /^day\s*(\d+)$/i.exec(title.trim());
  return day ? `Day ${Number(day[1])}` : title;
}

/** Several tests as one line: "Days 3–5", "Day 3", or "Diagnostic – Day 4". */
export function testRange(titles: string[]): string {
  const first = titles[0] ?? '';
  const last = titles[titles.length - 1] ?? '';
  if (titles.length <= 1) return testName(first);
  const a = /^day\s*(\d+)$/i.exec(first.trim());
  const b = /^day\s*(\d+)$/i.exec(last.trim());
  return a && b ? `Days ${Number(a[1])}–${Number(b[1])}` : `${testName(first)} – ${testName(last)}`;
}

/** A timed module, in the order a run takes them: Reading and Writing first, as in Bluebook. */
export type Stage = { subject: Subject; module: PackageModule };

export function stagesOf(pkg: Package, sections: Subject[]): Stage[] {
  return pkg.sections
    .filter((s) => sections.includes(s.subject))
    .flatMap((s) => s.modules.map((module) => ({ subject: s.subject, module })));
}

export function questionKey(stage: Stage, q: PackageQuestion): string {
  return slotKey(stage.subject, stage.module.module, q.position);
}

export function newRun(pkg: Package, sections: Subject[], id: string, now: Date): Run {
  return {
    id,
    code: pkg.code,
    title: pkg.title,
    version: pkg.version,
    sections: pkg.sections.map((s) => s.subject).filter((s) => sections.includes(s)),
    startedAt: now.toISOString(),
    stage: 0,
    ready: false,
    elapsedMs: 0,
    index: 0,
    answers: {},
    seconds: {},
    marked: [],
    eliminated: {},
  };
}

/** The finished attempt: every question of the sections taken (blank ones null), graded on the phone. */
export function finishRun(pkg: Package, run: Run, now: Date): LocalAttempt {
  const answers = stagesOf(pkg, run.sections).flatMap((stage) =>
    stage.module.questions.map((q) => {
      const key = questionKey(stage, q);
      const given = run.answers[key]?.trim();
      return {
        subject: stage.subject,
        module: stage.module.module,
        position: q.position,
        answer: given ? given : null,
        seconds: Math.min(21600, Math.round(run.seconds[key] ?? 0)),
      };
    }),
  );
  const scores = scoreAttempt(pkg, run.sections, answers);
  return {
    id: run.id,
    code: run.code,
    title: run.title,
    version: run.version,
    sections: run.sections,
    started_at: run.startedAt,
    finished_at: now.toISOString(),
    answers,
    scores,
    total: totalOf(scores),
    uploaded: false,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
