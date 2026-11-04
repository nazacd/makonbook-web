import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { ScoreChange } from '@/components/practice/ScoreChange';
import { SolidPill } from '@/components/practice/cards/TestCard';
import { formatWhen, REF, SECTION_LABEL } from '@/components/practice/results/format';
import { EmptyState, Skeleton } from '@/components/States';
import { useNow } from '@/lib/clock';
import { useLocalAttempts, useUploadAttempts } from '@/lib/practice/hooks';
import type { LocalAttempt } from '@/lib/practice/local';
import { testName } from '@/lib/practice/run';
import { relativeDay } from '@/lib/schedule';
import { useTitle } from '@/lib/title';

const what = (a: LocalAttempt) => (a.total != null ? 'Full test' : SECTION_LABEL[a.sections[0]!]);
const scoreOf = (a: LocalAttempt) => (a.total != null ? a.total : a.sections[0] ? a.scores[a.sections[0]]?.score : undefined);
const outOf = (a: LocalAttempt) => (a.total != null ? 1600 : 800);
function rightOf(a: LocalAttempt) {
  const s = a.sections.map((x) => a.scores[x]).filter((x) => x != null);
  return { right: s.reduce((n, x) => n + x.raw, 0), total: s.reduce((n, x) => n + x.questions, 0) };
}

/** The change from the attempt before it of the same kind (full test, or the same section). */
function changeOf(list: LocalAttempt[], i: number): number {
  const a = list[i]!;
  const before = list.slice(i + 1).find((b) => what(b) === what(a));
  const now = scoreOf(a);
  const then = before ? scoreOf(before) : undefined;
  return now != null && then != null ? now - then : 0;
}

function Status({ a }: { a: LocalAttempt }) {
  if (a.rejected) return <SolidPill color={REF.red}>Not sent</SolidPill>;
  return a.uploaded ? <SolidPill color={REF.finished}>Finished</SolidPill> : <SolidPill color={REF.planned}>Waiting to send</SolidPill>;
}

// Every attempt of one test, newest first, as the results page's table:
// when, what was taken, the final score and result, and the way to the details.
export function PracticeHistory() {
  const now = useNow();
  const { code = '' } = useParams();
  useUploadAttempts(true);
  const attempts = useLocalAttempts();
  const mine = (attempts.data ?? []).filter((a) => a.code === code);
  const title = mine[0] ? testName(mine[0].title) : testName(code);
  useTitle(`History - ${title}`);

  return (
    <div className="mx-auto flex w-full max-w-[1260px] flex-col gap-5">
      <header className="flex min-w-0 items-start gap-1.5">
        <Link to={`/practice/test/${encodeURIComponent(code)}`} aria-label={`Back to ${title}`} className="group -ml-2 flex size-9 shrink-0 items-center justify-center rounded-chip text-primary hover:bg-surface-2">
          <ChevronLeft size={24} strokeWidth={2.4} className="transition-transform duration-200 group-hover:-translate-x-[3px]" aria-hidden="true" />
        </Link>
        <div className="min-w-0 pt-0.5">
          <h1 className="text-[22px] font-medium leading-8 text-title">History - {title}</h1>
          {mine.length > 0 && (
            <p className="t-footnote text-ink-3">
              {mine.length} {mine.length === 1 ? 'attempt' : 'attempts'}, newest first
            </p>
          )}
        </div>
      </header>

      {attempts.isPending ? (
        <Skeleton height={188} radius={16} />
      ) : mine.length === 0 ? (
        <EmptyState icon={History} title="No attempts yet — your results for this test will land here." />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-[12px] border border-line bg-surface md:block">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[14px] text-ink">
              <caption className="sr-only">Your attempts at {title}</caption>
              <thead>
                <tr className="h-[38px] text-white" style={{ background: REF.slate }}>
                  {['Date', 'Taken', 'Final score', 'Final result', 'Status', 'Actions'].map((h) => (
                    <th key={h} scope="col" className="px-3 text-center font-medium first:rounded-tl-[11px] last:rounded-tr-[11px]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mine.map((a, i) => {
                  const { right, total } = rightOf(a);
                  return (
                    <tr key={a.id} className="h-[49px] text-center">
                      <td className="border-t border-line px-3 tabular">
                        {formatWhen(a.finished_at)} <span className="text-ink-3">({relativeDay(Date.parse(a.finished_at), now)})</span>
                      </td>
                      <td className="border-t border-line px-3">{what(a)}</td>
                      <td className="border-t border-line px-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-bold tabular">{scoreOf(a) ?? '–'}</span>
                          <span className="text-ink-3 tabular">of {outOf(a)}</span>
                          <ScoreChange change={changeOf(mine, i)} />
                        </span>
                      </td>
                      <td className="border-t border-line px-3 tabular">
                        {total ? (
                          <>
                            <b className="font-bold">{right}</b> <span className="text-ink-3">of {total}</span>
                          </>
                        ) : (
                          '–'
                        )}
                      </td>
                      <td className="border-t border-line px-3">
                        <Status a={a} />
                      </td>
                      <td className="border-t border-line px-3">
                        <Link to={`/practice/result/${a.id}`} className="inline-flex h-8 items-center rounded-[6px] border border-line-strong bg-surface px-3.5 text-[14px] font-medium text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink">
                          See details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="overflow-hidden rounded-[12px] border border-line bg-surface md:hidden">
            {mine.map((a, i) => {
              const { right, total } = rightOf(a);
              const score = scoreOf(a);
              return (
                <li key={a.id} className="border-t border-line first:border-t-0">
                  <Link to={`/practice/result/${a.id}`} aria-label={`${what(a)}, ${formatWhen(a.finished_at)}, ${score ?? 'no'} score. See details`} className="flex items-center gap-3 px-3.5 py-3 active:bg-surface-2">
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold text-ink">{what(a)}</span>
                        <Status a={a} />
                      </span>
                      <span className="truncate text-[12.5px] text-ink-3 tabular">
                        {formatWhen(a.finished_at)}
                        {total ? ` · ${right} of ${total} right` : ''}
                      </span>
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="text-[20px] font-bold leading-6 text-ink tabular">{score ?? '–'}</span>
                      <ScoreChange change={changeOf(mine, i)} />
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-ink-3" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
