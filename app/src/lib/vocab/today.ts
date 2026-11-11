import { useStudyDeck } from '@/api/vocabSocial';
import { useMemo } from 'react';

import { useSettings, useVocabState } from './hooks';
import type { Settings } from './local';
import { listProgress } from './progress';
import { activeLists, newToday, queue } from './scheduler';

/**
 * Where the student's vocabulary stands today, for the dashboard: words to
 * study now (due + today's new ones), and how far the lists turned on have got.
 */
export function useVocabToday(now: number) {
  const deck = useStudyDeck();
  const state = useVocabState();
  const settings = useSettings();
  return useMemo(() => {
    if (!deck.data || !state.data) return { ready: !deck.isPending && !state.isPending, hasDeck: false as const };
    const cards = state.data.cards;
    const loaded: Settings = settings.data ?? { active: [], newPerDay: 20 };
    const active = activeLists(loaded, deck.data, cards);
    const date = new Date(now);
    const newLeft = Math.max(0, loaded.newPerDay - newToday(state.data.log, date));
    const q = queue(deck.data, active, cards, date, newLeft);
    let total = 0;
    let learned = 0;
    let started = 0;
    for (const l of deck.data.lists) {
      if (!active.includes(l.slug)) continue;
      const p = listProgress(l, cards);
      total += p.total;
      learned += p.learned;
      started += p.started;
    }
    return {
      ready: true,
      hasDeck: true as const,
      due: q.due.length,
      fresh: q.fresh.length,
      toStudy: q.due.length + q.fresh.length,
      lists: active.length,
      total,
      learned,
      learning: started - learned,
      unseen: total - started,
      log: state.data.log,
    };
  }, [deck.data, deck.isPending, state.data, state.isPending, settings.data, now]);
}
