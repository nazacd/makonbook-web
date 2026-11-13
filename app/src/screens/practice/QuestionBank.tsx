import { BarChart3, Bookmark, ChevronRight, CircleCheck, Flame, History, LibraryBig, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { describeError } from '@/api/errors';
import { usePracticeStats, type PracticeStats } from '@/api/practiceSets';
import { BookArt, CompassArt } from '@/components/practice/BankArt';
import { AccuracyByDifficulty, TimeByDifficulty, TopicAccuracy, WeeklyTrend } from '@/components/practice/BankCharts';
import { ErrorState, Skeleton } from '@/components/States';
import { useTitle } from '@/lib/title';

// The question bank (spec 22.8): the two subjects with how much of each is
// solved, then the student's analytics: four figures, the weekly trend, and
// per subject accuracy by topic, time and accuracy by difficulty. Open to
// every student with a phone.
export function QuestionBank() {
  useTitle('Question bank');
  const stats = usePracticeStats();
  const s = stats.data;

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <h1 className="flex items-center gap-2.5 text-[28px] font-semibold leading-9 tracking-[-0.02em] text-title">
        <LibraryBig size={24} className="text-ink-2" aria-hidden="true" /> Question bank
      </h1>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <SubjectCard to="/questions/english" title="Reading & Writing" solved={s?.subjects.english.solved} total={s?.subjects.english.total} gradient="linear-gradient(120deg, #e46cc3 0%, #b62a9e 100%)" art={<BookArt className="h-full w-full" />} />
        <SubjectCard to="/questions/math" title="Math" solved={s?.subjects.math.solved} total={s?.subjects.math.total} gradient="linear-gradient(120deg, #2fb2f4 0%, #1d63de 100%)" art={<CompassArt className="h-full w-full" />} />
      </div>

      <div className="mt-10 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[24px] font-semibold leading-8 tracking-[-0.02em] text-title">
          <BarChart3 size={21} className="text-ink-2" aria-hidden="true" /> Question analytics
        </h2>
        <Link to="/questions/history" className="t-subhead inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-3.5 font-semibold text-ink-2 hover:text-ink">
          <History size={15} aria-hidden="true" /> Practice history <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>

      {stats.isPending ? (
        <div className="mt-4 flex flex-col gap-4">
          <Skeleton height={120} radius={16} />
          <Skeleton height={300} radius={16} />
        </div>
      ) : stats.isError ? (
        <div className="mt-4">
          <ErrorState title="Couldn’t load your analytics" message={describeError(stats.error)} onRetry={() => void stats.refetch()} retrying={stats.isFetching} />
        </div>
      ) : (
        <Analytics s={s!} />
      )}

      <p className="t-caption mx-auto mt-12 max-w-[640px] text-center text-ink-3">
        SAT® is a registered trademark of the College Board, which is not affiliated with SATMAKON and does not endorse it. The questions here are SATMAKON’s own practice questions.
      </p>
    </div>
  );
}

function SubjectCard({ to, title, solved, total, gradient, art }: { to: string; title: string; solved?: number; total?: number; gradient: string; art: ReactNode }) {
  const p = total ? Math.round((100 * (solved ?? 0)) / total) : 0;
  return (
    <section className="relative flex min-h-[176px] overflow-hidden rounded-panel p-5 text-white" style={{ background: gradient }}>
      <div className="relative z-[1] flex w-[58%] flex-col">
        <h2 className="text-[20px] font-bold">{title}</h2>
        <p className="t-footnote mt-2 flex justify-between gap-2 text-white/85">
          <span className="tabular">
            {total == null ? '…' : `${(solved ?? 0).toLocaleString('en-US')} of ${total.toLocaleString('en-US')} solved`}
          </span>
          <span className="tabular">{p}%</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/30" role="progressbar" aria-label={`${title}: ${p}% solved`} aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-white" style={{ width: `${p}%` }} />
        </div>
        <Link to={to} className="t-subhead mt-auto inline-flex h-9 w-fit items-center gap-1 rounded-full bg-white px-4 pt-0 font-semibold text-ink shadow-sm hover:bg-white/90" style={{ color: '#10131a' }}>
          Open <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <div className="pointer-events-none absolute -right-2 bottom-0 top-2 w-[48%] sm:-right-1">{art}</div>
    </section>
  );
}

function Analytics({ s }: { s: PracticeStats }) {
  const accuracy = s.answers ? Math.round((100 * s.correct) / s.answers) : 0;
  return (
    <>
      <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-card border border-line bg-surface lg:grid-cols-4">
        <Kpi label="Questions attempted" value={s.attempted.toLocaleString('en-US')} note="Different questions answered" icon={CircleCheck} />
        <Kpi label="Current accuracy" value={`${accuracy}%`} note={s.answers ? `${s.correct} of ${s.answers} answers right` : 'No answers yet'} icon={Target} />
        <Kpi
          label="Saved questions"
          value={String(s.saved)}
          note="To come back to"
          icon={Bookmark}
          action={
            <Link to="/questions/saved" className="t-footnote inline-flex h-7 items-center rounded-full border border-line bg-surface px-3 font-semibold text-ink-2 hover:text-ink">
              View
            </Link>
          }
        />
        <Kpi label="Study streak" value={String(s.streak)} note={s.streak === 1 ? 'day in a row' : 'days in a row'} icon={Flame} />
      </div>

      <section className="mt-4 rounded-card border border-line bg-surface p-5 sm:p-6">
        <h3 className="text-[20px] font-semibold text-ink">Activity trend</h3>
        <p className="t-footnote mb-5 mt-1 text-ink-2">Right answers in green, wrong in red. Harder questions are darker and sit lower in each colour. Each bar is one week, from Monday.</p>
        <WeeklyTrend weeks={s.weeks} />
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {(
          [
            ['Accuracy by topic', (sub: PracticeStats['subjects']['math']) => <TopicAccuracy subject={sub} />],
            ['Time by difficulty · grey averages are everyone’s', (sub: PracticeStats['subjects']['math']) => <TimeByDifficulty subject={sub} />],
            ['Accuracy by difficulty · grey averages are everyone’s', (sub: PracticeStats['subjects']['math']) => <AccuracyByDifficulty subject={sub} />],
          ] as const
        ).flatMap(([caption, chart]) =>
          (['english', 'math'] as const).map((k) => (
            <section key={`${caption}-${k}`} className="rounded-card border border-line bg-surface p-5 sm:p-6">
              <h3 className="text-[20px] font-semibold text-ink">{k === 'english' ? 'English' : 'Math'}</h3>
              <p className="t-footnote mb-4 text-ink-2">{caption}</p>
              {chart(s.subjects[k])}
            </section>
          )),
        )}
      </div>
    </>
  );
}

function Kpi({ label, value, note, icon: I, action }: { label: string; value: string; note: string; icon: typeof Flame; action?: ReactNode }) {
  return (
    <div className="relative min-h-[118px] overflow-hidden border-line p-4 [&:nth-child(-n+2)]:border-b lg:border-r lg:[&:nth-child(-n+2)]:border-b-0 lg:last:border-r-0 [&:nth-child(odd)]:border-r">
      <p className="t-footnote text-ink-2">{label}</p>
      <p className="t-number mt-1 text-[30px] leading-9 text-ink">{value}</p>
      <p className="t-caption mt-0.5 max-w-[70%] text-ink-3">{note}</p>
      {action && <div className="relative z-[1] mt-2">{action}</div>}
      <I size={64} strokeWidth={1.5} className="pointer-events-none absolute -bottom-3 -right-2 text-ink opacity-[0.06]" aria-hidden="true" />
    </div>
  );
}
