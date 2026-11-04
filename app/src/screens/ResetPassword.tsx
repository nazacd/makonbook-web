import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { resetPassword } from '@/api/accounts';
import { describeError } from '@/api/errors';
import { useAuth } from '@/auth/session';
import { PhoneCode } from '@/components/accounts/PhoneCode';
import { AuthCard } from '@/components/brand/AuthCard';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { useTitle } from '@/lib/title';

// A forgotten password: a code to the account's phone, then a new password,
// and you're signed in. Works for SATMAKON students and teachers too.
export function ResetPassword() {
  useTitle('Reset password');
  const { adopt, status } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ticket || busy || password.length < 8) return;
    setBusy(true);
    setProblem(null);
    try {
      adopt(await resetPassword(ticket, password));
      void navigate(status === 'signedIn' ? '/profile' : '/', { replace: true });
    } catch (err) {
      setProblem(describeError(err));
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="We’ll send a code to your account’s phone number."
      aside={
        <Link to={status === 'signedIn' ? '/profile' : '/sign-in'} className="t-subhead font-bold text-accent hover:underline">
          {status === 'signedIn' ? 'Back to your profile' : 'Back to sign in'}
        </Link>
      }>
      {!ticket ? (
        <PhoneCode purpose="reset" onVerified={(_, t) => setTicket(t)} />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <TextField label="New password" secure value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus hint="At least 8 characters, and not your phone number." />
          {problem && <Notice tone="error" message={problem} />}
          <Button type="submit" label="Save and sign in" loading={busy} disabled={password.length < 8 && !busy} className="w-full" />
        </form>
      )}
    </AuthCard>
  );
}
