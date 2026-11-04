import { useRef, useState, type FormEvent } from 'react';

import { Link } from 'react-router';

import { startGoogle, useAppConfig } from '@/api/accounts';
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
      subtitle="Use your phone number or your username."
      aside={
        config.data?.signup ? (
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
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Phone number or username"
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
        {config.data?.signup && (
          <Link to="/reset-password" className="t-footnote -mt-1 text-center font-semibold text-accent hover:underline">
            Forgot your password?
          </Link>
        )}
      </form>
    </AuthCard>
  );
}

// Google's "G" in its four colours (the sign-in button's own mark).
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}
