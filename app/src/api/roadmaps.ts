import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, call } from './client';
import { meKey } from './queries';
import type { components, paths } from './schema';

// Roadmaps (makonbook-api docs/platform-spec.md, "Roadmaps"): SAT MAKON's
// curriculum as a journey. A course (subject × level) is countries → units
// (each a stop at a university) → lessons. A lesson is done when its level
// check is passed (70 %+) and every homework set is finished; the next lesson
// then opens. Enrolled students get their groups' courses with everything
// open; free accounts get theirs from onboarding, with the first country open.
// Level checks and homework are graded on the server.

type Schemas = components['schemas'];

export type RoadmapSummary = Schemas['RoadmapSummary'];
export type Roadmap = paths['/v1/me/roadmaps/{id}']['get']['responses']['200']['content']['application/json'];
export type RoadmapUnit = Roadmap['units'][number];
export type RoadmapLesson = RoadmapUnit['lessons'][number];
export type Country = Roadmap['countries'][number];
export type Subject = RoadmapSummary['subject'];
export type Level = RoadmapSummary['level'];
/** A lesson as the client returns it (it leaves out `lock`, which is always null for a lesson you can open). */
export type LessonDetail = Awaited<ReturnType<typeof getLesson>>;
export type Example = LessonDetail['lesson']['examples'][number];
export type Assessment = Schemas['Assessment'];
export type AssessmentQuestion = Assessment['questions'][number];
export type AssessmentResult = NonNullable<Assessment['result']>;
export type Onboarding = Schemas['OnboardingInput'];

export const LEVEL_LABEL: Record<Level, string> = { foundation: 'Foundation', 'pre-sat': 'Pre-SAT', advanced: 'Advanced' };

const roadmapsKey = ['roadmaps'] as const;

export function useRoadmaps(enabled = true) {
  return useQuery({
    queryKey: roadmapsKey,
    enabled,
    queryFn: async () => (await call(api.GET('/v1/me/roadmaps'))).roadmaps,
  });
}

export function useRoadmap(id: string) {
  return useQuery({
    queryKey: [...roadmapsKey, id],
    queryFn: async () => (await call(api.GET('/v1/me/roadmaps/{id}', { params: { path: { id } } }))),
  });
}

const getLesson = (id: string, lessonId: string) => call(api.GET('/v1/me/roadmaps/{id}/lessons/{lessonId}', { params: { path: { id, lessonId } } }));

export function useLesson(id: string, lessonId: string) {
  return useQuery({
    queryKey: [...roadmapsKey, id, 'lesson', lessonId],
    retry: false,
    queryFn: () => getLesson(id, lessonId),
  });
}

/** A level check or a homework set: the unfinished one, or a new one. */
export function useStartAssessment(id: string, lessonId: string) {
  return useMutation({
    mutationFn: async (body: { kind: 'level_check' } | { kind: 'homework'; index: number }) =>
      (await call(api.POST('/v1/me/roadmaps/{id}/lessons/{lessonId}/assessments', { params: { path: { id, lessonId } }, body }))),
  });
}

const assessmentKey = (id: string) => ['assessment', id] as const;

export function useAssessment(id: string) {
  return useQuery({
    queryKey: assessmentKey(id),
    retry: false,
    // An open assessment is the person's own work in progress: never refetched under them.
    staleTime: Infinity,
    queryFn: async () => (await call(api.GET('/v1/me/assessments/{id}', { params: { path: { id } } }))),
  });
}

/** Saves answers (and seconds spent per question, for the teacher's statistics). */
export function saveAnswers(id: string, answers: Record<string, string | null>, times?: Record<string, number>) {
  return call(api.PUT('/v1/me/assessments/{id}/answers', { params: { path: { id } }, body: { answers, ...(times && Object.keys(times).length ? { times } : {}) } }));
}

export function useSubmitAssessment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ answers, times }: { answers: Record<string, string | null>; times: Record<string, number> }) => (await call(api.POST('/v1/me/assessments/{id}/submit', { params: { path: { id } }, body: { answers, times } }))),
    onSuccess: (a) => {
      queryClient.setQueryData(assessmentKey(id), a);
      // Progress changed: the map, the lesson and the list; and the assignments.
      void queryClient.invalidateQueries({ queryKey: roadmapsKey });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
}

export function useSaveOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Onboarding) => (await call(api.POST('/v1/me/onboarding', { body }))),
    onSuccess: (r) => {
      queryClient.setQueryData(meKey, r.profile);
      queryClient.setQueryData(roadmapsKey, r.roadmaps);
      void queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}
