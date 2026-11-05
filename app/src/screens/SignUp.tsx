import { CircleAlert, UserCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';

import { signUp, type NumberOwner } from '@/api/accounts';
import { describeError } from '@/api/errors';
import { useAuth } from '@/auth/session';
import { PhoneCode } from '@/components/accounts/PhoneCode';
import { AuthCard } from '@/components/brand/AuthCard';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { useTitle } from '@/lib/title';

// Creating a student account. First the phone, verified by SMS; then, by
// whose number it turns out to be:
// - nobody's: name and a password, and a new (free) account;
// - a free account's: "this phone number already exists" (sign in or reset);
// - a SATMAKON student's or teacher's: "Is this you?"; yes signs into that
//   account after choosing a password (optional when coming from Google).
// Coming from Google, the name is filled in and the Google account is linked.
export type GoogleSignup = { google_ticket: string; first_name: string; last_name: string; email: string };

type Step = { kind: 'phone' } | { kind: 'details'; ticket: string } | { kind: 'exists' } | { kind: 'confirm'; ticket: string; owner: Extract<NumberOwner, { status: 'enrolled' }> } | { kind: 'claim'; ticket: string } | { kind: 'not-me' };

export function SignUp() {
  useTitle('Create account');
  const { adopt } = useAuth();
  const google = (useLocation().state as { google?: GoogleSignup } | null)?.google ?? null;
  const [step, setStep] = useState<Step>({ kind: 'phone' });
  const [first, setFirst] = useState(google?.first_name ?? '');
  const [last, setLast] = useState(google?.last_name ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const verified = (_phone: string, ticket: string, owner: NumberOwner) => {
    if (owner?.status === 'registered') setStep({ kind: 'exists' });
    else if (owner?.status === 'enrolled') setStep({ kind: 'confirm', ticket, owner });
    else setStep({ kind: 'details', ticket });
  };

  async function submit(e: FormEvent, ticket: string, names: boolean) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      adopt(
        await signUp({
          ticket,
          first_name: names ? first.trim() : null,
          last_name: names ? last.trim() : null,
          password: password || null,
          google_ticket: google?.google_ticket ?? null,
        }),
      );
    } catch (err) {
      setProblem(describeError(err));
      setBusy(false);
    }
  }

  const passwordOk = google ? password === '' || password.length >= 8 : password.length >= 8;
  const passwordField = (claim: boolean) => (
    <TextField
      label={google ? 'Password (optional)' : 'Password'}
      secure
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      autoComplete="new-password"
      autoFocus={claim}
      hint={
        google
          ? 'Set one to sign in with your phone number too, here and in the phone app.'
          : claim
            ? 'At least 8 characters. It replaces your old password.'
            : 'At least 8 characters. You’ll sign in with your phone number and this.'
      }
    />
  );

  const titles: Record<Step['kind'], [string, string]> = {
    phone: [google ? 'One more step' : 'Create your account', google ? `Signing up with Google (${google.email}). Add your phone number to finish.` : 'Free practice tests, vocabulary and the Training Hall. SATMAKON students get everything.'],
    details: ['Create your account', 'Almost there: your name and a password.'],
    exists: ['This number is taken', 'It already has a SATMAKON account.'],
    confirm: ['Is this you?', 'This number belongs to a SATMAKON account.'],
    claim: ['Welcome back', google ? 'Your Google account will be linked to it.' : 'Choose a password to sign in with from now on.'],
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
      {step.kind === 'phone' && <PhoneCode purpose="signup" onVerified={verified} />}

      {step.kind === 'details' && (
        <form onSubmit={(e) => void submit(e, step.ticket, true)} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="First name" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" autoFocus />
            <TextField label="Surname" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />
          </div>
          {passwordField(false)}
          {problem && <Notice tone="error" message={problem} />}
          <Button type="submit" label="Create account" loading={busy} disabled={(first.trim() === '' || last.trim() === '' || !passwordOk) && !busy} className="w-full" />
        </form>
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
          <Button label="Yes, that’s me" onClick={() => setStep({ kind: 'claim', ticket: step.ticket })} className="w-full" />
          <Button label="No, it’s not me" variant="secondary" onClick={() => setStep({ kind: 'not-me' })} className="w-full" />
        </div>
      )}

      {step.kind === 'claim' && (
        <form onSubmit={(e) => void submit(e, step.ticket, false)} className="flex flex-col gap-4" noValidate>
          {passwordField(true)}
          {problem && <Notice tone="error" message={problem} />}
          <Button type="submit" label="Sign in" loading={busy} disabled={!passwordOk && !busy} className="w-full" />
        </form>
      )}

      {step.kind === 'not-me' && (
        <div className="flex flex-col gap-4">
          <p className="t-subhead text-ink-2">A number can belong to one account only. If it really is yours, ask the SATMAKON office to update the number on that account. Or sign up with another number.</p>
          <Button
            label="Use another number"
            onClick={() => {
              setProblem(null);
              setStep({ kind: 'phone' });
            }}
            className="w-full"
          />
        </div>
      )}
    </AuthCard>
  );
}
