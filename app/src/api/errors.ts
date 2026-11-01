import { ApiError } from './client';

// The wording for errors any screen can hit, the same as the mobile app's
// src/lib/api/errors.ts. Screens handle the codes that belong to one of their
// fields (wrong_password next to the password field, and so on) themselves
// and fall back to this. Branch on `code`, never on `message`.

function minutes(seconds: number | undefined): string {
  const m = Math.max(1, Math.ceil((seconds ?? 60) / 60));
  if (m < 60) return m === 1 ? '1 minute' : `${m} minutes`;
  const h = Math.ceil(m / 60);
  return h === 1 ? '1 hour' : `${h} hours`;
}

export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (error.code) {
    case 'network':
      return "Can't reach MakonBook. Check your internet connection and try again.";
    case 'account_locked':
      return `Too many wrong passwords. For your security, try again in ${minutes(error.retryAfter)}.`;
    case 'rate_limited':
      return `Too many attempts. Try again in ${minutes(error.retryAfter)}.`;
    case 'password_change_required':
      return 'Choose your own password first.';
    case 'forbidden':
      return 'This isn’t available for your account.';
    case 'not_found':
      return 'That isn’t here any more.';
    default:
      if (error.status >= 500) return 'MakonBook is having a problem right now. Please try again in a moment.';
      return error.requestId
        ? `Something went wrong. If it keeps happening, tell the office this code: ${error.requestId}`
        : 'Something went wrong. Please try again.';
  }
}
