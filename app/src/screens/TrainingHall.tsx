import { ArrowRight, ArrowUpNarrowWide, ChevronDown, CircleHelp, Dumbbell } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { Skeleton } from '@/components/States';
import { DomainCard } from '@/components/training/DomainCard';
import { masteredSkills, streakOf, totalsOf, trophiesOf, type Totals } from '@/components/training/progress';
import { AssessmentsButton, MasteryCard, NextTrophy, RecentlyMastered, StreakCard, TrophyShelf } from '@/components/training/Rail';
import { useNow } from '@/lib/clock';
import { useLocalAttempts, useUploadAttempts } from '@/lib/practice/hooks';
import { summarize, useAnswered, useResolved, type DomainSummary } from '@/lib/practice/mistakes';
import type { Subject } from '@/lib/practice/types';
import { useTitle } from '@/lib/title';

// Mastery repair (the platform spec's Training Hall, 5.10 and 11.10): every
// question the student's finished tests marked wrong, by topic and subtopic,
// each topic with a session that drills it. On a wide screen (≥ 1280px) the
// page fills the window as two scroll areas, the topic list and a 239px rail
// (mastery, streak, trophies) ending in "Go to assessments"; below that the
// page scrolls as one and the rail comes after the list.

type Filter = 'all' | Subject;
type Sort = 'repair' | 'weakest' | 'az';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'math', label: 'SAT Math' },
  { value: 'english', label: 'Reading & Writing' },
];

const SORTS: { value: Sort; label: string }[] = [
  { value: 'repair', label: 'Most to repair' },
  { value: 'weakest', label: 'Weakest first' },
  { value: 'az', label: 'A–Z' },
];

const WEEK_MS = 7 * 24 * 60 * 60_000;
const SUBTITLE = 'Mastery repair, fed live from your assessments. Drill what you missed, watch the percentages climb.';

function sorted(domains: DomainSummary[], sort: Sort): DomainSummary[] {
  if (sort === 'repair') return domains; // summarize() already orders them so
  const list = [...domains];
  if (sort === 'weakest') return list.sort((a, b) => a.mastery - b.mastery || b.repair - a.repair || a.domain.localeCompare(b.domain));
  return list.sort((a, b) => a.domain.localeCompare(b.domain) || a.subject.localeCompare(b.subject));
}

export function TrainingHall() {
  useTitle('Training Hall');
  const sync = useUploadAttempts(true);
  const local = useLocalAttempts();
  const { answered, attempts, isPending } = useAnswered();
  const resolved = useResolved();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('repair');

  const domains = useMemo(() => summarize(answered, resolved), [answered, resolved]);
  const totals = useMemo(() => totalsOf(domains), [domains]);
  const mastered = useMemo(() => masteredSkills(domains, answered, resolved), [domains, answered, resolved]);

  // Before the first sync, an empty list may just mean the server's attempts haven't arrived.
  if (isPending || (answered.length === 0 && (sync.isPending || local.isFetching))) return <Loading />;
  if (answered.length === 0) return <Empty />;

  const weekAgo = now - WEEK_MS;
  const since = new Date(weekAgo).toISOString();
  const wrongThisWeek = answered.filter((a) => !a.correct && a.at >= since).length;
  const testsThisWeek = attempts.filter((a) => a.finished_at >= since).length;
  const masteredThisWeek = mastered.filter((m) => m.at >= since).length;
  const streak = streakOf(
    attempts.map((a) => a.finished_at),
    resolved,
    now,
  );
  const trophies = trophiesOf(totals, Object.keys(resolved).length, streak);
  const shown = sorted(
    domains.filter((d) => filter === 'all' || d.subject === filter),
    sort,
  );

  return (
    <Layout
      top={
        <>
          <Title />
          <StatStrip totals={totals} masteredThisWeek={masteredThisWeek} wrongThisWeek={wrongThisWeek} testsThisWeek={testsThisWeek} />
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <div role="radiogroup" aria-label="Subject" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const on = f.value === filter;
                return (
                  <button
                    key={f.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setFilter(f.value)}
                    className={`h-[34px] rounded-[20px] border px-3.5 text-[14px] font-medium transition-colors duration-150 ${
                      on ? 'border-primary bg-primary text-on-primary' : 'border-ink bg-surface text-ink hover:border-[color-mix(in_srgb,var(--color-primary)_45%,transparent)]'
                    }`}>
                    {f.label}
                  </button>
                );
              })}
            </div>
            <label className="relative flex items-center">
              <span className="sr-only">Sort topics</span>
              <ArrowUpNarrowWide size={17} strokeWidth={1.9} aria-hidden="true" className="pointer-events-none absolute left-4 text-ink" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="h-9 cursor-pointer appearance-none rounded-[20px] border border-line-strong bg-surface pl-[46px] pr-10 text-[14.5px] font-medium text-ink shadow-[0_2px_4px_rgba(0,0,0,0.075)] outline-none transition-colors duration-150 hover:border-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] focus-visible:border-accent">
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} strokeWidth={2} aria-hidden="true" className="pointer-events-none absolute right-3.5 text-ink-2" />
            </label>
          </div>
        </>
      }
      list={
        shown.length > 0 ? (
          <div className="flex flex-col gap-4">
            {shown.map((d, i) => (
              <div key={`${d.subject}|${d.domain}`} className="rise" style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}>
                <DomainCard domain={d} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-line-strong px-6 py-10 text-center">
            <p className="text-[15px] font-semibold text-ink">No {filter === 'math' ? 'SAT Math' : 'Reading & Writing'} questions yet</p>
            <p className="mt-1 text-[13px] text-ink-3">Finish a {filter === 'math' ? 'Math' : 'Reading and Writing'} section and what you miss shows up here.</p>
          </div>
        )
      }
      rail={
        <>
          <MasteryCard totals={totals} />
          <StreakCard streak={streak} />
          <TrophyShelf trophies={trophies} />
          <NextTrophy trophies={trophies} />
          <RecentlyMastered skills={mastered.slice(0, 3).map((m) => m.skill)} />
        </>
      }
    />
  );
}

