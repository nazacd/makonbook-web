import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDeck, useSaveSettings, useSettings } from '@/lib/vocab/hooks';
import { usePerson } from '@/lib/practice/hooks';
import type { Deck, VocabList } from '@/lib/vocab/types';

import { api, ApiError, call, sameSession } from './client';
import type { components } from './schema';

// Vocabulary, social (makonbook-api docs/platform-spec.md §11.4–11.6): the
// games' results on the server, the monthly leaderboard, and students' own
// decks (private or shared, moderated by teachers and reports).

type Schemas = components['schemas'];
export type UserDeck = Schemas['VocabUserDeck'];
export type DeckInput = Schemas['VocabDeckInput'];
export type BoardEntry = Schemas['VocabBoardEntry'];
export type GameResultIn = Schemas['VocabGameResult'];
export type GameStat = Schemas['VocabGameStat'];

/** A deck's words go into the study lists under this slug. */
export const deckSlug = (id: string) => `deck:${id}`;
export const isDeckSlug = (slug: string) => slug.startsWith('deck:');

// --- The person's decks, kept in this browser too so studying works offline.

const decksKey = (person: string) => ['vocab-decks', person] as const;
const stored = (person: string) => `mb.vocab.${person}.decks`;

function readStored(person: string): UserDeck[] | undefined {
  try {
    const raw = localStorage.getItem(stored(person));
    return raw ? (JSON.parse(raw) as UserDeck[]) : undefined;
  } catch {
    return undefined;
  }
}

export function useMyDecks(enabled = true) {
  const person = usePerson();
  return useQuery({
    queryKey: decksKey(person),
    enabled,
    initialData: () => readStored(person),
    initialDataUpdatedAt: 0,
    queryFn: async () => {
      const decks = (await call(api.GET('/v1/me/vocab/decks'))).decks;
      try {
        localStorage.setItem(stored(person), JSON.stringify(decks));
      } catch {
        // Storage blocked: the decks come from the server each time.
      }
      return decks;
    },
  });
}

/**
 * What the student studies: SAT MAKON's lists, then their decks (own and
 * added) as lists of their own. Everything that schedules or plays words
 * reads this, so a deck's words are studied like any list's.
 */
export function useStudyDeck() {
  const deck = useDeck();
  const decks = useMyDecks();
  const data = useMemo<Deck | null | undefined>(() => {
    if (!deck.data) return deck.data;
    const own: VocabList[] = (decks.data ?? []).filter((d) => d.words.length > 0).map((d) => ({ slug: deckSlug(d.id), title: d.title, words: d.words.map((w) => ({ ...w, image: null })) }));
    return own.length ? { version: deck.data.version, lists: [...deck.data.lists, ...own] } : deck.data;
  }, [deck.data, decks.data]);
  return { ...deck, data };
}

export function useCommunity(q: string, moderation = false) {
  return useQuery({
    queryKey: ['vocab-community', q, moderation],
    queryFn: async () => (await call(api.GET('/v1/vocab/decks', { params: { query: { q: q || undefined, moderation: moderation ? '1' : undefined } } }))).decks,
  });
}

export function useDeckDetail(id: string) {
  return useQuery({ queryKey: ['vocab-deck-detail', id], queryFn: () => call(api.GET('/v1/vocab/decks/{id}', { params: { path: { id } } })) });
}

/** After any change to decks: what the person studies, the community and the deck itself. */
function useRefreshDecks() {
  const queryClient = useQueryClient();
  const person = usePerson();
  return (id?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: decksKey(person) }),
      queryClient.invalidateQueries({ queryKey: ['vocab-community'] }),
      id ? queryClient.invalidateQueries({ queryKey: ['vocab-deck-detail', id] }) : null,
    ]);
}

export function useSaveDeck() {
  const refresh = useRefreshDecks();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: DeckInput }) => {
      if (id) {
        await call(api.PUT('/v1/vocab/decks/{id}', { params: { path: { id } }, body: input }));
        return id;
      }
      return (await call(api.POST('/v1/vocab/decks', { body: input }))).id;
    },
    onSuccess: (id) => refresh(id),
  });
}

type DeckAction = 'delete' | 'publish' | 'unpublish' | 'add' | 'remove' | 'keep';

