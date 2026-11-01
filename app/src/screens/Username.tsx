import { ChevronLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '@/api/client';
import { describeError } from '@/api/errors';
import { useMe, useSetUsername } from '@/api/queries';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { ScreenTitle } from '@/layouts/AppShell';
import { useTitle } from '@/lib/title';

// Same rules as the API (normalizeUsername in makonbook-api): starts with a
// letter so it can't be mistaken for a phone number, and doesn't end in a dot.
const PATTERN = /^[a-z][a-z0-9_.]{1,28}[a-z0-9_]$/;

function problemWith(value: string): string | null {
  if (value === '') return null;
  if (!/^[a-z]/.test(value)) return 'Start with a letter.';
  if (/[^a-z0-9_.]/.test(value)) return 'Use only letters, numbers, dots and underscores.';
  if (value.length < 3) return 'At least 3 characters.';
  if (value.length > 30) return 'At most 30 characters.';
  if (value.endsWith('.')) return "Can't end with a dot.";
  return null;
}

export function Username() {
  useTitle('Username');
  const navigate = useNavigate();
  const currentUsername = useMe().data?.username ?? '';
  const save = useSetUsername();
  const [value, setValue] = useState(currentUsername);
  const [serverError, setServerError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const normalized = value.trim().toLowerCase();
  const inlineError = problemWith(normalized);
  const canSave = PATTERN.test(normalized) && normalized !== currentUsername && !save.isPending;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setServerError(null);
    setProblem(null);
    save.mutate(normalized, {
      onSuccess: () => void navigate('/profile'),
      onError: (err) => {
        if (err instanceof ApiError && err.code === 'username_taken') setServerError('Someone already has this username. Try another.');
        else if (err instanceof ApiError && err.code === 'invalid_username') setServerError(err.message);
        else setProblem(describeError(err));
      },
    });
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <BackLink />
      <ScreenTitle title="Username" />
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <TextField
          label="Username"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setServerError(null);
          }}
          prefix="@"
          placeholder="sat.student"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          maxLength={30}
          error={serverError ?? inlineError}
          hint="3–30 characters: letters, numbers, dots and underscores."
          autoFocus
        />
        {problem && <Notice tone="error" message={problem} />}
        <Button type="submit" label="Save" loading={save.isPending} disabled={!canSave && !save.isPending} />
      </form>
    </div>
  );
}

export function BackLink() {
  return (
    <Link to="/profile" className="t-subhead -ml-1 mb-4 inline-flex h-10 items-center gap-1 rounded-chip pr-2 text-accent">
      <Icon as={ChevronLeft} size={18} className="text-accent" />
      Profile
    </Link>
  );
}
