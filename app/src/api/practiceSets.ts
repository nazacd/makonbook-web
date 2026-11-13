import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usePerson } from '@/lib/practice/hooks';
import { schoolDate } from '@/lib/schedule';

import { api, ApiError, call } from './client';
import type { Assessment } from './roadmaps';
import type { components } from './schema';

// Practice sets and the question bank (makonbook-api docs/platform-spec.md
// §22.8): topics and questions to browse, and sets a student builds from
// them, run in AssessmentRun like a level check and graded on submit.

type Schemas = components['schemas'];
export type Taxonomy = Schemas['TeacherTaxonomy'];
export type QuestionPreview = Schemas['QuestionPreview'];
export type PracticeSet = Schemas['PracticeSet'];
export type PracticeInfo = Schemas['PracticeInfo'];
export type Subject = 'math' | 'english';
export type Difficulty = 'easy' | 'medium' | 'hard';

export const SUBJECTS: { value: Subject; label: string }[] = [
  { value: 'math', label: 'Math' },
  { value: 'english', label: 'Reading & Writing' },
];

export function useTopics() {
  return useQuery({ queryKey: ['practice-topics'], staleTime: 10 * 60_000, queryFn: async () => (await call(api.GET('/v1/me/practice/topics'))).subjects });
}

export type BankFilter = { subject: Subject; skill?: string; difficulty?: Difficulty; q?: string };

export const BANK_PAGE = 30;

export function useBankQuestions(f: BankFilter, page: number) {
  return useQuery({
    queryKey: ['practice-bank', f, page],
    placeholderData: (prev) => prev,
    queryFn: () =>
      call(
        api.GET('/v1/me/practice/questions', {
          params: { query: { subject: f.subject, skill: f.skill || undefined, difficulty: f.difficulty, q: f.q || undefined, limit: BANK_PAGE, offset: page * BANK_PAGE } },
        }),
      ),
  });
}

const setsKey = (person: string) => ['practice-sets', person] as const;

export function usePracticeSets() {
  const person = usePerson();
  return useQuery({ queryKey: setsKey(person), queryFn: () => call(api.GET('/v1/me/practice/sets')) });
}

export type PracticeRequest = {
  subject: Subject;
  skills?: string[];
  difficulty?: Difficulty | 'mixed';
  count?: number;
  seconds_per_question?: number;
  question_ids?: string[];
};

/** Starting answered 409 practice_open: the unfinished set, to continue or discard. */
export class PracticeOpenError extends Error {
  constructor(public open: Assessment) {
    super('practice_open');
  }
}

export function useStartPractice() {
  const person = usePerson();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: PracticeRequest): Promise<Assessment> => {
      const res = await api.POST('/v1/me/practice/sets', { body });
      if (res.response.status === 409) {
        const open = (res.error as { open?: Assessment } | undefined)?.open;
        if (open) throw new PracticeOpenError(open);
      }
      return call(Promise.resolve(res));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: setsKey(person) }),
  });
}

export function useDiscardPractice() {
  const person = usePerson();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call(api.DELETE('/v1/me/practice/sets/{id}', { params: { path: { id } } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: setsKey(person) }),
  });
}

/** How many questions a free account has left today (null: no limit). */
export function leftToday(sets: PracticeSet[], perDay: number | null, now: number): number | null {
  if (perDay == null) return null;
  const today = schoolDate(now);
  const used = sets.filter((s) => schoolDate(Date.parse(s.created_at)) === today).reduce((n, s) => n + s.questions, 0);
  return Math.max(0, perDay - used);
}

export const isPracticeLimit = (e: unknown) => e instanceof ApiError && e.code === 'practice_limit';