export function useDeckAction() {
  const refresh = useRefreshDecks();
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: DeckAction }) => {
      const path = { params: { path: { id } } };
      if (action === 'delete') await call(api.DELETE('/v1/vocab/decks/{id}', path));
      if (action === 'publish') await call(api.PUT('/v1/vocab/decks/{id}/published', path));
      if (action === 'unpublish') await call(api.DELETE('/v1/vocab/decks/{id}/published', path));
      if (action === 'add') await call(api.PUT('/v1/vocab/decks/{id}/added', path));
      if (action === 'remove') await call(api.DELETE('/v1/vocab/decks/{id}/added', path));
      if (action === 'keep') await call(api.DELETE('/v1/vocab/decks/{id}/hidden', path));
      return id;
    },
    onSuccess: (id, { action }) => {
      // An added deck is studied straight away; a removed one stops.
      const s = settings.data;
      if (s && action === 'add' && !s.active.includes(deckSlug(id))) saveSettings.mutate({ ...s, active: [...s.active, deckSlug(id)] });
      if (s && (action === 'remove' || action === 'delete') && s.active.includes(deckSlug(id))) saveSettings.mutate({ ...s, active: s.active.filter((x) => x !== deckSlug(id)) });
      return refresh(id);
    },
  });
}

export function useReportDeck() {
  const refresh = useRefreshDecks();
  return useMutation({
    mutationFn: async ({ id, reason, hide }: { id: string; reason: string; hide?: boolean }) => {
      if (hide) await call(api.PUT('/v1/vocab/decks/{id}/hidden', { params: { path: { id } }, body: { reason } }));
      else await call(api.POST('/v1/vocab/decks/{id}/report', { params: { path: { id } }, body: { reason } }));
      return id;
    },
    onSuccess: (id) => refresh(id),
  });
}

// --- The leaderboard.

export function useLeaderboard(scope: 'all' | 'groups', enabled = true) {
  return useQuery({ queryKey: ['vocab-board', scope], enabled, refetchOnMount: 'always', queryFn: () => call(api.GET('/v1/vocab/leaderboard', { params: { query: { scope } } })) });
}

// --- Game results: queued in this browser, sent when online.

const gamesKey = (person: string) => `mb.vocab.${person}.games-pending`;

function readPending(person: string): GameResultIn[] {
  try {
    return JSON.parse(localStorage.getItem(gamesKey(person)) ?? '[]') as GameResultIn[];
  } catch {
    return [];
  }
}

function writePending(person: string, list: GameResultIn[]) {
  try {
    localStorage.setItem(gamesKey(person), JSON.stringify(list));
  } catch {
    // Storage blocked: the result is sent now or not at all.
  }
}

/** Sends the results waiting in this browser; ones the server refuses are dropped. */
export async function sendGames(person: string) {
  const waiting = readPending(person);
  if (waiting.length === 0) return;
  const same = sameSession();
  try {
    await call(api.POST('/v1/vocab/games', { body: { results: waiting.slice(0, 50) } }));
  } catch (e) {
    if (!(e instanceof ApiError && e.code === 'invalid_games')) return; // offline: next time
  }
  if (!same()) return;
  const sent = new Set(waiting.slice(0, 50).map((g) => g.id));
  writePending(person, readPending(person).filter((g) => !sent.has(g.id)));
}

/** Records a finished round: queued here, then sent; the stats refresh. */
export function useRecordGame() {
  const person = usePerson();
  const queryClient = useQueryClient();
  return (result: GameResultIn) => {
    writePending(person, [...readPending(person), result]);
    void sendGames(person).then(() => Promise.all([queryClient.invalidateQueries({ queryKey: ['vocab-games', person] }), queryClient.invalidateQueries({ queryKey: ['vocab-board'] })]));
  };
}

/** The person's results at each game, from the server (every device's rounds). */
export function useGameStats(enabled = true) {
  const person = usePerson();
  return useQuery({
    queryKey: ['vocab-games', person],
    enabled,
    queryFn: async () => {
      await sendGames(person);
      return (await call(api.GET('/v1/me/vocab/games'))).games;
    },
  });
}

// --- Teachers.

export function useGroupGames(groupId: string) {
  return useQuery({ queryKey: ['vocab-group-games', groupId], queryFn: async () => (await call(api.GET('/v1/teacher/groups/{id}/vocab/games', { params: { path: { id: Number(groupId) } } }))).games });
}

/** How many decks wait for a teacher's look (hidden or reported). */
export function useDecksToCheck() {
  return useQuery({ queryKey: ['vocab-community', '', true], staleTime: 60_000, queryFn: async () => (await call(api.GET('/v1/vocab/decks', { params: { query: { moderation: '1' } } }))).decks });
}
