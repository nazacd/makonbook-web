import { CircleAlert, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';

import { signUp, startGoogle, useAppConfig, type Identity, type NumberOwner } from '@/api/accounts';
import { describeError } from '@/api/errors';
import { useAuth } from '@/auth/session';
import { EmailCode } from '@/components/accounts/EmailCode';
import { PhoneCode } from '@/components/accounts/PhoneCode';
import { AuthCard } from '@/components/brand/AuthCard';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { useTitle } from '@/lib/title';

import { GoogleG } from './SignIn';

// Creating a student account: first who you are (Google, or an email checked
// with a code), then name and a password (optional with Google), then the
// phone, checked by SMS. By whose number it turns out to be:
// - nobody's: the account is created;
// - a free account's: "this phone number already exists";
// - a SATMAKON student's or teacher's: "Is this you?"; yes signs into that
//   account and links the email or Google account to it.
// An email or Google account can be used to look up one taken number only.
export type GoogleSignup = { google_ticket: string; first_name: string; last_name: string; email: string };

type Step = { kind: 'identity' } | { kind: 'details' } | { kind: 'phone' } | { kind: 'exists' } | { kind: 'confirm'; ticket: string; owner: Extract<NumberOwner, { status: 'enrolled' }> } | { kind: 'not-me' };

export function SignUp() {
  useTitle('Create account');
  const { adopt } = useAuth();
  const google = (useLocation().state as { google?: GoogleSignup } | null)?.google ?? null;
  const config = useAppConfig();
  const [identity, setIdentity] = useState<Identity | null>(google ? { google_ticket: google.google_ticket } : null);
  const [email, setEmail] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(google ? { kind: 'details' } : { kind: 'identity' });
  const [first, setFirst] = useState(google?.first_name ?? '');
  const [last, setLast] = useState(google?.last_name ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const verified = (_phone: string, ticket: string, owner: NumberOwner) => {
    if (owner?.status === 'registered') setStep({ kind: 'exists' });
    else if (owner?.status === 'enrolled') setStep({ kind: 'confirm', ticket, owner });
    else void submit(ticket, true);
  };

  async function submit(ticket: string, names: boolean) {
    if (busy || !identity) return;
    setBusy(true);
    setProblem(null);
    try {
      adopt(
        await signUp({
          ticket,
          first_name: names ? first.trim() : null,
          last_name: names ? last.trim() : null,
          password: password || null,
          google_ticket: identity.google_ticket ?? null,
          email_ticket: identity.email_ticket ?? null,
        }),
      );
    } catch (err) {
      setProblem(describeError(err));
      setBusy(false);
    }
  }

  const passwordOk = google ? password === '' || password.length >= 8 : password.length >= 8;
  const passwordField = () => (
    <TextField
      label={google ? 'Password (optional)' : 'Password'}
      secure
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      autoComplete="new-password"
      hint={google ? 'Set one to sign in with your phone number or email too, here and in the phone app.' : 'At least 8 characters. You’ll sign in with your email or phone number and this.'}
    />
  );

  const titles: Record<Step['kind'], [string, string]> = {
    identity: ['Create your account', 'Free practice tests, vocabulary and the Training Hall. SATMAKON students get everything.'],
    details: ['About you', google ? `Signing up with Google (${google.email}).` : `Signing up with ${email ?? 'your email'}.`],
    phone: ['Your phone number', 'Last step: SATMAKON uses it to find your classes once you enrol.'],
    exists: ['This number is taken', 'It already has a SATMAKON account.'],
    confirm: ['Is this you?', 'This number belongs to a SATMAKON account.'],
    'not-me': ['This number is in use', 'It belongs to someone else’s SATMAKON account.'],
  };
  const [title, subtitle] = titles[step.kind];

  return (
    <AuthCard
      title={title}
      subtitle={subtitle}
      aside={
        <p className="t-subhead text-ink-2">
          Already have an account?{' '}
          <Link to="/sign-in" className="font-bold text-accent hover:underline">
            Sign in
          </Link>
        </p>
      }>
      {step.kind === 'identity' && (
        <>
          {config.data?.google && (
            <>
              <button type="button" onClick={() => startGoogle('/')} className="flex h-12 w-full items-center justify-center gap-3 rounded-card border border-line-strong bg-surface text-[15px] font-bold text-ink hover:bg-surface-2">
                <GoogleG />
                Continue with Google
              </button>
              <div className="my-4 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}
          <EmailCode
            onVerified={(address, ticket) => {
              setEmail(address);
              setIdentity({ email_ticket: ticket });
              setStep({ kind: 'details' });
            }}
          />
        </>
      )}

      {step.kind === 'details' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep({ kind: 'phone' });
          }}
          className="flex flex-col gap-4"
          noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="First name" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" autoFocus />
            <TextField label="Surname" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />
          </div>
          {passwordField()}
          <Button type="submit" label="Continue" disabled={first.trim() === '' || last.trim() === '' || !passwordOk} className="w-full" />
        </form>
      )}

      {step.kind === 'phone' && identity && (
        <>
          <PhoneCode purpose="signup" identity={identity} onVerified={verified} />
          {busy && <p className="t-footnote mt-3 text-center text-ink-2">Creating your account…</p>}
          {problem && (
            <div className="mt-3">
              <Notice tone="error" message={problem} />
            </div>
          )}
        </>
      )}

      {step.kind === 'exists' && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 rounded-card bg-surface-2 p-4">
            <CircleAlert size={20} className="mt-0.5 shrink-0 text-watch" aria-hidden="true" />
            <p className="t-subhead text-ink">This phone number already exists. Sign in to that account, or reset its password if you’ve forgotten it.</p>
          </div>
          <Link to="/sign-in" className="lift flex h-[46px] items-center justify-center rounded-card bg-primary text-[15px] font-bold text-on-primary hover:bg-primary-hover">
            Sign in
          </Link>
          <Link to="/reset-password" className="t-subhead text-center font-bold text-accent hover:underline">
            Forgot your password?
          </Link>
        </div>
      )}

      {step.kind === 'confirm' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-card border border-line bg-surface-2 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-tint text-primary">
              <UserCheck size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="t-headline text-ink">{step.owner.name}</p>
              <p className="t-footnote text-ink-2">SATMAKON {step.owner.kind === 'teacher' ? 'teacher' : 'student'}</p>
            </div>
          </div>
          <p className="t-subhead text-ink-2">This number belongs to the SATMAKON {step.owner.kind === 'teacher' ? 'teacher' : 'student'} account above. Is this you?</p>
          {problem && <Notice tone="error" message={problem} />}
          <Button label="Yes, that’s me" loading={busy} onClick={() => void submit(step.ticket, false)} className="w-full" />
          <Button label="No, it’s not me" variant="secondary" onClick={() => setStep({ kind: 'not-me' })} className="w-full" />
        </div>
      )}

      {step.kind === 'not-me' && (
        <div className="flex flex-col gap-4">
          <p className="t-subhead text-ink-2">A number can belong to one account only. If it really is yours, ask the SATMAKON office to update the number on that account. To use another number, start again.</p>
          <Button
            label="Start again"
            onClick={() => {
              setProblem(null);
              setIdentity(null);
              setEmail(null);
              setStep({ kind: 'identity' });
            }}
            className="w-full"
          />
        </div>
      )}
    </AuthCard>
  );
}
