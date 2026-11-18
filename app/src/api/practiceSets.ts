import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usePerson } from '@/lib/practice/hooks';

import { api, call } from './client';
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
  mode?: 'rush' | 'own_pace';
  unsolved?: boolean;
  shuffle?: boolean;
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

// --- Analytics, saved questions, checking one question.

export type PracticeStats = Schemas['PracticeStats'];

const statsKey = (person: string) => ['practice-stats', person] as const;

export function usePracticeStats() {
  const person = usePerson();
  return useQuery({ queryKey: statsKey(person), queryFn: () => call(api.GET('/v1/me/practice/stats')) });
}

const savedKey = (person: string) => ['practice-saved', person] as const;

export function useSavedQuestions() {
  const person = usePerson();
  return useQuery({ queryKey: savedKey(person), queryFn: async () => (await call(api.GET('/v1/me/practice/saved'))).questions });
}

/** Saves (or unsaves) a question; the list and the analytics refresh. */
export function useSaveQuestion() {
  const person = usePerson();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const path = { params: { path: { id } } };
      if (on) await call(api.PUT('/v1/me/practice/saved/{id}', path));
      else await call(api.DELETE('/v1/me/practice/saved/{id}', path));
    },
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: savedKey(person) }), queryClient.invalidateQueries({ queryKey: statsKey(person) })]),
  });
}

export type Checked = { correct: boolean; answer: string; correct_answer: string | null; accepted: string[]; explanation: string };

/** Checks one question of a set taken at one's own pace. */
export async function checkQuestion(assessment: string, questionId: string, answer: string, seconds: number): Promise<Checked> {
  return call(api.POST('/v1/me/assessments/{id}/check', { params: { path: { id: assessment } }, body: { question_id: questionId, answer, seconds } }));
}

export const PRACTICE_STATS_KEY = statsKey;
