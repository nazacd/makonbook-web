import { useState } from 'react';
import { Link } from 'react-router';

import { signUp, useAppConfig } from '@/api/accounts';
import { describeError } from '@/api/errors';
import { useAuth } from '@/auth/session';
import { EmailCode } from '@/components/accounts/EmailCode';
import { GoogleButton, Or } from '@/components/accounts/Providers';
import { TelegramButton } from '@/components/accounts/TelegramButton';
import { AuthCard } from '@/components/brand/AuthCard';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { useTitle } from '@/lib/title';

// Creating a student account:
// - Telegram or Google: straight in (an account that already has that
//   Telegram, Google account, number or email signs in instead).
// - Email: a code; if an account has that email, it signs in, otherwise name,
//   surname and a password make a new one.
// Accounts made with Google or email have no phone number: everything stays
// locked until they prove one (the panel in the app).
export function SignUp() {
  useTitle('Create account');
  const { adopt } = useAuth();
  const config = useAppConfig();
  const [email, setEmail] = useState<{ address: string; ticket: string } | null>(null);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit() {
    if (!email || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      adopt(await signUp({ email_ticket: email.ticket, first_name: first.trim(), last_name: last.trim(), password }));
    } catch (err) {
      setProblem(describeError(err));
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title={email ? 'About you' : 'Create your account'}
      subtitle={email ? `Signing up with ${email.address}.` : 'Free practice tests, vocabulary and the Training Hall. SATMAKON students get everything.'}
      aside={
        <p className="t-subhead text-ink-2">
          Already have an account?{' '}
          <Link to="/sign-in" className="font-bold text-accent hover:underline">
            Sign in
          </Link>
        </p>
      }>
      {!email ? (
        <>
          {(config.data?.google || config.data?.telegram) && (
            <>
              <div className="flex flex-col gap-2.5">
                <TelegramButton />
                {config.data?.google && <GoogleButton />}
              </div>
              <Or />
            </>
          )}
          {config.data?.email !== false && (
            <EmailCode
              onVerified={(address, r) => {
                if (r.status === 'signed_in') adopt(r.login);
                else setEmail({ address, ticket: r.email_ticket });
              }}
            />
          )}
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-4"
          noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="First name" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" autoFocus />
            <TextField label="Surname" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />
          </div>
          <TextField label="Password" secure value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" hint="At least 8 characters. You’ll sign in with your email and this." />
          {problem && <Notice tone="error" message={problem} />}
          <Button type="submit" label="Create account" loading={busy} disabled={(first.trim() === '' || last.trim() === '' || password.length < 8) && !busy} className="w-full" />
          <button type="button" onClick={() => setEmail(null)} className="t-footnote font-bold text-accent hover:underline">
            Use another email
          </button>
        </form>
      )}
    </AuthCard>
  );
}