// The page's frame. At xl it fills the window exactly (the negative margins
// undo AppShell's main padding), so the list and the rail scroll on their own.
function Layout({ top, list, rail, busy = false }: { top: ReactNode; list: ReactNode; rail: ReactNode; busy?: boolean }) {
  return (
    <div className="xl:-mb-12 xl:-mr-7 xl:-mt-6 xl:flex xl:h-dvh" aria-busy={busy || undefined}>
      <div className="flex min-w-0 flex-1 flex-col xl:pt-[26px]">
        <div className="pb-4 xl:pr-[22px]">{top}</div>
        <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pb-6 xl:pr-[10px]">{list}</div>
      </div>
      <aside aria-label="Your progress" className="mt-8 xl:mt-0 xl:flex xl:w-[239px] xl:shrink-0 xl:flex-col xl:border-l xl:border-line">
        <div className="grid gap-4 sm:grid-cols-2 sm:items-start xl:flex xl:items-stretch xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-y-auto xl:px-[18px] xl:pb-4 xl:pt-[22px]">{rail}</div>
        <div className="mt-4 xl:mt-0 xl:border-t xl:border-line xl:px-[18px] xl:py-4">
          <AssessmentsButton />
        </div>
      </aside>
    </div>
  );
}

function Title() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <header className="mb-3">
      <div ref={box} className="relative flex items-center gap-2.5">
        <h1 className="text-[24px] font-medium leading-[30px] tracking-[-0.01em] text-ink">Training Hall</h1>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="How the Training Hall works"
          className="flex size-7 items-center justify-center rounded-full bg-accent-tint text-accent transition-transform duration-150 hover:scale-105">
          <CircleHelp size={16} strokeWidth={1.9} aria-hidden="true" />
        </button>
        {open && (
          <div role="dialog" aria-label="How the Training Hall works" className="pop absolute left-0 top-[calc(100%+8px)] z-30 w-[min(340px,calc(100vw-32px))] rounded-card border border-line bg-surface p-4 shadow-[0_12px_32px_-8px_rgba(16,19,26,0.18)]">
            <p className="text-[14px] font-bold text-ink">How it works</p>
            <p className="mt-1 text-[13px] leading-[19px] text-ink-2">
              Every question you get wrong or leave blank in an assessment lands here, grouped by topic and subtopic. Start a session and answer them again: each one you get right is resolved, and your mastery climbs. Miss it again in a later assessment and it comes back.
            </p>
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[13px] font-medium text-ink-2">{SUBTITLE}</p>
    </header>
  );
}

