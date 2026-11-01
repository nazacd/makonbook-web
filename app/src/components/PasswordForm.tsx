import { Circle, CircleCheck, LogOut } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';

import { ApiError } from '@/api/client';
import { describeError } from '@/api/errors';
import { useChangePassword } from '@/api/queries';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';

const MIN_LENGTH = 8;

type PasswordFormProps = {
  /** Replacing the temporary password right after the first sign-in. */
  forced: boolean;
  onDone?: () => void;
};

// Used by two screens: /choose-password (forced, the only screen until it is
// done; RequireAuth then opens the app) and /profile/password.
export function PasswordForm({ forced, onDone }: PasswordFormProps) {
  const change = useChangePassword();
  const newRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [nextError, setNextError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // Validated as people type, not after they press the button.
  const longEnough = next.length >= MIN_LENGTH;
  const matches = confirm !== '' && confirm === next;
  // The server rejects the person's own phone number; the page doesn't know
  // it, so anything shaped like a phone number is flagged as it's typed.
  const looksLikePhone = /^\+?\d{9,12}$/.test(next.replace(/[\s()-]/g, ''));
  const canSubmit = current !== '' && longEnough && matches && !looksLikePhone && !change.isPending;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setCurrentError(null);
    setNextError(null);
    setProblem(null);
    change.mutate(
      { current_password: current, new_password: next },
      {
        onSuccess: () => onDone?.(),
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'wrong_password') {
            setCurrentError("That isn't your current password.");
            setCurrent('');
          } else if (err instanceof ApiError && err.code === 'weak_password') {
            setNextError(err.message);
            newRef.current?.focus();
          } else {
            setProblem(describeError(err));
          }
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {forced && <p className="t-body text-ink-2">You signed in with the temporary password. Choose your own to continue. Only you will know it.</p>}
      <TextField
        label={forced ? 'Temporary password' : 'Current password'}
        hint={forced ? 'The last 4 digits of your phone number.' : undefined}
        error={currentError}
        secure
        value={current}
        onChange={(e) => {
          setCurrent(e.target.value);
          setCurrentError(null);
        }}
        autoComplete="current-password"
        autoFocus
      />
      <div className="flex flex-col gap-3">
        <TextField
          ref={newRef}
          label="New password"
          error={nextError ?? (looksLikePhone ? 'Your phone number can’t be your password.' : null)}
          secure
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            setNextError(null);
          }}
          autoComplete="new-password"
        />
        <TextField label="Repeat new password" secure value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        <ul className="flex flex-col gap-1.5 pt-1" aria-live="polite">
          <Requirement met={longEnough} label={`At least ${MIN_LENGTH} characters`} />
          <Requirement met={matches} label="Both passwords match" />
        </ul>
      </div>
      {problem && <Notice tone="error" message={problem} />}
      <Button type="submit" label={forced ? 'Save and continue' : 'Change password'} loading={change.isPending} disabled={!canSubmit && !change.isPending} />
      {!forced && (
        <p className="t-footnote flex items-center justify-center gap-2 text-ink-3">
          <Icon as={LogOut} size={15} className="text-ink-3" />
          Your other devices will be signed out.
        </p>
      )}
    </form>
  );
}

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2" aria-label={`${label}: ${met ? 'done' : 'not yet'}`}>
      <Icon as={met ? CircleCheck : Circle} size={16} className={met ? 'text-good' : 'text-ink-3'} strokeWidth={met ? 2 : 1.75} />
      <span className={`t-subhead ${met ? 'text-ink' : 'text-ink-2'}`}>{label}</span>
    </li>
  );
}
