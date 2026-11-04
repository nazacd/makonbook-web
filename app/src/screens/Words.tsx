import { BookOpen, Check, Clock, CloudUpload, Layers, Play, Plus, SlidersHorizontal, SpellCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { PageHeader, Pill } from '@/components/ui';
import { ListsSheet, UnitChips } from '@/components/vocab/ListsSheet';
import { UnitBar } from '@/components/vocab/UnitBar';
import { useNow } from '@/lib/clock';
import { addDays, schoolDate } from '@/lib/schedule';
import { useTitle } from '@/lib/title';
import { useDeck, useSaveSettings, useSettings, useVocabState, useVocabSync } from '@/lib/vocab/hooks';
import type { Settings } from '@/lib/vocab/local';
import { almostDone, listName, listProgress } from '@/lib/vocab/progress';
import { activeLists, formatGap, newToday, queue } from '@/lib/vocab/scheduler';

import { TeacherWords } from './TeacherWords';

export function Words() {
  const kind = useMe().data?.kind;
  return kind === 'teacher' ? <TeacherWords /> : <StudentWords />;
}

// The student's Words tab (the phone's StudentWords): progress only. Today's
// words and Study, then the lists being studied, each opening its words.
// Setup (new words a day, which lists) is behind the sliders.
function StudentWords() {
  useTitle('Vocabulary');
  const now = new Date(useNow());
  const deck = useDeck();
  const state = useVocabState();
  const settings = useSettings();
  const save = useSaveSettings();
  const sync = useVocabSync(true);
  const [sheet, setSheet] = useState(false);

  const cards = state.data?.cards ?? new Map();
  const loaded: Settings = settings.data ?? { active: [], newPerDay: 20 };
  const s: Settings = { ...loaded, active: deck.data ? activeLists(loaded, deck.data, cards) : loaded.active };
  const newLeft = Math.max(0, s.newPerDay - newToday(state.data?.log ?? [], now));
  const q = deck.data ? queue(deck.data, s.active, cards, now, newLeft) : null;
  const toStudy = q ? q.due.length + q.fresh.length : 0;
  let next: number | null = null;
  if (deck.data && toStudy === 0) {
    for (const l of deck.data.lists) {
      if (!s.active.includes(l.slug)) continue;
      for (const w of l.words) {
        const due = cards.get(w.id)?.due.getTime();
        if (due != null && (next == null || due < next)) next = due;
      }
    }
  }
  const studying = deck.data?.lists.filter((l) => s.active.includes(l.slug)) ?? [];
  const nearlyDone = deck.data ? almostDone(deck.data, s.active, cards, s.newPerDay) : null;
  const add = (slug: string) => save.mutate({ ...s, active: [...s.active, slug] });

  const log = state.data?.log ?? [];
  const today = schoolDate(now.getTime());
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const reviewed = new Set(log.map((r) => schoolDate(Date.parse(r.reviewed_at))));
  const totals = studying.reduce(
    (t, l) => {
      const p = listProgress(l, cards);
      return { total: t.total + p.total, learned: t.learned + p.learned, started: t.started + p.started };
    },
    { total: 0, learned: 0, started: 0 },
  );

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <PageHeader
        icon={SpellCheck}
        title="Vocabulary"
        subtitle="SAT words, spaced out so they stick."
        actions={
          deck.data && deck.data.lists.length > 0 ? (
            <button type="button" onClick={() => setSheet(true)} className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-semibold text-ink hover:bg-surface-2">
              <SlidersHorizontal size={16} aria-hidden="true" /> Lists & pace
            </button>
          ) : undefined
        }
      />
      {!deck.data ? (
        deck.isPending || sync.isPending ? (
          <div className="flex flex-col gap-4">
            <Skeleton height={150} radius={16} />
            <Skeleton height={90} radius={16} />
          </div>
        ) : (
          <ErrorState title="Couldn’t load the words" message={sync.error ? describeError(sync.error) : 'Try again.'} onRetry={() => void sync.refetch()} retrying={sync.isFetching} />
        )
      ) : deck.data.lists.length === 0 ? (
        <EmptyState icon={BookOpen} title="Words are on the way" message="The word lists appear here once they are ready." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-4">
            <section className="flex flex-wrap items-center justify-between gap-5 rounded-card border border-line bg-surface p-6">
              {s.active.length === 0 ? (
                <div>
                  <h2 className="text-[28px] font-bold leading-9 tracking-[-0.02em] text-ink">Pick a list to start</h2>
                  <p className="t-subhead mt-1 max-w-[420px] text-ink-2">About 25 SAT words in each. {listName(deck.data.lists[0]!.title)} is a good first one.</p>
                </div>
              ) : toStudy > 0 ? (
                <>
                  <div>
                    <p className="t-number text-[60px] leading-[64px] text-primary" aria-label={`${toStudy} words today`}>
                      {toStudy}
                    </p>
                    <p className="t-subhead text-ink-2">words waiting for you today</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {q!.fresh.length > 0 && <Pill tone="math">{q!.fresh.length} new</Pill>}
                      {q!.due.length > 0 && <Pill tone="watch">{q!.due.length} to review</Pill>}
                    </div>
                  </div>
                  <Link to="/words/study" className="lift inline-flex h-12 items-center gap-2 rounded-[14px] bg-primary px-6 text-[15px] font-bold text-on-primary hover:bg-primary-hover">
                    <Play size={17} fill="currentColor" aria-hidden="true" /> Start studying
                  </Link>
                </>
              ) : (
                <div>
                  <p className="flex items-center gap-2.5">
                    <span className="flex size-[34px] items-center justify-center rounded-full bg-good-tint">
                      <Icon as={Check} size={20} strokeWidth={2.5} className="text-good" />
                    </span>
                    <span className="text-[24px] font-bold text-ink">All caught up</span>
                  </p>
                  <p className="t-subhead mt-3 flex items-center gap-2 text-ink-2">
                    <Icon as={Clock} size={16} className="text-ink-3" />
                    {next != null ? `Next word in ${formatGap(next - now.getTime())}` : 'Add a list for more words'}
                    {newLeft === 0 ? ' · today’s new words are done' : ''}
                  </p>
                </div>
              )}
            </section>

            {s.active.length === 0 ? (
              <section className="rounded-card border border-line bg-surface p-5">
                <UnitChips lists={deck.data.lists} onAdd={add} />
              </section>
            ) : (
              <section>
                <h2 className="t-headline mb-2.5 text-ink">Your lists</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {studying.map((l) => {
                    const p = listProgress(l, cards);
                    return (
                      <li key={l.slug}>
                        <Link to={`/words/list/${encodeURIComponent(l.slug)}`} aria-label={`${listName(l.title)}, ${p.learned} of ${p.total} learned`} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 transition-colors hover:border-primary/40">
                          <span className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-3">
                              <span className="flex size-10 items-center justify-center rounded-[12px] bg-accent-tint text-[16px] font-extrabold text-primary">{listName(l.title).replace(/\D/g, '') || listName(l.title)[0]}</span>
                              <span className="t-headline text-ink">{listName(l.title)}</span>
                            </span>
                            <span className="t-subhead tabular text-ink-2">
                              {p.learned}/{p.total}
                            </span>
                          </span>
                          <UnitBar progress={p} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {nearlyDone && (
                  <p className="t-subhead mt-2 flex flex-wrap items-center gap-x-2 text-ink-2">
                    <Icon as={Layers} size={17} className="text-ink-3" />
                    {listName(nearlyDone.ending.title)} almost done ·
                    <button type="button" onClick={() => add(nearlyDone.next.slug)} className="flex min-h-11 items-center gap-1 font-semibold text-accent hover:underline">
                      <Icon as={Plus} size={15} className="text-accent" />
                      Add {listName(nearlyDone.next.title)}
                    </button>
                  </p>
                )}
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-card border border-line bg-surface p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="t-headline text-ink">This week</h2>
                <span className="t-footnote text-ink-2">{week.filter((d) => reviewed.has(d)).length} of 7 days</span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {week.map((d) => (
                  <span key={d} className="flex flex-col items-center gap-1">
                    <span className="t-caption text-ink-3">{'SMTWTFS'[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span>
                    <span className={`flex size-8 items-center justify-center rounded-full ${reviewed.has(d) ? (d === today ? 'bg-primary text-on-primary' : 'bg-accent-tint text-accent') : d === today ? 'border-2 border-primary' : 'border border-line'}`}>
                      {reviewed.has(d) && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                    </span>
                  </span>
                ))}
              </div>
            </section>
            {totals.total > 0 && (
              <section className="rounded-card border border-line bg-surface p-5">
                <h2 className="t-headline mb-3 text-ink">Your progress</h2>
                <p className="t-number text-[32px] leading-9 text-ink">{Math.round((totals.learned / totals.total) * 100)}%</p>
                <p className="t-footnote text-ink-2">of the words in your lists learned</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    ['New', totals.total - totals.started],
                    ['Learning', totals.started - totals.learned],
                    ['Learned', totals.learned],
                  ].map(([label, n]) => (
                    <div key={label} className="rounded-control bg-surface-2 py-2">
                      <p className="t-number text-[18px] text-ink">{n}</p>
                      <p className="t-caption text-ink-2">{label}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {(sync.data?.pending ?? 0) > 0 && (
              <p className="t-footnote flex items-center gap-2 text-ink-2">
                <Icon as={CloudUpload} size={16} className="text-ink-3" />
                Progress sends to your teachers when you’re online
              </p>
            )}
            {!sync.isPending && sync.isError && <p className="t-footnote text-ink-3">Couldn’t sync just now; studying goes on with what is here.</p>}
          </aside>
        </div>
      )}
      {sheet && deck.data && (
        <ListsSheet
          deck={deck.data}
          settings={s}
          onClose={(nextSettings) => {
            setSheet(false);
            const changed = nextSettings.newPerDay !== s.newPerDay || nextSettings.active.join() !== s.active.join();
            if (changed) save.mutate(nextSettings);
          }}
        />
      )}
    </div>
  );
}
