import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, call } from './client';
import { meKey } from './queries';
import type { Profile } from './types';

// Roadmaps (makonbook-api docs/platform-spec.md, "Roadmaps"): SAT MAKON's
// curriculum as a journey. A course (subject × level) is countries → units
// (each a stop at a university) → lessons. A lesson is done when its level
// check is passed (70 %+) and every homework set is finished; the next lesson
// then opens. Enrolled students get their groups' courses with everything
// open; free accounts get theirs from onboarding, with the first country open.
// Level checks and homework are graded on the server.

export type Subject = 'math' | 'english';
export type Level = 'foundation' | 'pre-sat' | 'advanced';
export type Status = 'done' | 'open' | 'locked';
export type Lock = null | 'previous' | 'enrolled_only';

export type RoadmapSummary = {
  id: string;
  subject: Subject;
  level: Level;
  title: string;
  source: 'group' | 'onboarding';
  group_name: string | null;
  lessons_done: number;
  lessons_total: number;
  units_done: number;
  units_total: number;
  current: { unit_id: string; unit_title: string; lesson_id: string; lesson_title: string; university: string } | null;
  /** Free accounts: how many units are open (the first country); null: all. */
  free_units: number | null;
};

export type RoadmapLesson = {
  id: string;
  title: string;
  minutes: number;
  status: Status;
  lock: Lock;
  level_check: { questions: number; best: number | null; passed: boolean };
  homework: { sets: number; done: number };
};

export type RoadmapUnit = {
  id: string;
  title: string;
  domain: string;
  summary: string;
  stop: { university: string; city: string; country: string };
  status: Status;
  lock: Lock;
  lessons: RoadmapLesson[];
};

export type Country = { id: string; name: string; code: string | null; units: string[] };

export type Roadmap = RoadmapSummary & { countries: Country[]; units: RoadmapUnit[] };

export type Example = { problem: string; steps: string[]; answer: string };

export type LessonDetail = {
  lesson: {
    id: string;
    title: string;
    unit_id: string;
    minutes: number;
    skills: string[];
    objectives: string[];
    notes: string;
    examples: Example[];
    common_mistakes: string[];
    status: Status;
    lock: Lock;
  };
  level_check: {
    questions: number;
    mix: { easy: number; medium: number; hard: number };
    pass_percent: number;
    best: number | null;
    passed: boolean;
    attempts: { id: string; percent: number; finished_at: string }[];
    open: { id: string } | null;
  };
  homework: {
    index: number;
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
    questions: number;
    done: boolean;
    attempt: { id: string; percent: number; finished_at: string } | null;
    open: { id: string } | null;
  }[];
};

export type AssessmentQuestion = {
  id: string;
  position: number;
  type: 'mcq' | 'grid_in';
  passage: string | null;
  stem: string;
  choices: Record<string, string> | null;
  figures: { key: string; kind?: string; alt?: string }[];
  domain: string;
  skill: string;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  // Once finished:
  correct?: string | null;
  accepted?: string[] | null;
  explanation?: string;
};

export type AssessmentResult = {
  percent: number;
  correct: number;
  total: number;
  passed: boolean;
  lesson_done: boolean;
  items: { question_id: string; given: string | null; correct: boolean; correct_answer: string; explanation: string }[];
};

export type Assessment = {
  id: string;
  kind: 'level_check' | 'homework';
  roadmap_id: string;
  lesson_id: string;
  homework_index: number | null;
  title: string;
  subject: Subject;
  created_at: string;
  finished_at: string | null;
  questions: AssessmentQuestion[];
  images: Record<string, { url: string; width: number; height: number }>;
  answers: Record<string, string | null>;
  result: AssessmentResult | null;
};

export type Onboarding = {
  graduation: string;
  sat_dates: string[];
  current: null | { total: number } | { math: number; rw: number };
  target: { total: number; math: number; rw: number };
  focus: 'math' | 'english' | 'both';
  schedule: { days: string[]; minutes: 15 | 30 | 45 | 60 };
};

export const LEVEL_LABEL: Record<Level, string> = { foundation: 'Foundation', 'pre-sat': 'Pre-SAT', advanced: 'Advanced' };

const roadmapsKey = ['roadmaps'] as const;

export function useRoadmaps(enabled = true) {
  return useQuery({
    queryKey: roadmapsKey,
    enabled,
    queryFn: async () => (await call(api.GET('/v1/me/roadmaps'))).roadmaps as RoadmapSummary[],
  });
}

export function useRoadmap(id: string) {
  return useQuery({
    queryKey: [...roadmapsKey, id],
    queryFn: async () => (await call(api.GET('/v1/me/roadmaps/{id}', { params: { path: { id } } }))) as Roadmap,
  });
}

export function useLesson(id: string, lessonId: string) {
  return useQuery({
    queryKey: [...roadmapsKey, id, 'lesson', lessonId],
    retry: false,
    queryFn: async () => (await call(api.GET('/v1/me/roadmaps/{id}/lessons/{lessonId}', { params: { path: { id, lessonId } } }))) as LessonDetail,
  });
}

/** A level check or a homework set: the unfinished one, or a new one. */
export function useStartAssessment(id: string, lessonId: string) {
  return useMutation({
    mutationFn: async (body: { kind: 'level_check' } | { kind: 'homework'; index: number }) =>
      (await call(api.POST('/v1/me/roadmaps/{id}/lessons/{lessonId}/assessments', { params: { path: { id, lessonId } }, body }))) as Assessment,
  });
}

const assessmentKey = (id: string) => ['assessment', id] as const;

export function useAssessment(id: string) {
  return useQuery({
    queryKey: assessmentKey(id),
    retry: false,
    // An open assessment is the person's own work in progress: never refetched under them.
    staleTime: Infinity,
    queryFn: async () => (await call(api.GET('/v1/me/assessments/{id}', { params: { path: { id } } }))) as Assessment,
  });
}

export function saveAnswers(id: string, answers: Record<string, string | null>) {
  return call(api.PUT('/v1/me/assessments/{id}/answers', { params: { path: { id } }, body: { answers } }));
}

export function useSubmitAssessment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (answers: Record<string, string | null>) => (await call(api.POST('/v1/me/assessments/{id}/submit', { params: { path: { id } }, body: { answers } }))) as Assessment,
    onSuccess: (a) => {
      queryClient.setQueryData(assessmentKey(id), a);
      // Progress changed: the map, the lesson and the list.
      void queryClient.invalidateQueries({ queryKey: roadmapsKey });
    },
  });
}

export function useSaveOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Onboarding) => (await call(api.POST('/v1/me/onboarding', { body }))) as { profile: Profile; roadmaps: RoadmapSummary[] },
    onSuccess: (r) => {
      queryClient.setQueryData(meKey, r.profile);
      queryClient.setQueryData(roadmapsKey, r.roadmaps);
      void queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}
