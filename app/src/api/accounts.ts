import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, call } from './client';
import type { paths } from './schema';
import { meKey } from './queries';
import type { LoginResponse, Profile } from './types';

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

/** Whose number it is, told after the code is verified (sign-up only): nobody's, a free account's, or a SATMAKON student's or teacher's. */
export type NumberOwner = null | { status: 'registered' } | { status: 'enrolled'; kind: 'student' | 'teacher'; name: string };

/** Who is signing up: a verified email or a Google account (one of the two). */
export type Identity = { email_ticket: string; google_ticket?: null; telegram_ticket?: null } | { google_ticket: string; email_ticket?: null; telegram_ticket?: null } | { telegram_ticket: string; email_ticket?: null; google_ticket?: null };

const ids = (identity?: Identity) => ({ email_ticket: identity?.email_ticket ?? null, google_ticket: identity?.google_ticket ?? null, telegram_ticket: identity?.telegram_ticket ?? null });

export function sendEmailCode(email: string) {
  return call(api.POST('/v1/auth/email/start', { body: { email } }));
}

export async function checkEmailCode(email: string, code: string) {
  return (await call(api.POST('/v1/auth/email/verify', { body: { email, code } }))).email_ticket;
}

export async function checkCode(phone: string, code: string, purpose: Purpose, identity?: Identity): Promise<{ ticket: string; account: NumberOwner }> {
  const r = await call(api.POST('/v1/auth/phone/verify', { body: { phone, code, purpose, ...ids(identity) } }));
  return { ticket: r.ticket, account: (r.account ?? null) as NumberOwner };
}

export function signUp(body: { ticket: string; first_name: string | null; last_name: string | null; password: string | null; google_ticket: string | null; email_ticket: string | null; telegram_ticket: string | null }) {
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

/**
 * Leaves the app for Telegram's sign-in page; Telegram comes back to
 * /auth/telegram with the signed data in the address (#tgAuthResult=…).
 */
export function startTelegram(botId: number) {
  const origin = window.location.origin;
  window.location.assign(`https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(origin)}&request_access=write&return_to=${encodeURIComponent(`${origin}/auth/telegram`)}`);
}

export type TelegramAuth = paths['/v1/auth/telegram']['post']['requestBody']['content']['application/json']['auth'];

export function telegramSignIn(auth: TelegramAuth) {
  return call(api.POST('/v1/auth/telegram', { body: { auth } }));
}

/** Checking the phone through the bot: a link to open in Telegram, then polling until the number is shared. */
export function startTelegramPhone(purpose: Purpose, identity?: Identity) {
  return call(api.POST('/v1/auth/phone/telegram/start', { body: { purpose, ...ids(identity) } }));
}

export type TelegramCheck =
  | { status: 'pending' }
  | { status: 'verified'; phone: string; ticket: string; account: NumberOwner }
  /** The number was shared from the same Telegram account the person signed in with: they're signed into the account that has it. */
  | { status: 'signed_in'; login: LoginResponse };

export async function checkTelegramPhone(nonce: string): Promise<TelegramCheck> {
  const r = (await call(api.POST('/v1/auth/phone/telegram/check', { body: { nonce } }))) as { status: string; phone?: string; ticket?: string; account?: unknown; token?: string; expires_at?: string; user?: Profile };
  if (r.status === 'signed_in' && r.token && r.user) return { status: 'signed_in', login: { token: r.token, expires_at: r.expires_at ?? '', user: r.user } };
  if (r.status !== 'verified') return { status: 'pending' };
  return { status: 'verified', phone: r.phone ?? '', ticket: r.ticket ?? '', account: (r.account ?? null) as NumberOwner };
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
