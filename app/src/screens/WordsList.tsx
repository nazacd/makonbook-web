import { Check, ChevronLeft, FileQuestion } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { Icon } from '@/components/Icon';
import { EmptyState, Skeleton } from '@/components/States';
import { UnitBar } from '@/components/vocab/UnitBar';
import { ScreenTitle } from '@/layouts/AppShell';
import { useNow } from '@/lib/clock';
import { useTitle } from '@/lib/title';
import { useDeck, useVocabState } from '@/lib/vocab/hooks';
import { listName, listProgress } from '@/lib/vocab/progress';
import { formatGap, isLearned, type Cards } from '@/lib/vocab/scheduler';
import type { VocabWord } from '@/lib/vocab/types';

type Kind = 'learning' | 'learned' | 'new';

// One list's words, read-only, by where each stands: learning (when it comes
// back, "Due" when it's due now), learned, and new (not started yet).
export function WordsList() {
  const now = useNow();
  const { slug = '' } = useParams();
  const deck = useDeck();
  const state = useVocabState();
  const list = deck.data?.lists.find((l) => l.slug === slug);
  const cards: Cards = state.data?.cards ?? new Map();
  useTitle(list ? listName(list.title) : 'Words');

  const back = (
    <Link to="/words" className="t-subhead -ml-1 mb-4 inline-flex h-10 items-center gap-1 rounded-chip pr-2 text-accent">
      <Icon as={ChevronLeft} size={18} className="text-accent" />
      Words
    </Link>
  );
  if (!deck.data || !state.data) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        {back}
        <Skeleton height={8} />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={20} />
        ))}
      </div>
    );
  }
  if (!list) {
    return (
      <div className="mx-auto w-full max-w-xl">
        {back}
        <EmptyState icon={FileQuestion} title="List not found" message="This list isn’t in the words here." />
      </div>
    );
  }

  const due = (w: VocabWord) => cards.get(w.id)!.due.getTime();
  const learning = list.words.filter((w) => cards.has(w.id) && !isLearned(cards.get(w.id)!)).sort((a, b) => due(a) - due(b));
  const learned = list.words.filter((w) => cards.has(w.id) && isLearned(cards.get(w.id)!)).sort((a, b) => due(a) - due(b));
  const fresh = list.words.filter((w) => !cards.has(w.id));
  const p = listProgress(list, cards);
  const when = (w: VocabWord) => (due(w) <= now ? null : `in ${formatGap(due(w) - now)}`);

  const section = (title: string, words: VocabWord[], kind: Kind) =>
    words.length > 0 && (
      <section>
        <div className="mb-0.5 flex items-baseline justify-between">
          <h2 className="t-title3 text-ink">{title}</h2>
          <span className="t-footnote tabular text-ink-3">{words.length}</span>
        </div>
        <ul>
          {words.map((w, i) => {
            const back = kind === 'new' ? null : when(w);
            return (
              <li key={w.id} className={`flex min-h-[60px] items-center gap-3 py-2 ${i ? 'border-t border-line' : ''}`} aria-label={`${w.word}${w.part_of_speech ? `, ${w.part_of_speech}` : ''}: ${w.definition}. ${kind === 'new' ? 'New' : back ? `Comes back ${back}` : 'Due now'}`}>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="t-body truncate">
                    <span className="font-bold text-ink">{w.word}</span>
                    {w.part_of_speech && <span className="t-footnote italic text-ink-3">{'  '}{w.part_of_speech}</span>}
                  </span>
                  <span className="t-footnote truncate text-ink-3">{w.definition}</span>
                </span>
                {kind === 'learned' ? (
                  <span className="flex items-center gap-1">
                    <Icon as={Check} size={15} strokeWidth={2.4} className="text-good" />
                    <span className="t-subhead tabular text-ink-2">{back ?? 'due'}</span>
                  </span>
                ) : kind === 'learning' ? (
                  <span className={`t-subhead tabular ${back ? 'text-ink-2' : 'font-semibold text-accent'}`}>{back ?? 'Due'}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        {back}
        <ScreenTitle title={listName(list.title)} />
        <UnitBar progress={p} height={8} />
        <p className="t-subhead tabular mt-2 text-ink-2">
          <span className="font-semibold text-ink">{p.learned}</span> learned · {learning.length} learning · {fresh.length} new
        </p>
      </div>
      {section('Learning', learning, 'learning')}
      {section('Learned', learned, 'learned')}
      {section('New', fresh, 'new')}
    </div>
  );
}
