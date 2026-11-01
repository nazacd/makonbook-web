import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, call } from './client';
import type { Schemas } from './client';

// The phone's src/lib/api/attendance.ts, for the teacher's screens.

export type TeacherLesson = Schemas['Lesson'];
export type AttendanceSession = Schemas['AttendanceSession'];
export type AttendanceMark = AttendanceSession['marks'][number];
export type MarkState = AttendanceMark['state'];

/** A session as fetched, plus when it arrived, to correct this computer's clock. */
export type FetchedSession = AttendanceSession & { receivedAt: number };

function stamp(s: AttendanceSession): FetchedSession {
  return { ...s, receivedAt: Date.now() };
}

export const lessonsKey = (date: string) => ['teacher-lessons', date] as const;
export const sessionKey = (id: string) => ['attendance-session', id] as const;

export function useTeacherLessons(date: string, live: boolean) {
  return useQuery({
    queryKey: lessonsKey(date),
    queryFn: () => call(api.GET('/v1/teacher/lessons', { params: { query: { date } } })),
    // Today's list changes as lessons start and sessions open/finish.
    refetchInterval: live ? 60_000 : false,
  });
}

// While a session is open the teacher's screen polls it, so scans appear
// within a few seconds (spec 8.1).
export function useAttendanceSession(id: string) {
  return useQuery({
    queryKey: sessionKey(id),
    queryFn: async () => stamp(await call(api.GET('/v1/attendance/sessions/{id}', { params: { path: { id } } }))),
    refetchInterval: (query) => (query.state.data?.status === 'open' ? 3_000 : false),
  });
}

export function useOpenSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { group_id: number; date: string }) => call(api.POST('/v1/attendance/sessions', { body })),
    onSuccess: (s, body) => {
      queryClient.setQueryData(sessionKey(s.id), stamp(s));
      void queryClient.invalidateQueries({ queryKey: lessonsKey(body.date) });
    },
  });
}

export function useFinishSession(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => call(api.POST('/v1/attendance/sessions/{id}/finish', { params: { path: { id } } })),
    onSuccess: (s) => {
      queryClient.setQueryData(sessionKey(id), stamp(s));
      void queryClient.invalidateQueries({ queryKey: lessonsKey(s.date) });
    },
  });
}

export function useSetMark(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, state }: { clientId: number; state: Exclude<MarkState, 'pending'> }) =>
      call(api.PUT('/v1/attendance/sessions/{id}/marks/{client_id}', { params: { path: { id, client_id: clientId } }, body: { state } })),
    onSuccess: (s) => queryClient.setQueryData(sessionKey(id), stamp(s)),
  });
}
