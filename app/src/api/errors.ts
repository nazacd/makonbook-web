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
      return "Can't reach SATMAKON. Check your internet connection and try again.";
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
    case 'sms_unavailable':
      return 'We can’t send text messages right now. Please try again a little later.';
    case 'invalid_phone':
      return 'Enter an Uzbek mobile number, like 90 123 45 67.';
    case 'invalid_code':
      return 'That code isn’t right. Check the SMS and try again.';
    case 'code_expired':
      return 'That code has expired. Ask for a new one.';
    case 'too_many_tries':
      return 'Too many wrong codes. Ask for a new one.';
    case 'invalid_ticket':
      return 'That took too long. Start again from the phone number.';
    case 'weak_password':
      return 'Use 8 to 128 characters, and not your phone number.';
    case 'invalid_profile':
      return 'Enter your first name and surname (up to 60 characters each).';
    case 'invalid_email':
      return 'Enter a valid email address.';
    case 'email_unavailable':
      return 'We can’t send emails right now. Please try again a little later, or continue with Google.';
    case 'email_taken':
      return 'An account already uses this email. Sign in instead, or reset your password.';
    case 'identity_spent':
      return 'For your security, start again with another email or Google account.';
    case 'invalid_telegram':
      return 'Telegram sign-in didn’t work this time. Try again, or use another way.';
    case 'telegram_unavailable':
      return 'Telegram isn’t available right now. Use another way.';
    case 'telegram_taken':
      return 'That Telegram account is already linked to another SATMAKON account.';
    case 'phone_taken':
      return 'This phone number already exists. Sign in, or reset your password if you’ve forgotten it.';
    case 'google_taken':
      return 'That Google account is already linked to another SATMAKON account.';
    case 'google_unavailable':
      return 'Google sign-in isn’t available right now. Use your phone number.';
    case 'no_account':
      return 'No SATMAKON account has this number. Create one instead.';
    case 'enrolled_only':
      return 'This is for SATMAKON students. Enrol at SATMAKON and it opens for you.';
    default:
      if (error.status >= 500) return 'SATMAKON is having a problem right now. Please try again in a moment.';
      return error.requestId
        ? `Something went wrong. If it keeps happening, tell the office this code: ${error.requestId}`
        : 'Something went wrong. Please try again.';
  }
}
