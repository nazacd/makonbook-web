import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';

import { signUp } from '@/api/accounts';
import { describeError } from '@/api/errors';
import { useAuth } from '@/auth/session';
import { PhoneCode } from '@/components/accounts/PhoneCode';
import { AuthCard } from '@/components/brand/AuthCard';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { useTitle } from '@/lib/title';

// Creating a student account: the phone (verified by SMS), then name and a
// password. Coming from Google, the name is filled in and the password is
// optional. A number that already belongs to a SATMAKON student or teacher
// signs into that account instead (the API decides).
export type GoogleSignup = { google_ticket: string; first_name: string; last_name: string; email: string };

export function SignUp() {
  useTitle('Create account');
  const { adopt } = useAuth();
  const google = (useLocation().state as { google?: GoogleSignup } | null)?.google ?? null;
  const [ticket, setTicket] = useState<string | null>(null);
  const [first, setFirst] = useState(google?.first_name ?? '');
  const [last, setLast] = useState(google?.last_name ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ticket || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      adopt(await signUp({ ticket, first_name: first.trim(), last_name: last.trim(), password: password || null, google_ticket: google?.google_ticket ?? null }));
    } catch (err) {
      setProblem(describeError(err));
      setBusy(false);
    }
  }

  const ready = first.trim() !== '' && last.trim() !== '' && (google ? password === '' || password.length >= 8 : password.length >= 8);
  return (
    <AuthCard
      title={google ? 'One more step' : 'Create your account'}
      subtitle={google ? `Signing up with Google (${google.email}). Add your phone number to finish.` : 'Free practice tests, vocabulary and the Training Hall. SATMAKON students get everything.'}
      aside={
        <p className="t-subhead text-ink-2">
          Already have an account?{' '}
          <Link to="/sign-in" className="font-bold text-accent hover:underline">
            Sign in
          </Link>
        </p>
      }>
      {!ticket ? (
        <PhoneCode purpose="signup" onVerified={(_, t) => setTicket(t)} />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="First name" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" autoFocus />
            <TextField label="Surname" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />
          </div>
          <TextField
            label={google ? 'Password (optional)' : 'Password'}
            secure
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            hint={google ? 'Set one to sign in with your phone number too, here and in the phone app.' : 'At least 8 characters. You’ll sign in with your phone number and this.'}
          />
          {problem && <Notice tone="error" message={problem} />}
          <Button type="submit" label="Create account" loading={busy} disabled={!ready && !busy} className="w-full" />
          <p className="t-caption text-center text-ink-3">If this number already belongs to a SATMAKON account, you’ll be signed into it.</p>
        </form>
      )}
    </AuthCard>
  );
}
