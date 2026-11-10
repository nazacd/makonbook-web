import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usePerson } from '@/lib/practice/hooks';

import { api, call, type Schemas } from './client';
import type { paths } from './schema';

// The relaunch's API pieces (makonbook-api docs/platform-spec.md): each
// question's share of right answers, "Ask later" (parked questions), issue
// reports from the test screen, and the student's SAT goals.

export type ParkedQuestion = Schemas['ParkedQuestion'];
export type ParkedInput = Schemas['ParkedQuestionInput'];
export type ParkReason = NonNullable<ParkedInput['reason']>;
export type ReportInput = paths['/v1/practice/reports']['post']['requestBody']['content']['application/json'];
export type ReportReason = NonNullable<ReportInput['reason']>;
export type Goals = Schemas['Goals'];

export const PARK_REASONS: { value: ParkReason; label: string }[] = [
  { value: 'didnt_understand', label: 'Didn’t understand the question' },
  { value: 'didnt_know_start', label: 'Didn’t know how to start' },
  { value: 'lost_partway', label: 'Got lost partway' },
  { value: 'ran_out_of_time', label: 'Ran out of time' },
];
export const parkReasonLabel = (r: ParkReason | null | undefined) => PARK_REASONS.find((x) => x.value === r)?.label ?? 'Parked to ask later';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'answer_key_wrong', label: 'Answer key looks wrong' },
  { value: 'typo', label: 'Typo or wording mistake' },
  { value: 'unclear', label: 'Question is unclear or ambiguous' },
  { value: 'image_broken', label: 'Image or graph is broken' },
  { value: 'formatting', label: 'Math or formatting not rendering' },
  { value: 'other', label: 'Something else' },
];

/** Per question id: how many students answered it and how many got it right. */
export function useQuestionStats(code: string | undefined) {
  return useQuery({
    queryKey: ['question-stats', code],
    enabled: !!code,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const res = await call(api.GET('/v1/practice/tests/{code}/stats', { params: { path: { code: code! } } }));
      return new Map(res.questions.map((q) => [q.id, q]));
    },
  });
}

/** The share of students who got a question right (0–1), or null with too few answers to say. */
export function correctRate(stat: { answered: number; correct: number } | undefined): number | null {
  if (!stat || stat.answered < 5) return null;
  return stat.correct / stat.answered;
}

const parkedKey = (person: string) => ['parked', person] as const;

export function useParked(enabled = true) {
  const person = usePerson();
  return useQuery({
    queryKey: parkedKey(person),
    enabled,
    queryFn: async () => (await call(api.GET('/v1/me/parked'))).items,
  });
}

/** Parks a question or changes a parked one; the list updates at once. */
export function useSaveParked() {
  const person = usePerson();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ParkedInput & { id: string }) => call(api.PUT('/v1/me/parked/{id}', { params: { path: { id } }, body })),
    onSuccess: (item) =>
      queryClient.setQueryData<ParkedQuestion[]>(parkedKey(person), (list) => {
        const rest = (list ?? []).filter((p) => p.id !== item.id);
        return [item, ...rest].sort((a, b) => b.created_at.localeCompare(a.created_at));
      }),
  });
}

export function useDeleteParked() {
  const person = usePerson();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call(api.DELETE('/v1/me/parked/{id}', { params: { path: { id } } })),
    onSuccess: (_, id) => queryClient.setQueryData<ParkedQuestion[]>(parkedKey(person), (list) => (list ?? []).filter((p) => p.id !== id)),
  });
}

/** What a teacher's group parked (teachers). */
export function useGroupParked(groupId: number, enabled = true) {
  return useQuery({
    queryKey: ['group-parked', groupId],
    enabled,
    queryFn: async () => (await call(api.GET('/v1/teacher/groups/{id}/parked', { params: { path: { id: groupId } } }))).items,
  });
}

export function useReportQuestion() {
  return useMutation({ mutationFn: (body: ReportInput) => call(api.POST('/v1/practice/reports', { body })) });
}

const goalsKey = (person: string) => ['goals', person] as const;

export function useGoals(enabled = true) {
  const person = usePerson();
  return useQuery({ queryKey: goalsKey(person), enabled, queryFn: () => call(api.GET('/v1/me/goals')) });
}

export function useSaveGoals() {
  const person = usePerson();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { target_math: number | null; target_rw: number | null; exam_date: string | null; university_id?: string | null }) => call(api.PUT('/v1/me/goals', { body })),
    onSuccess: (g) => queryClient.setQueryData(goalsKey(person), g),
  });
}
