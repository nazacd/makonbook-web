import { ChevronLeft, History } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/States';
import { ScreenTitle } from '@/layouts/AppShell';
import { useNow } from '@/lib/clock';
import { useLocalAttempts, useUploadAttempts } from '@/lib/practice/hooks';
import { SUBJECT_LABEL, testName } from '@/lib/practice/run';
import { relativeDay } from '@/lib/schedule';
import { useTitle } from '@/lib/title';

// Every attempt of one test, newest first; each opens its result.
export function PracticeHistory() {
  const now = useNow();
  const { code = '' } = useParams();
  useUploadAttempts(true);
  const mine = (useLocalAttempts().data ?? []).filter((a) => a.code === code);
  const title = mine[0] ? testName(mine[0].title) : 'History';
  useTitle(`${title} · History`);
  return (
    <div className="mx-auto w-full max-w-xl">
      <Link to={`/practice/test/${encodeURIComponent(code)}`} className="t-subhead -ml-1 mb-4 inline-flex h-10 items-center gap-1 rounded-chip pr-2 text-accent">
        <Icon as={ChevronLeft} size={18} className="text-accent" />
        {title}
      </Link>
      <ScreenTitle title="History" />
      {mine.length === 0 ? (
        <EmptyState icon={History} title="No attempts yet" message="Your results for this test show up here." />
      ) : (
        <ul>
          {mine.map((a, i) => {
            const full = a.total != null;
            const subject = a.sections[0]!;
            const what = full ? 'Full test' : SUBJECT_LABEL[subject];
            const when = relativeDay(Date.parse(a.finished_at), now);
            const score = String((full ? a.total : a.scores[subject]?.score) ?? '–');
            return (
              <li key={a.id} className={i ? 'border-t border-line' : ''}>
                <Link to={`/practice/result/${a.id}`} aria-label={`${what}, ${when}, ${score}`} className="-mx-5 flex min-h-16 items-center gap-3 px-5 active:bg-surface-2">
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="t-body text-ink">{what}</span>
                    <span className="t-footnote text-ink-3">{when}</span>
                  </span>
                  {full ? <span className="font-title tabular text-[22px] font-bold text-ink">{score}</span> : <span className="t-subhead tabular text-ink-2">{score}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
