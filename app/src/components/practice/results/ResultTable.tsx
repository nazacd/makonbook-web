import { Check, ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown, Flag, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { correctRate } from '@/api/learning';
import { Skeleton } from '@/components/States';
import type { Subject } from '@/lib/practice/types';

import { clock, clockWords, DIFFICULTY_COLOR, DIFFICULTY_LABEL, percent, REF, SECTION_LABEL } from './format';
import type { ModuleResult, ResultRow } from './model';
import { keyOf } from './model';
import { Chip } from './Summary';

// One module's questions as the design reference's results table: number,
// title, the key, the answer given (a green or red pill, or a grey
// "Omitted"), time, complexity (difficulty and the share of students right)
// and the actions. On a phone the table folds into a list of rows.

export type Stats = Map<string, { answered: number; correct: number }> | undefined;

type Sort = { key: 'question' | 'answer'; dir: 1 | -1 };
const RANK: Record<ResultRow['outcome'], number> = { incorrect: 0, skipped: 1, correct: 2 };

export function AnswerPill({ row, size = 'md' }: { row: ResultRow; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-[26px] text-[13px]' : 'h-8 text-[15px]';
  if (row.outcome === 'skipped') {
    return (
      <span className={`inline-flex items-center rounded-[6px] px-2.5 font-semibold text-white ${h}`} style={{ background: REF.omitted }}>
        Omitted
      </span>
    );
  }
  const right = row.outcome === 'correct';
  return (
    <span
      className={`inline-flex min-w-10 max-w-[140px] items-center justify-center rounded-[6px] px-2.5 font-semibold text-white ${h}`}
      style={{ background: right ? REF.green : REF.red }}
      aria-label={`${row.given}, ${right ? 'right' : 'wrong'}`}>
      <span className="truncate">{row.given}</span>
    </span>
  );
}

export function Complexity({ row, stats }: { row: ResultRow; stats: Stats }) {
  const d = row.q.difficulty;
  const rate = correctRate(stats?.get(row.q.id));
  if (!d && rate == null) return <span className="text-ink-3">—</span>;
  return (
    <span className="whitespace-nowrap tabular" title={rate == null ? undefined : `${percent(rate)} of students got it right`}>
      {d && (
        <span className="font-medium" style={{ color: DIFFICULTY_COLOR[d] }}>
          {DIFFICULTY_LABEL[d]}
        </span>
      )}
      {rate != null && (
        <span className="text-ink-3">
          {d ? ' / ' : ''}
          {percent(rate)}
        </span>
      )}
    </span>
  );
}

function Attempted({ row }: { row: ResultRow }) {
  if (!row.given) return <span className="text-ink-3">-</span>;
  return (
    <span className="font-medium" style={{ color: row.outcome === 'correct' ? REF.green : REF.redText }}>
      {row.given}
    </span>
  );
}

function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: 1 | -1; onClick: () => void }) {
  const I = !active ? ChevronsUpDown : dir === 1 ? ChevronUp : ChevronDown;
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-[4px] font-medium hover:text-white/85">
      {label}
      <I size={15} strokeWidth={2.4} aria-hidden="true" />
    </button>
  );
}

const SECTION_WORD: Record<Subject, string> = { english: 'reading and writing', math: 'math' };

