import { useQuery } from '@tanstack/react-query';

import { usePerson } from '@/lib/practice/hooks';

import { api, call, type Schemas } from './client';

// Gamification (spec 27): XP, level, streak, quests and achievements, all
// computed by the server from what it recorded. Read on the dashboard and
// the Progress page; refetched after anything that earns XP is sent (the
// callers invalidate ['gamification']).

export type Gamification = Schemas['Gamification'];
export type Quest = Schemas['Quest'];

export const gamificationKey = (person: string) => ['gamification', person] as const;

export function useGamification(enabled = true) {
  const person = usePerson();
  return useQuery({ queryKey: gamificationKey(person), enabled, queryFn: () => call(api.GET('/v1/me/gamification')), staleTime: 30_000 });
}

/** "2,700" */
export const xp = (n: number) => n.toLocaleString('en-US');
