import { useRef, useState, type FormEvent } from 'react';

import { Link } from 'react-router';

import { useAppConfig } from '@/api/accounts';
import { GoogleButton, Or } from '@/components/accounts/Providers';
import { TelegramButton } from '@/components/accounts/TelegramButton';
import { ApiError } from '@/api/client';
import { describeError } from '@/api/errors';
import { useAuth } from '@/auth/session';
import { AuthCard } from '@/components/brand/AuthCard';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { useTitle } from '@/lib/title';

export function SignIn() {
  useTitle('Sign in');
  const { signIn } = useAuth();
  const config = useAppConfig();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrongCredentials, setWrongCredentials] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const canSubmit = login.trim() !== '' && password !== '' && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setWrongCredentials(false);
    setProblem(null);
    try {
      await signIn(login, password);
      // RequireGuest moves to the app on its own.
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid_credentials') {
        setWrongCredentials(true);
        setPassword('');
        passwordRef.current?.focus();
      } else {
        setProblem(describeError(err));
      }
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Use your phone number, email or username."
      aside={
        config.data?.signup || config.data?.google || config.data?.telegram ? (
          <p className="t-subhead text-ink-2">
            New here?{' '}
            <Link to="/sign-up" className="font-bold text-accent hover:underline">
              Create an account
            </Link>
          </p>
        ) : (
          <p className="t-footnote text-ink-3">Forgot your password, or your number changed? Ask the office to reset it.</p>
        )
      }>
      {(config.data?.google || config.data?.telegram) && (
        <>
          <div className="flex flex-col gap-2.5">
            <TelegramButton />
            {config.data?.google && <GoogleButton />}
          </div>
          <Or />
        </>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Phone, email or username"
          value={login}
          onChange={(e) => {
            setLogin(e.target.value);
            setWrongCredentials(false);
          }}
          placeholder="90 123 45 67"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          inputMode="text"
          autoFocus
        />
        <TextField
          ref={passwordRef}
          label="Password"
          secure
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setWrongCredentials(false);
          }}
          autoCapitalize="none"
          autoComplete="current-password"
          error={wrongCredentials ? "That phone number or password isn't right." : null}
          hint="First time? Your password is the last 4 digits of your phone number."
        />
        {problem && <Notice tone="error" message={problem} />}
        <Button type="submit" label="Sign in" loading={busy} disabled={!canSubmit && !busy} className="mt-1 w-full" />
        {(config.data?.reset || config.data?.email) && (
          <Link to="/reset-password" className="t-footnote -mt-1 text-center font-semibold text-accent hover:underline">
            Forgot your password?
          </Link>
        )}
      </form>
    </AuthCard>
  );
}