// Overall mastery (with a thin purple underline), subtopics to drill,
// subtopics mastered, questions missed this week.
function StatStrip({ totals: t, masteredThisWeek, wrongThisWeek, testsThisWeek }: { totals: Totals; masteredThisWeek: number; wrongThisWeek: number; testsThisWeek: number }) {
  const items: { value: string | number; label: string; bar?: number }[] = [
    { value: `${Math.round(t.mastery * 100)}%`, label: 'Overall mastery', bar: t.mastery },
    { value: t.toDrill, label: `To drill · of ${t.skills} tracked` },
    { value: t.mastered, label: `Mastered · +${masteredThisWeek} this week` },
    { value: wrongThisWeek, label: `Wrong this week · ${testsThisWeek} ${testsThisWeek === 1 ? 'assessment' : 'assessments'}` },
  ];
  return (
    <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="At a glance">
      {items.map((it) => (
        <li key={it.label} className="relative flex min-h-9 items-center gap-2.5 overflow-hidden rounded-[14px] bg-surface-2 px-4 py-1.5" title={`${it.value} ${it.label}`}>
          <span className="tabular shrink-0 text-[18px] font-bold leading-6 text-ink">{it.value}</span>
          <span className="min-w-0 text-[12px] font-medium leading-4 text-ink-3 lg:truncate">{it.label}</span>
          {it.bar != null && <span aria-hidden="true" className="absolute bottom-0 left-2 h-[3px] rounded-full bg-primary transition-[width] duration-[400ms]" style={{ width: `calc(${it.bar} * (100% - 16px))` }} />}
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return (
    <div>
      <Title />
      <section className="rise mx-auto mt-8 flex max-w-lg flex-col items-center rounded-[18px] border border-line-strong bg-surface px-6 py-12 text-center">
        <span className="mb-4 flex size-14 items-center justify-center rounded-[16px] bg-accent-tint text-accent">
          <Dumbbell size={26} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <h2 className="text-[18px] font-medium text-ink">Nothing to repair yet</h2>
        <p className="mt-1.5 max-w-sm text-[13px] leading-[19px] text-ink-2">Finish an assessment and every question you miss lands here, sorted by topic and subtopic, ready to drill.</p>
        <Link to="/practice" className="lift mt-6 inline-flex h-[42px] items-center gap-2 rounded-[21px] bg-primary px-5 text-[15px] font-semibold text-on-primary hover:bg-primary-hover">
          Go to assessments
          <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

// The page's final shapes, shimmering, while the tests and their packages load.
function Loading() {
  return (
    <Layout
      busy
      top={
        <>
          <Title />
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={36} radius={14} />
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <Skeleton width={46} height={34} radius={20} />
              <Skeleton width={92} height={34} radius={20} />
              <Skeleton width={140} height={34} radius={20} />
            </div>
            <span className="hidden sm:block">
              <Skeleton width={188} height={36} radius={20} />
            </span>
          </div>
        </>
      }
      list={
        <div className="flex flex-col gap-4">
          {[0, 3, 2].map((rows, i) => (
            <div key={i} className="overflow-hidden rounded-[18px] border border-line bg-surface">
              <div className="flex h-[76px] items-center gap-3.5 px-4">
                <Skeleton width={32} height={32} radius={9} />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton width="42%" height={17} />
                  <Skeleton width="26%" height={11} />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Skeleton width={34} height={15} />
                  <Skeleton width={57} height={12} radius={2} />
                </div>
              </div>
              {rows > 0 && (
                <div className="grid grid-cols-1 gap-px border-t border-line bg-line xl:grid-cols-2">
                  {Array.from({ length: rows + (rows % 2) }, (_, j) => (
                    <div key={j} className="flex h-[38px] items-center bg-surface px-[22px]">
                      {j < rows && <Skeleton width="58%" height={11} />}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex h-[58px] items-center justify-between border-t border-line px-4">
                <Skeleton width={118} height={11} />
                <Skeleton width={128} height={30} radius={20} />
              </div>
            </div>
          ))}
        </div>
      }
      rail={
        <>
          <Skeleton height={124} radius={18} />
          <Skeleton height={76} radius={18} />
          <Skeleton height={300} radius={18} />
        </>
      }
    />
  );
}
