import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Card, Grade } from 'ts-fsrs';

import { api, ApiError, call, sameSession } from '@/api/client';
import { uuid } from '@/lib/device-id';
import { usePerson } from '@/lib/practice/hooks';

import { appendLog, hasImage, readDeck, readLog, storeImageLinks, writeDeck } from './files';
import { loadCursor, loadPending, loadSettings, saveCursor, savePending, saveSettings, type Settings } from './local';
import { activeLists, rate, replay, type Cards } from './scheduler';
import type { Deck, Review } from './types';

// The phone's src/lib/vocab/hooks.ts for the browser: the same queries and
// the same sync, on this browser's storage.

export type VocabState = { log: Review[]; cards: Cards };

const deckKey = ['vocab-deck'] as const;
const stateKey = (person: string) => ['vocab-state', person] as const;
const settingsKey = (person: string) => ['vocab-settings', person] as const;

// The upload queue (localStorage) is only ever read and written back in one
// go, with no wait in between, so ratings and uploads (and other tabs) can't
// lose each other's changes, and a rating never waits on the network.
function unqueue(person: string, ids: string[]) {
  if (ids.length === 0) return;
  const gone = new Set(ids);
  savePending(person, loadPending(person).filter((id) => !gone.has(id)));
}

/** The log as saved, plus ratings made here that are still being written. */
function merged(saved: Review[], shown: VocabState | undefined): VocabState | undefined {
  const ids = new Set(saved.map((r) => r.id));
  const extra = (shown?.log ?? []).filter((r) => !ids.has(r.id));
  if (shown && saved.length + extra.length === shown.log.length) return shown; // nothing new
  const log = [...saved, ...extra];
  return { log, cards: replay(log) };
}

/** The deck in this browser (null until the first download). */
export function useDeck() {
  return useQuery({ queryKey: deckKey, queryFn: readDeck, staleTime: Infinity });
}

/** The person's review log and the cards it adds up to. */
export function useVocabState() {
  const person = usePerson();
  return useQuery({
    queryKey: stateKey(person),
    queryFn: async (): Promise<VocabState> => {
      const log = await readLog(person);
      return { log, cards: replay(log) };
    },
    staleTime: Infinity,
  });
}

export function useSettings() {
  const person = usePerson();
  return useQuery({ queryKey: settingsKey(person), queryFn: () => loadSettings(person), staleTime: Infinity });
}

export function useSaveSettings() {
  const person = usePerson();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (s: Settings) => {
      const next = { ...s, saved: true };
      queryClient.setQueryData(settingsKey(person), next);
      saveSettings(person, next);
    },
    // A list just turned on may have images to fetch.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vocab-sync', person] }),
  });
}

/**
 * Records a rating: appended to the log (and the upload queue) and applied
 * to that one card, so the screen updates at once without replaying the log.
 */
export function useRecordReview() {
  const person = usePerson();
  const queryClient = useQueryClient();
  return async (wordId: string, card: Card | undefined, rating: Grade, durationMs: number) => {
    const { card: next, review } = rate(card, wordId, rating, new Date(), durationMs, uuid());
    queryClient.setQueryData<VocabState>(stateKey(person), (s) => {
      const cards = new Map(s?.cards);
      cards.set(wordId, next);
      return { log: [...(s?.log ?? []), review], cards };
    });
    // In the log first, then queued: an id in the queue always has its line.
    await appendLog(person, [review]);
    savePending(person, [...loadPending(person), review.id]);
    return review;
  };
}

const CHUNK = 200;

/**
 * Brings this browser and the server together: a newer deck, the reviews
 * made here (uploaded), the ones made on the phone (fetched and merged), and
 * the image links of the lists turned on. Runs when the Words screens are
 * shown and when the tab comes back into focus; offline it fails quietly
 * and studying goes on with what is here.
 */
export function useVocabSync(enabled: boolean) {
  const person = usePerson();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['vocab-sync', person],
    enabled,
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      // Stops (quietly) if someone else signs in meanwhile: nothing of this
      // person's goes up under their account, nothing of theirs comes down.
      const same = sameSession();
      const stopped = { pending: 0 };

      // The deck.
      const have = queryClient.getQueryData<Deck | null>(deckKey) ?? (await readDeck());
      if (!same()) return stopped;
      const res = await call(api.GET('/v1/vocab/deck', { params: { query: have?.version ? { have: have.version } : {} } }));
      let deck = have;
      if (!res.unchanged && res.lists) {
        deck = { version: res.version, lists: res.lists };
        await writeDeck(deck);
        queryClient.setQueryData(deckKey, deck);
      }

      // Reviews made here, up to the server. A repeat (another tab, or a
      // sync started twice) is skipped by the server.
      const pending = loadPending(person);
      if (pending.length > 0) {
        const waiting = new Set(pending);
        const toSend = (await readLog(person)).filter((r) => waiting.has(r.id));
        // Ids with no log line (a cut-short write) can't be sent.
        const found = new Set(toSend.map((r) => r.id));
        unqueue(person, pending.filter((id) => !found.has(id)));
        for (let i = 0; i < toSend.length; i += CHUNK) {
          const batch = toSend.slice(i, i + CHUNK);
          if (!same()) return stopped;
          try {
            await call(api.POST('/v1/vocab/reviews', { body: { reviews: batch } }));
          } catch (e) {
            if (!(e instanceof ApiError && e.code === 'invalid_reviews')) throw e;
            // One review the server can't take refuses the whole batch: send
            // them one by one and give up on those refused, so the rest (and
            // every later rating) still go up.
            for (const r of batch) {
              if (!same()) return stopped;
              try {
                await call(api.POST('/v1/vocab/reviews', { body: { reviews: [r] } }));
              } catch (e2) {
                if (!(e2 instanceof ApiError && e2.code === 'invalid_reviews')) throw e2;
              }
              unqueue(person, [r.id]);
            }
            continue;
          }
          unqueue(person, batch.map((r) => r.id));
        }
      }

      // Reviews made on other devices, down to this one.
      let after = loadCursor(person);
      const fresh: Review[] = [];
      for (;;) {
        if (!same()) return stopped;
        const page = await call(api.GET('/v1/me/vocab/reviews', { params: { query: { after } } }));
        for (const { seq, ...r } of page.reviews) {
          after = Math.max(after, seq ?? 0);
          fresh.push(r as Review);
        }
        if (page.next == null) break;
      }
      if (!same()) return stopped;
      // The log as saved, with what came down (each review once) and what
      // another tab added: the screen shows all of it.
      const saved = fresh.length > 0 ? await appendLog(person, fresh) : await readLog(person);
      queryClient.setQueryData<VocabState>(stateKey(person), (shown) => merged(saved, shown));
      saveCursor(person, after);

      // Images of the lists turned on: their links, good for six hours.
      const settings = loadSettings(person);
      const state = queryClient.getQueryData<VocabState>(stateKey(person));
      const active = deck ? activeLists(settings, deck, state?.cards ?? replay(await readLog(person))) : [];
      for (const list of deck?.lists ?? []) {
        if (!active.includes(list.slug) || !same()) continue;
        if (list.words.every((w) => !w.image || hasImage(w.image.file))) continue;
        try {
          const res = await call(api.GET('/v1/vocab/lists/{slug}/images', { params: { path: { slug: list.slug } } }));
          storeImageLinks(res.images, res.expires_at);
        } catch {
          // Next time; the words work without their pictures.
        }
      }
      return { pending: loadPending(person).length };
    },
  });
}
