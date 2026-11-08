import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { resetPassword, useAppConfig } from '@/api/accounts';
import { describeError } from '@/api/errors';
import { useAuth } from '@/auth/session';
import { EmailCode } from '@/components/accounts/EmailCode';
import { PhoneCode } from '@/components/accounts/PhoneCode';
import { AuthCard } from '@/components/brand/AuthCard';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { useTitle } from '@/lib/title';

// A forgotten password:
// - by phone: a code to the account's number, then a new password, and
//   you're signed in (SATMAKON students and teachers too);
// - by email: the code signs you into the account with that email; a new
//   password is then set in Profile.
export function ResetPassword() {
  useTitle('Reset password');
  const { adopt, status } = useAuth();
  const navigate = useNavigate();
  const config = useAppConfig().data;
  const [chosen, setBy] = useState<'phone' | 'email' | null>(null);
  // By phone when SMS works here, else by email; the person can switch when both do.
  const by = chosen ?? (config?.reset === false ? 'email' : 'phone');
  const both = config?.reset !== false && config?.email !== false;
  const [ticket, setTicket] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);

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
      subtitle={by === 'phone' ? 'We’ll send a code to your account’s phone number.' : 'We’ll send a code to your account’s email.'}
      aside={
        <Link to={status === 'signedIn' ? '/profile' : '/sign-in'} className="t-subhead font-bold text-accent hover:underline">
          {status === 'signedIn' ? 'Back to your profile' : 'Back to sign in'}
        </Link>
      }>
      {ticket ? (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <TextField label="New password" secure value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus hint="At least 8 characters, and not your phone number." />
          {problem && <Notice tone="error" message={problem} />}
          <Button type="submit" label="Save and sign in" loading={busy} disabled={password.length < 8 && !busy} className="w-full" />
        </form>
      ) : by === 'phone' ? (
        <>
          <PhoneCode purpose="reset" onVerified={(_, t) => setTicket(t)} />
          {both && <button type="button" onClick={() => setBy('email')} className="t-footnote mt-4 w-full text-center font-bold text-accent hover:underline">
            Use my email instead
          </button>}
        </>
      ) : (
        <>
          <EmailCode
            onVerified={(_, r) => {
              if (r.status === 'new') {
                setNoAccount(true);
                return;
              }
              adopt(r.login);
              void navigate('/profile/password', { replace: true });
            }}
          />
          {noAccount && (
            <div className="mt-3">
              <Notice tone="error" message="No account has this email. Try your phone number, or create an account." />
            </div>
          )}
          {both && <button type="button" onClick={() => setBy('phone')} className="t-footnote mt-4 w-full text-center font-bold text-accent hover:underline">
            Use my phone number instead
          </button>}
        </>
      )}
    </AuthCard>
  );
}
