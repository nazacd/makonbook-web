import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usePerson } from '@/lib/practice/hooks';

import { ApiError, api, call } from './client';
import { assessmentKey, type Assessment } from './roadmaps';
import type { components } from './schema';

// Competitions (makonbook-api docs/platform-spec.md §26): timed contests on
// SAT questions, one attempt each, taken in AssessmentRun. The server keeps
// the clock: every answer carries its server_time, and the client measures
// time left against it, never against this computer's clock alone.

type Schemas = components['schemas'];
export type Competition = Schemas['Competition'];
export type CompetitionBoard = Schemas['CompetitionBoard'];
export type BoardEntry = Schemas['CompetitionBoardEntry'];

export const competitionsKey = (person: string) => ['competitions', person] as const;

/** The list, and how far this computer's clock is from the server's (ms to add to Date.now()). */
export function useCompetitions() {
  const person = usePerson();
  return useQuery({
    queryKey: competitionsKey(person),
    refetchInterval: 60_000,
    queryFn: async () => {
      const r = await call(api.GET('/v1/competitions'));
      return { competitions: r.competitions, skew: Date.parse(r.server_time) - Date.now() };
    },
  });
}

export function useCompetition(id: string) {
  const person = usePerson();
  return useQuery({
    queryKey: [...competitionsKey(person), id],
    refetchInterval: 30_000,
    queryFn: async () => {
      const r = await call(api.GET('/v1/competitions/{id}', { params: { path: { id } } }));
      return { competition: r.competition, skew: Date.parse(r.server_time) - Date.now() };
    },
  });
}

/** The board; refreshed every 15 s while the competition is live. */
export function useCompetitionBoard(id: string, live: boolean) {
  const person = usePerson();
  return useQuery({
    queryKey: [...competitionsKey(person), id, 'board'],
    refetchInterval: live ? 15_000 : false,
    queryFn: () => call(api.GET('/v1/competitions/{id}/board', { params: { path: { id } } })),
  });
}

/** Starts (or continues) the student's one attempt. */
export function useStartCompetition() {
  const queryClient = useQueryClient();
  const person = usePerson();
  return useMutation({
    mutationFn: async (id: string): Promise<Assessment> => call(api.POST('/v1/competitions/{id}/start', { params: { path: { id } } })),
    onSuccess: (a) => queryClient.setQueryData(assessmentKey(a.id), a),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: competitionsKey(person) }),
  });
}

/** Whether an error is the server saying the attempt's time is over. */
export const isTimeUp = (e: unknown) => e instanceof ApiError && e.code === 'time_up';

/** "1:05:09" or "4:09". */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** "in 3 days", "in 5 h 20 min", "in 12 min" — for times further off than the clock is worth. */
export function untilWords(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
  return `${Math.round(h / 24)} days`;
}
