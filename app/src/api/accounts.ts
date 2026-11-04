import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, call } from './client';
import { meKey } from './queries';
import type { Profile } from './types';

// Accounts (makonbook-api docs/platform-spec.md, "Accounts"): sign-up and
// password reset by SMS code, Google sign-in, and changing your own name.
// Sign-up makes student accounts only; a phone that already belongs to a
// SATMAKON student or teacher signs into that account instead.

export type Purpose = 'signup' | 'reset';

/** What this server offers: sign-up by SMS, Google sign-in. */
export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    staleTime: 10 * 60_000,
    queryFn: () => call(api.GET('/v1/app/config')),
  });
}

export function sendCode(phone: string, purpose: Purpose) {
  return call(api.POST('/v1/auth/phone/start', { body: { phone, purpose } }));
}

export async function checkCode(phone: string, code: string, purpose: Purpose) {
  return (await call(api.POST('/v1/auth/phone/verify', { body: { phone, code, purpose } }))).ticket;
}

export function signUp(body: { ticket: string; first_name: string; last_name: string; password: string | null; google_ticket: string | null }) {
  return call(api.POST('/v1/auth/signup', { body }));
}

export function resetPassword(ticket: string, password: string) {
  return call(api.POST('/v1/auth/reset', { body: { ticket, password } }));
}

export function googleTicket(ticket: string) {
  return call(api.POST('/v1/auth/google/ticket', { body: { ticket } }));
}

/** Leaves the app for Google; Google comes back to /auth/google. */
export function startGoogle(returnTo = '/') {
  window.location.assign(`/v1/auth/google/start?return=${encodeURIComponent(returnTo)}`);
}

export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { first_name: string | null; last_name: string | null }) => call(api.PUT('/v1/me/profile', { body })),
    onSuccess: (profile: Profile) => queryClient.setQueryData(meKey, profile),
  });
}

/** "+998 90 123 45 67" from what a person typed (9 digits, or with 998). */
export function formatUzPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').replace(/^998/, '').slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
}