/** One module: its heading and chips, then the table (laptops) or the list (phones). */
export function ModuleTable({ mod, score, stats, onReview, onReport }: { mod: ModuleResult; score: number | undefined; stats: Stats; onReview: (slot: string) => void; onReport: (row: ResultRow) => void }) {
  const [sort, setSort] = useState<Sort>({ key: 'question', dir: 1 });
  const rows = [...mod.rows].sort((a, b) => (sort.key === 'answer' ? (RANK[a.outcome] - RANK[b.outcome]) * sort.dir || a.position - b.position : (a.position - b.position) * sort.dir));
  const correct = mod.rows.filter((r) => r.outcome === 'correct').length;
  const wrong = mod.rows.length - correct;
  const toggle = (key: Sort['key']) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const caption = `${SECTION_LABEL[mod.subject]} · Module ${mod.module}`;
  const ariaSort = (key: Sort['key']) => (sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none');

  return (
    <section className="flex flex-col gap-3" aria-label={caption}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 md:px-3">
        <h2 className="text-[17px] font-semibold leading-6 text-ink md:text-[18px]">
          {caption} <span className="text-ink-2">({SECTION_WORD[mod.subject]} section)</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {score != null && <Chip label={`${SECTION_LABEL[mod.subject]} score ${score} of 800`}>{score} / 800</Chip>}
          <Chip label={`Correct ${correct}`}>
            Correct <span style={{ color: REF.green }}>{correct}</span>
          </Chip>
          <Chip label={`Wrong ${wrong}`}>
            Wrong <span style={{ color: REF.redText }}>{wrong}</span>
          </Chip>
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-[12px] border border-line bg-surface md:block">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-[14px] text-ink">
          <caption className="sr-only">{caption}: every question, your answer and the key</caption>
          <thead>
            <tr className="h-[38px] text-white" style={{ background: REF.slate }}>
              <Th aria-sort={ariaSort('question')}>
                <SortHeader label="Question" active={sort.key === 'question'} dir={sort.dir} onClick={() => toggle('question')} />
              </Th>
              <Th>Title</Th>
              <Th>Correct Answer</Th>
              <Th aria-sort={ariaSort('answer')}>
                <SortHeader label="Your Answer" active={sort.key === 'answer'} dir={sort.dir} onClick={() => toggle('answer')} />
              </Th>
              <Th>Attempted answers</Th>
              <Th>Time</Th>
              <Th>Complexity</Th>
              <Th sticky>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slot} className="h-[49px] text-center">
                <Td>
                  <span className="tabular">{r.position}</span>
                </Td>
                <Td>
                  <span className="mx-auto block max-w-[180px] truncate text-ink-2" title={r.q.skill || undefined}>
                    {r.q.skill || ''}
                  </span>
                </Td>
                <Td>
                  <span className="mx-auto block max-w-[120px] truncate">{keyOf(r.q)}</span>
                </Td>
                <Td>
                  <AnswerPill row={r} />
                </Td>
                <Td>
                  <Attempted row={r} />
                </Td>
                <Td>
                  <span className="tabular text-ink-2" aria-label={clockWords(r.seconds)}>
                    {clock(r.seconds)}
                  </span>
                </Td>
                <Td>
                  <Complexity row={r} stats={stats} />
                </Td>
                <Td sticky>
                  <span className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      id={`review-${r.slot}`}
                      onClick={() => onReview(r.slot)}
                      aria-label={`Review question ${r.position}`}
                      className="h-8 rounded-[6px] border border-line-strong bg-surface px-3.5 text-[14px] font-medium text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink">
                      Review
                    </button>
                    <button
                      type="button"
                      onClick={() => onReport(r)}
                      aria-label={`Report an issue with question ${r.position}`}
                      title="Report an issue"
                      className="flex h-8 w-11 items-center justify-center rounded-[6px] rounded-r-[14px] border border-line-strong bg-surface text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink">
                      <Flag size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="overflow-hidden rounded-[12px] border border-line bg-surface md:hidden">
        {rows.map((r) => (
          <li key={r.slot} className="flex items-center border-t border-line first:border-t-0">
            <button type="button" id={`review-m-${r.slot}`} onClick={() => onReview(r.slot)} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 pr-1 text-left active:bg-surface-2" aria-label={`Question ${r.position}: ${r.outcome === 'skipped' ? 'omitted' : `your answer ${r.given}, ${r.outcome === 'correct' ? 'right' : 'wrong'}`}, correct answer ${keyOf(r.q)}. Review`}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] text-[14px] font-bold text-white tabular" style={{ background: REF.slate }}>
                {r.position}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2 text-[13px] text-ink-2">
                  <AnswerPill row={r} size="sm" />
                  <span className="truncate">
                    Correct <b className="font-bold text-ink">{keyOf(r.q)}</b>
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                  <Complexity row={r} stats={stats} />
                  <span aria-hidden="true">·</span>
                  <span className="tabular">{clock(r.seconds)}</span>
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-ink-3" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => onReport(r)} aria-label={`Report an issue with question ${r.position}`} className="mr-1.5 flex size-10 shrink-0 items-center justify-center rounded-chip text-ink-3 active:bg-surface-2">
              <Flag size={15} strokeWidth={2} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Th({ children, sticky, ...rest }: { children: ReactNode; sticky?: boolean; 'aria-sort'?: 'ascending' | 'descending' | 'none' }) {
  return (
    <th scope="col" {...rest} className={`px-3 text-center font-medium first:rounded-tl-[11px] last:rounded-tr-[11px] ${sticky ? 'sticky right-0 shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.25)]' : ''}`} style={sticky ? { background: REF.slate } : undefined}>
      {children}
    </th>
  );
}

function Td({ children, sticky }: { children: ReactNode; sticky?: boolean }) {
  return <td className={`border-t border-line px-3 ${sticky ? 'sticky right-0 bg-surface shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.12)]' : ''}`}>{children}</td>;
}

/** Placeholder for results tables while the questions load. */
export function TableSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="flex items-center justify-between px-1 md:px-3">
        <Skeleton width={115} height={20} radius={6} />
        <Skeleton width={300} height={34} radius={8} />
      </div>
      <div className="shimmer h-[188px] rounded-[16px]" />
    </div>
  );
}

/** "✓" or "✗" as the review shows them beside a choice. */
export function Mark({ right }: { right: boolean }) {
  const I = right ? Check : X;
  return <I size={16} strokeWidth={3} aria-hidden="true" style={{ color: right ? REF.green : REF.redText }} />;
}
