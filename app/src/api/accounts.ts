import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deviceId } from '@/lib/device-id';

import { api, call } from './client';
import { meKey } from './queries';
import type { LoginResponse, Profile } from './types';

// Accounts (makonbook-api docs/platform-spec.md, "Accounts"):
// - Telegram (Telegram's own page asks for the number and confirms it in the
//   app) and Google sign in straight away: an account that has that Telegram,
//   Google account, number or email, else a new one.
// - Email: a code; an account with that email signs in, a new address goes
//   on to name and password.
// - Phone, email or username with a password.
// An account without a phone number sees everything locked until the number
// is proven (SMS or Telegram); proving a number that already has an account
// moves the person into that account.

/** What this server offers: sign-up, Google, Telegram, email, password reset. */
export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    staleTime: 10 * 60_000,
    queryFn: () => call(api.GET('/v1/app/config')),
  });
}

/** Signed up on the web without a phone number yet: everything is locked until it's proven. */
export const needsPhone = (me: Profile | undefined) => !!me && me.kind === 'student' && me.status === 'registered' && !me.phone;

// --- Email ---

export function sendEmailCode(email: string) {
  return call(api.POST('/v1/auth/email/start', { body: { email } }));
}

export type EmailCheck = { status: 'signed_in'; login: LoginResponse } | { status: 'new'; email_ticket: string };

/** The code checked: the account with this email signs in, or a ticket to create one. */
export async function checkEmailCode(email: string, code: string): Promise<EmailCheck> {
  const r = await call(api.POST('/v1/auth/email/verify', { body: { email, code, device_id: deviceId() } }));
  if (r.status === 'signed_in') return { status: 'signed_in', login: { token: r.token, expires_at: r.expires_at, user: r.user } };
  return { status: 'new', email_ticket: r.email_ticket };
}

export function signUp(body: { email_ticket: string; first_name: string; last_name: string; password: string }) {
  return call(api.POST('/v1/auth/signup', { body: { ...body, device_id: deviceId() } }));
}

// --- Google ---

/** Leaves the app for Google; Google comes back to /auth/google. */
export function startGoogle(returnTo = '/') {
  window.location.assign(`/v1/auth/google/start?return=${encodeURIComponent(returnTo)}`);
}

export function googleTicket(ticket: string) {
  return call(api.POST('/v1/auth/google/ticket', { body: { ticket, device_id: deviceId() } }));
}

// --- Telegram ---

/**
 * Leaves the app for Telegram's page (it asks for the number and confirms in
 * the Telegram app); Telegram comes back to /auth/telegram. "verify" proves
 * the signed-in person's number.
 */
export async function startTelegram(purpose: 'signin' | 'verify', returnTo = '/') {
  const r = await call(api.POST('/v1/auth/telegram/start', { body: { purpose, return: returnTo } }));
  window.location.assign(r.url);
}

export function telegramTicket(ticket: string) {
  return call(api.POST('/v1/auth/telegram/ticket', { body: { ticket, device_id: deviceId() } }));
}

export function verifyPhoneByTelegram(ticket: string) {
  return call(api.POST('/v1/me/phone/telegram', { body: { ticket } }));
}

// --- Phone ---

/** A code to a new number for the signed-in person. */
export function sendVerifyCode(phone: string) {
  return call(api.POST('/v1/me/phone/start', { body: { phone } }));
}

/** The number proven: this account, or the account that already had it. */
export function verifyPhone(phone: string, code: string) {
  return call(api.POST('/v1/me/phone/verify', { body: { phone, code } }));
}

/** A forgotten password: a code to the account's number. */
export function sendResetCode(phone: string) {
  return call(api.POST('/v1/auth/phone/start', { body: { phone, purpose: 'reset' } }));
}

export async function checkResetCode(phone: string, code: string) {
  return (await call(api.POST('/v1/auth/phone/verify', { body: { phone, code, purpose: 'reset' } }))).ticket;
}

export function resetPassword(ticket: string, password: string) {
  return call(api.POST('/v1/auth/reset', { body: { ticket, password } }));
}

export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { first_name: string | null; last_name: string | null }) => call(api.PUT('/v1/me/profile', { body })),
    onSuccess: (profile: Profile) => queryClient.setQueryData(meKey, profile),
  });
}

/** Your own photo: a square JPEG (the editor makes 512×512), or none. */
export function useSetPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photo: Blob) =>
      call(
        api.PUT('/v1/me/photo', {
          // The picture's bytes as they are, not JSON.
          body: photo as unknown as string,
          bodySerializer: (b: unknown) => b as Blob,
          headers: { 'Content-Type': photo.type || 'image/jpeg' },
        }),
      ),
    onSuccess: (profile: Profile) => queryClient.setQueryData(meKey, profile),
  });
}

export function useRemovePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => call(api.DELETE('/v1/me/photo')),
    onSuccess: (profile: Profile) => queryClient.setQueryData(meKey, profile),
  });
}

/** "+998 90 123 45 67" from what a person typed (9 digits, or with 998). */
export function formatUzPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').replace(/^998/, '').slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
}
