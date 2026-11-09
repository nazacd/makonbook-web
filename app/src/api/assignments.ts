import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usePerson } from '@/lib/practice/hooks';

import { api, call, type Schemas } from './client';

// Assignments (makonbook-api docs/platform-spec.md, section 23): teachers give
// their groups homework, level checks and exams with deadlines. Students see
// theirs on the Homework, Level Checks and Exams tabs: homework and level
// checks are taken as assessments (the roadmap's runner), exams as the mock
// test itself. The first finished work is the result; later tries are
// practice. New assignments show in the notifications drawer.

export type AssignmentKind = Schemas['AssignmentKind'];
export type Assignment = Schemas['Assignment'];
export type AssignmentDetail = Schemas['AssignmentDetail'];
export type AssignmentInput = Schemas['AssignmentInput'];
export type AssignmentUpdate = Schemas['AssignmentUpdate'];
export type AssignmentQuestion = Schemas['AssignmentQuestion'];
export type StudentAssignment = Schemas['StudentAssignment'];
export type Standing = Schemas['AssignmentStanding'];
export type AssignmentResults = Schemas['AssignmentResults'];
export type StudentResult = Schemas['AssignmentStudentResult'];
export type QuestionStats = Schemas['AssignmentQuestionStats'];
export type DrawInput = Schemas['DrawInput'];
export type DrawResult = Schemas['DrawResult'];
export type Mix = Schemas['AssignmentMix'];
export type QuestionPreview = Schemas['QuestionPreview'];
export type TeacherCurriculum = Schemas['TeacherCurriculum'];
export type CurriculumCourse = TeacherCurriculum['courses'][number];
export type CurriculumLesson = CurriculumCourse['units'][number]['lessons'][number];
export type TeacherTaxonomy = Schemas['TeacherTaxonomy'];
export type GroupRoadmap = Schemas['GroupRoadmap'];
export type Notification = Schemas['Notification'];
export type ImageLinks = Schemas['ImageLinks'];

/** The tab of each kind, as the sidebar and the links name them. */
export const KIND: Record<AssignmentKind, { label: string; plural: string; path: string; one: string }> = {
  homework: { label: 'Homework', plural: 'Homework', path: '/homework', one: 'homework' },
  level_check: { label: 'Level check', plural: 'Level Checks', path: '/level-checks', one: 'level check' },
  exam: { label: 'Exam', plural: 'Exams', path: '/exams', one: 'exam' },
};

// --- Students ---

const myKey = (person: string) => ['assignments', 'mine', person] as const;

export function useMyAssignments(enabled = true) {
  const person = usePerson();
  return useQuery({
    queryKey: myKey(person),
    enabled,
    staleTime: 60_000,
    queryFn: async () => (await call(api.GET('/v1/me/assignments'))).assignments,
  });
}

/** Starts an assigned homework or level check (or continues the open one). */
export function useStartAssignment() {
  const person = usePerson();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call(api.POST('/v1/me/assignments/{id}/start', { params: { path: { id } } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: myKey(person) }),
  });
}

/** What a student still has to do: open or overdue, not done. */
/** Work to do now: not finished, open (a scheduled one is shown locked, not counted), not closed. */
export const isDue = (a: StudentAssignment) => a.mine.status !== 'done' && a.status !== 'closed' && a.status !== 'scheduled';

// --- Notifications ---

const notificationsKey = (person: string) => ['notifications', person] as const;

export function useNotifications(enabled = true) {
  const person = usePerson();
  return useQuery({
    queryKey: notificationsKey(person),
    enabled,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: () => call(api.GET('/v1/me/notifications')),
  });
}

export function useReadNotifications() {
  const person = usePerson();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { ids: number[] } | { all: true }) => call(api.PUT('/v1/me/notifications/read', { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: notificationsKey(person) }),
  });
}

// --- Teachers ---

const teacherKey = ['assignments', 'teacher'] as const;

export function useTeacherAssignments(groupId?: number) {
  return useQuery({
    queryKey: [...teacherKey, 'list', groupId ?? 'all'],
    queryFn: async () => (await call(api.GET('/v1/teacher/assignments', { params: { query: groupId ? { group_id: groupId } : {} } }))).assignments,
  });
}

export function useAssignment(id: string) {
  return useQuery({
    queryKey: [...teacherKey, 'one', id],
    queryFn: () => call(api.GET('/v1/teacher/assignments/{id}', { params: { path: { id } } })),
  });
}

export function useAssignmentResults(id: string) {
  return useQuery({
    queryKey: [...teacherKey, 'results', id],
    refetchInterval: 60_000,
    queryFn: () => call(api.GET('/v1/teacher/assignments/{id}/results', { params: { path: { id } } })),
  });
}

export function useStudentWork(id: string, clientId: number | null) {
  return useQuery({
    queryKey: [...teacherKey, 'work', id, clientId],
    enabled: clientId != null,
    queryFn: () => call(api.GET('/v1/teacher/assignments/{id}/results/{client_id}', { params: { path: { id, client_id: clientId! } } })),
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AssignmentInput) => call(api.POST('/v1/teacher/assignments', { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: teacherKey }),
  });
}

export function useUpdateAssignment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AssignmentUpdate) => call(api.PUT('/v1/teacher/assignments/{id}', { params: { path: { id } }, body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: teacherKey }),
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call(api.DELETE('/v1/teacher/assignments/{id}', { params: { path: { id } } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: teacherKey }),
  });
}

export function drawQuestions(body: DrawInput) {
  return call(api.POST('/v1/teacher/assignments/draw', { body }));
}

export function useTeacherQuestions(params: { subject: 'math' | 'english'; skill?: string; difficulty?: 'easy' | 'medium' | 'hard'; q?: string }, enabled = true) {
  return useQuery({
    queryKey: ['teacher-questions', params],
    enabled,
    queryFn: () => call(api.GET('/v1/teacher/questions', { params: { query: { ...params, limit: 30 } } })),
  });
}

export function useTeacherTaxonomy() {
  return useQuery({ queryKey: ['teacher-taxonomy'], staleTime: 10 * 60_000, queryFn: () => call(api.GET('/v1/teacher/taxonomy')) });
}

export function useTeacherCurriculum() {
  return useQuery({ queryKey: ['teacher-curriculum'], staleTime: 10 * 60_000, queryFn: async () => (await call(api.GET('/v1/teacher/curriculum'))).courses });
}

export function useGroupRoadmap(groupId: number) {
  return useQuery({ queryKey: ['group-roadmap', groupId], queryFn: () => call(api.GET('/v1/teacher/groups/{id}/roadmap', { params: { path: { id: groupId } } })) });
}
