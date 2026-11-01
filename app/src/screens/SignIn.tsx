import { useRef, useState, type FormEvent } from 'react';

import { ApiError } from '@/api/client';
import { describeError } from '@/api/errors';
import { useAuth } from '@/auth/session';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { useTitle } from '@/lib/title';

export function SignIn() {
  useTitle('Sign in');
  const { signIn } = useAuth();
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
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-3">
        <img src="/logo.png" alt="" width={40} height={40} />
        <h1 className="t-title text-ink">Sign in</h1>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <p className="t-body text-ink-2">Use the phone number the office has for you, or your username if you set one.</p>
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
        <Button type="submit" label="Sign in" loading={busy} disabled={!canSubmit && !busy} className="mt-1" />
        <p className="t-footnote text-center text-ink-3">Forgot your password, or your number changed? Ask the office to reset it.</p>
      </form>
    </div>
  );
}
