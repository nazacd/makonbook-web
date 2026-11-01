import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, api, call } from './client';
import type { MyAttendance, Profile } from './types';

export const meKey = ['me'] as const;
export const myAttendanceKey = ['my-attendance'] as const;

/** The signed-in person, seeded by the login answer. */
export function useMe(enabled = true) {
  return useQuery({
    queryKey: meKey,
    queryFn: () => call(api.GET('/v1/me')),
    enabled,
    // Offline, try again every half minute, so the page notices the
    // connection coming back while it's open.
    refetchInterval: (query) => (query.state.error instanceof ApiError && query.state.error.status === 0 ? 30_000 : false),
  });
}

/** The student's attendance table (GET /v1/me/attendance), per group. */
export function useMyAttendance(enabled = true) {
  return useQuery({
    queryKey: myAttendanceKey,
    queryFn: (): Promise<MyAttendance> => call(api.GET('/v1/me/attendance')),
    enabled,
  });
}

/** A student's parent code, for their parents (GET /v1/me/parent-code). */
export function useParentCode(enabled: boolean) {
  return useQuery({
    queryKey: ['me', 'parent-code'],
    queryFn: () => call(api.GET('/v1/me/parent-code')),
    enabled,
    staleTime: Infinity, // it never changes
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      call(api.POST('/v1/auth/password', { body })),
    onSuccess: () => {
      queryClient.setQueryData<Profile>(meKey, (me) => me && { ...me, must_change_password: false });
      void queryClient.invalidateQueries({ queryKey: meKey });
    },
  });
}

export function useSetUsername() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => call(api.PUT('/v1/auth/username', { body: { username } })),
    onSuccess: ({ username }) => {
      queryClient.setQueryData<Profile>(meKey, (me) => me && { ...me, username });
    },
  });
}
