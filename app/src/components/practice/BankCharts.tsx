import { BarChart3 } from 'lucide-react';
import { useState } from 'react';

import type { PracticeStats } from '@/api/practiceSets';

// The question bank's charts. Right answers are green, wrong red (the
// status hues), harder questions a darker step of the same hue; a legend,
// the 2px surface gaps and a tooltip with the counts carry the difficulty,
// and every chart has a table for screen readers.

type Week = PracticeStats['weeks'][number];
type Subject = PracticeStats['subjects']['math'];

const LEVELS = ['easy', 'medium', 'hard'] as const;
// Unrated questions count as medium in the trend.
const level = (m: Record<string, number>, d: (typeof LEVELS)[number]) => (m[d] ?? 0) + (d === 'medium' ? (m.unrated ?? 0) : 0);

export const TREND = {
  correct: { easy: '#4ade80', medium: '#16a34a', hard: '#166534' },
  wrong: { easy: '#fca5a5', medium: '#ef4444', hard: '#991b1b' },
};

const dayMonth = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Answers a week: wrong (red) under right (green), harder lower and darker in each. */
export function WeeklyTrend({ weeks }: { weeks: Week[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = weeks.map((w) => LEVELS.reduce((n, d) => n + level(w.correct, d) + level(w.wrong, d), 0));
  const max = Math.max(...totals);
  const empty = max === 0;
  const top = empty ? 16 : Math.max(4, Math.ceil(max / 4) * 4);
  const ticks = [0, top / 4, top / 2, (3 * top) / 4, top];
  const H = 200;
  const placeholder = [9, 7, 10, 6, 11, 8, 12, 9];
  return (
    <div>
      <div className="relative flex gap-2" style={{ height: H + 28 }}>
        <div className="t-caption tabular relative w-7 shrink-0 text-right text-ink-3" style={{ height: H }} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: H - (t / top) * H }}>
              {t}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {ticks.map((t) => (
            <span key={t} className="absolute inset-x-0 h-px bg-line" style={{ top: H - (t / top) * H }} aria-hidden="true" />
          ))}
          <div className="absolute inset-x-0 top-0 flex items-end justify-around" style={{ height: H }}>
            {weeks.map((w, i) => {
              const parts = empty
                ? [{ key: 'p', n: placeholder[i % placeholder.length]!, color: 'var(--color-surface-2)' }]
                : [
                    ...[...LEVELS].reverse().map((d) => ({ key: `w-${d}`, n: level(w.wrong, d), color: TREND.wrong[d] })),
                    ...[...LEVELS].reverse().map((d) => ({ key: `c-${d}`, n: level(w.correct, d), color: TREND.correct[d] })),
                  ].filter((p) => p.n > 0);
              return (
                <div key={w.week} className="relative flex h-full w-full max-w-[56px] flex-col items-center justify-end px-1" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <div className="flex w-full max-w-[24px] flex-col-reverse gap-[2px]">
                    {parts.map((p, k) => (
                      <span key={p.key} className={k === parts.length - 1 ? 'rounded-t-[4px]' : ''} style={{ height: Math.max(2, (p.n / top) * H - 2), background: p.color }} />
                    ))}
                  </div>
                  {hover === i && !empty && totals[i]! > 0 && (
                    <div role="tooltip" className="t-caption pointer-events-none absolute bottom-full z-10 mb-2 w-40 rounded-control border border-line bg-surface p-2.5 text-ink shadow-lg">
                      <p className="font-bold">Week of {dayMonth(w.week)}</p>
                      {LEVELS.map((d) => (
                        <p key={d} className="flex justify-between gap-2 capitalize text-ink-2">
                          <span>{d}</span>
                          <span className="tabular">
                            {level(w.correct, d)} right · {level(w.wrong, d)} wrong
                          </span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="t-caption absolute inset-x-0 flex justify-around text-ink-3" style={{ top: H + 8 }} aria-hidden="true">
            {weeks.map((w, i) => (
              <span key={w.week} className={`w-full max-w-[56px] whitespace-nowrap text-center ${i % 2 ? 'invisible sm:visible' : ''}`}>
                {dayMonth(w.week)}
              </span>
            ))}
          </div>
          {empty && (
            <div className="absolute inset-x-0 top-0 flex flex-col items-center justify-center text-center" style={{ height: H }}>
              <span className="flex size-10 items-center justify-center rounded-control border border-line bg-surface text-ink-2">
                <BarChart3 size={18} aria-hidden="true" />
              </span>
              <p className="t-headline mt-2 text-ink">Not enough data yet</p>
              <p className="t-footnote max-w-[220px] text-ink-2">Answer on any day and your trend will fill in here.</p>
            </div>
          )}
        </div>
      </div>
      {!empty && (
        <div className="t-footnote mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-ink-2">
          {(['correct', 'wrong'] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              {LEVELS.map((d) => (
                <span key={d} className="size-2.5 rounded-[3px]" style={{ background: TREND[k][d] }} />
              ))}
              {k === 'correct' ? 'Right' : 'Wrong'} · easy to hard, light to dark
            </span>
          ))}
        </div>
      )}
      <table className="sr-only">
        <caption>Answers per week</caption>
        <thead>
          <tr>
            <th>Week of</th>
            <th>Right</th>
            <th>Wrong</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.week}>
              <td>{dayMonth(w.week)}</td>
              <td>{LEVELS.reduce((n, d) => n + level(w.correct, d), 0)}</td>
              <td>{LEVELS.reduce((n, d) => n + level(w.wrong, d), 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const pct = (c: number, n: number) => (n ? Math.round((100 * c) / n) : 0);
const band = (p: number) => (p >= 85 ? 'var(--color-fill-good)' : p >= 60 ? 'var(--color-fill-watch)' : 'var(--color-fill-bad)');

/** Accuracy per domain: a track with a dot at the share right, in its band's colour. */
export function TopicAccuracy({ subject }: { subject: Subject }) {
  const rows = subject.domains;
  return (
    <div>
      <div className="t-caption mb-2 flex justify-end gap-3 text-ink-3">
        {[
          ['≥ 85%', 'var(--color-fill-good)'],
          ['60–84%', 'var(--color-fill-watch)'],
          ['< 60%', 'var(--color-fill-bad)'],
        ].map(([l, c]) => (
          <span key={l} className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: c }} />
            {l}
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="t-subhead py-6 text-center text-ink-3">No answers yet. Topics show up here as you practise.</p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {rows.map((d) => {
            const p = pct(d.correct, d.answers);
            return (
              <li key={d.domain} className="grid grid-cols-[minmax(0,1fr)_minmax(0,40%)_3rem] items-center gap-3">
                <span className="min-w-0">
                  <span className="t-subhead block truncate text-ink">{d.domain}</span>
                  <span className="t-caption text-ink-3">
                    {d.answers} {d.answers === 1 ? 'attempt' : 'attempts'}
                  </span>
                </span>
                <span className="relative h-1.5 rounded-full bg-track" role="img" aria-label={`${p}% right`}>
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${p}%`, background: band(p) }} />
                  <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface" style={{ left: `${p}%`, background: band(p) }} />
                </span>
                <span className="t-number text-right text-[20px] leading-6 text-ink">
                  {p}
                  <span className="text-[12px] text-ink-3">%</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const STEP = { easy: 'color-mix(in srgb, var(--color-primary) 35%, var(--color-surface))', medium: 'color-mix(in srgb, var(--color-primary) 68%, var(--color-surface))', hard: 'var(--color-primary)' };
const clock = (s: number) => {
  const r = Math.round(s);
  return r >= 60 ? `${Math.floor(r / 60)}m ${String(r % 60).padStart(2, '0')}s` : `${r}s`;
};

/** A ring with up to three segments and a figure in the middle. */
function Ring({ parts, label, sub }: { parts: { value: number; color: string }[]; label: string; sub: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((n, p) => n + p.value, 0);
  let at = 0;
  return (
    <div className="relative size-[132px] shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-track)" strokeWidth="11" />
        {total > 0 &&
          parts.map((p, i) => {
            const len = (p.value / total) * c;
            const seg = (
              <circle key={i} cx="60" cy="60" r={r} fill="none" stroke={p.color} strokeWidth="11" strokeDasharray={`${Math.max(0, len - 3)} ${c}`} strokeDashoffset={-at} />
            );
            at += len;
            return seg;
          })}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="t-number text-[20px] leading-6 text-ink">{label}</span>
        <span className="t-caption text-ink-3">{sub}</span>
      </span>
    </div>
  );
}

/** Time share by difficulty: the ring splits the time spent; rows give the average a question, with the site's in grey. */
export function TimeByDifficulty({ subject }: { subject: Subject }) {
  const rows = subject.difficulty;
  const timed = rows.filter((d) => d.avg_seconds != null);
  const spent = rows.map((d) => (d.avg_seconds ?? 0) * d.answers);
  const all = spent.reduce((a, b) => a + b, 0);
  const n = timed.reduce((a, d) => a + d.answers, 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <Ring parts={rows.map((d, i) => ({ value: spent[i]!, color: STEP[d.difficulty] }))} label={n ? clock(all / n) : '–'} sub="a question" />
      <Rows
        rows={rows.map((d) => ({
          key: d.difficulty,
          color: STEP[d.difficulty],
          value: d.avg_seconds != null ? clock(d.avg_seconds) : '–',
          site: d.site_avg_seconds != null ? `avg ${clock(d.site_avg_seconds)}` : null,
        }))}
      />
    </div>
  );
}

/** Accuracy by difficulty: the ring is the overall share right; rows give each difficulty's, with the site's in grey. */
export function AccuracyByDifficulty({ subject }: { subject: Subject }) {
  const rows = subject.difficulty;
  const answers = rows.reduce((a, d) => a + d.answers, 0);
  const correct = rows.reduce((a, d) => a + d.correct, 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <Ring parts={answers ? [{ value: correct, color: 'var(--color-fill-good)' }, { value: answers - correct, color: 'var(--color-track)' }] : []} label={answers ? `${pct(correct, answers)}%` : '–'} sub="right" />
      <Rows
        rows={rows.map((d) => ({
          key: d.difficulty,
          color: STEP[d.difficulty],
          value: d.answers ? `${pct(d.correct, d.answers)}%` : '–',
          site: d.site_accuracy != null ? `avg ${Math.round(d.site_accuracy * 100)}%` : null,
        }))}
      />
    </div>
  );
}

function Rows({ rows }: { rows: { key: string; color: string; value: string; site: string | null }[] }) {
  return (
    <ul className="flex w-full flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.key} className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-0">
          <span className="t-subhead flex items-center gap-2 capitalize text-ink-2">
            <span className="size-2.5 rounded-full" style={{ background: r.color }} />
            {r.key}
          </span>
          <span className="text-right">
            <span className="t-number block text-[20px] leading-6 text-ink">{r.value}</span>
            {r.site && <span className="t-caption text-ink-3">{r.site}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
