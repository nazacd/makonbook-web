import { BookOpen, Check, ChevronRight, Clock, CloudUpload, Layers, Plus, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { ListsSheet, UnitChips } from '@/components/vocab/ListsSheet';
import { UnitBar } from '@/components/vocab/UnitBar';
import { useNow } from '@/lib/clock';
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
  useTitle('Words');
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

  return (
    <div className="mx-auto w-full max-w-xl">
      {deck.data && deck.data.lists.length > 0 && (
        <div className="-mb-4 -mr-2.5 flex justify-end">
          <button type="button" onClick={() => setSheet(true)} aria-label="Lists and pace" className="flex size-11 items-center justify-center rounded-chip active:bg-surface-2">
            <Icon as={SlidersHorizontal} size={22} />
          </button>
        </div>
      )}
      {!deck.data ? (
        deck.isPending || sync.isPending ? (
          <div className="flex flex-col gap-4 pt-11">
            <Skeleton width={80} height={64} />
            <Skeleton height={52} radius={14} />
            <Skeleton height={20} />
          </div>
        ) : (
          <div className="pt-11">
            <ErrorState title="Couldn’t load the words" message={sync.error ? describeError(sync.error) : 'Try again.'} onRetry={() => void sync.refetch()} retrying={sync.isFetching} />
          </div>
        )
      ) : deck.data.lists.length === 0 ? (
        <EmptyState icon={BookOpen} title="Words are on the way" message="The word lists appear here once they are ready." />
      ) : (
        <>
          <section className="mb-7 min-h-[120px]">
            <p className="t-subhead text-ink-2">Today</p>
            {s.active.length === 0 ? (
              <>
                <h1 className="t-title mt-2.5 max-w-[236px] text-ink">Pick a list</h1>
                <p className="t-subhead mt-1 max-w-[300px] text-ink-2">About 25 SAT words in each. Start with {listName(deck.data.lists[0]!.title)}.</p>
              </>
            ) : toStudy > 0 ? (
              <>
                <p className="font-title tabular text-[64px] font-bold leading-[72px] text-ink" aria-label={`${toStudy} words today`}>
                  {toStudy}
                </p>
                <p className="t-subhead tabular text-ink-2">
                  {q!.due.length > 0 && (
                    <>
                      <span className="font-medium text-ink">{q!.due.length}</span> to review
                    </>
                  )}
                  {q!.due.length > 0 && q!.fresh.length > 0 && ' · '}
                  {q!.fresh.length > 0 && (
                    <>
                      <span className="font-medium text-ink">{q!.fresh.length}</span> new
                    </>
                  )}
                </p>
                <div className="mt-4 max-w-xs">
                  <Link to="/words/study" className="t-headline flex h-[52px] items-center justify-center rounded-control bg-primary px-6 text-on-primary active:scale-[0.97]">
                    Study
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 flex items-center gap-2.5">
                  <span className="flex size-[34px] items-center justify-center rounded-full bg-good-tint">
                    <Icon as={Check} size={20} strokeWidth={2.5} className="text-good" />
                  </span>
                  <span className="t-title2 text-ink">All caught up</span>
                </p>
                <p className="t-subhead mt-3 flex items-center gap-2 text-ink-2">
                  <Icon as={Clock} size={16} className="text-ink-3" />
                  {next != null ? `Next word in ${formatGap(next - now.getTime())}` : 'Add a list for more words'}
                  {newLeft === 0 ? ' · today’s new words are done' : ''}
                </p>
              </>
            )}
          </section>

          {s.active.length === 0 ? (
            <UnitChips lists={deck.data.lists} onAdd={add} />
          ) : (
            <>
              <h2 className="t-title3 mb-1 text-ink">Studying</h2>
              <ul>
                {studying.map((l, i) => {
                  const p = listProgress(l, cards);
                  return (
                    <li key={l.slug} className={i ? 'border-t border-line' : ''}>
                      <Link to={`/words/list/${encodeURIComponent(l.slug)}`} aria-label={`${listName(l.title)}, ${p.learned} of ${p.total} learned`} className="-mx-5 flex min-h-[60px] items-center gap-3.5 px-5 active:bg-surface-2">
                        <span className="t-title3 w-[72px] truncate text-[18px] leading-[23px] text-ink">{listName(l.title)}</span>
                        <span className="flex-1">
                          <UnitBar progress={p} />
                        </span>
                        <span className="t-subhead tabular min-w-10 text-right font-medium text-ink-2">
                          {p.learned}/{p.total}
                        </span>
                        <Icon as={ChevronRight} size={16} className="text-ink-3" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {nearlyDone && (
                <p className="t-subhead mt-1 flex flex-wrap items-center gap-x-2 text-ink-2">
                  <Icon as={Layers} size={17} className="text-ink-3" />
                  {listName(nearlyDone.ending.title)} almost done ·
                  <button type="button" onClick={() => add(nearlyDone.next.slug)} className="flex min-h-11 items-center gap-1 font-semibold text-accent active:opacity-60">
                    <Icon as={Plus} size={15} className="text-accent" />
                    Add {listName(nearlyDone.next.title)}
                  </button>
                </p>
              )}
            </>
          )}

          {(sync.data?.pending ?? 0) > 0 && (
            <p className="t-subhead mt-5 flex items-center gap-2 text-ink-2">
              <Icon as={CloudUpload} size={17} className="text-ink-3" />
              Progress sends to your teachers when you’re online
            </p>
          )}
          {!sync.isPending && sync.isError && (
            <p className="t-footnote mt-5 text-ink-3">Couldn’t sync just now; studying goes on with what is here.</p>
          )}
        </>
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
