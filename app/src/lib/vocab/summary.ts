import { useQueries, useQuery } from '@tanstack/react-query';

import { api, call } from '@/api/client';

import type { GroupVocabStudent } from './types';

// The phone's src/lib/vocab/summary.ts: per group, how many students studied
// words this week.

const KEEP_MS = 5 * 60_000;

export const groupVocabKey = (groupId: string) => ['vocab-group', groupId] as const;

export const fetchGroupVocab = async (groupId: string): Promise<{ words: number; students: GroupVocabStudent[] }> =>
  call(api.GET('/v1/teacher/groups/{id}/vocab', { params: { path: { id: Number(groupId) } } }));

export function useGroupVocab(groupId: string) {
  return useQuery({ queryKey: groupVocabKey(groupId), queryFn: () => fetchGroupVocab(groupId) });
}

export type GroupVocabSummary = { students: number; studied: number };

/** Each group's summary as it arrives; a group whose request failed has none. */
export function useVocabSummary(groupIds: number[]) {
  const queries = useQueries({
    queries: groupIds.map((id) => ({ queryKey: groupVocabKey(String(id)), queryFn: () => fetchGroupVocab(String(id)), staleTime: KEEP_MS })),
  });
  const groups: Record<number, GroupVocabSummary | undefined> = {};
  groupIds.forEach((id, i) => {
    const data = queries[i]?.data;
    if (data) groups[id] = { students: data.students.length, studied: data.students.filter((s) => s.reviews_week > 0).length };
  });
  return { groups, refetch: () => Promise.all(queries.map((q) => q.refetch())) };
}
