import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { googleTicket } from '@/api/accounts';
import { describeError } from '@/api/errors';
import { useAuth } from '@/auth/session';
import { AuthCard } from '@/components/brand/AuthCard';
import { Spinner } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { useTitle } from '@/lib/title';

// Where Google sends people back (via the API): #ticket=… or #error=….
// A linked Google account signs in; a new one goes on to sign-up for its
// phone number.
const ERRORS: Record<string, string> = {
  google_denied: 'Google sign-in was cancelled.',
  google_failed: 'Google sign-in didn’t work this time. Try again, or use your phone number.',
};

export function GoogleCallback() {
  useTitle('Signing in');
  const { adopt } = useAuth();
  const navigate = useNavigate();
  // Read once, before the first render: what Google's round trip brought back.
  const [hash] = useState(() => new URLSearchParams(window.location.hash.slice(1)));
  const ticket = hash.get('ticket');
  const error = hash.get('error');
  const [failed, setFailed] = useState<string | null>(null);
  const problem = error || !ticket ? (ERRORS[error ?? ''] ?? ERRORS.google_failed!) : failed;
  const done = useRef(false);

  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname);
    if (done.current || !ticket || error) return; // a ticket works once
    done.current = true;
    googleTicket(ticket).then(
      (r) => {
        if (r.status === 'signed_in') adopt({ token: r.token, expires_at: r.expires_at, user: r.user });
        else void navigate('/sign-up', { replace: true, state: { google: { google_ticket: r.google_ticket, first_name: r.first_name, last_name: r.last_name, email: r.email } } });
      },
      (err: unknown) => setFailed(describeError(err)),
    );
  }, [adopt, navigate, ticket, error]);

  return (
    <AuthCard title={problem ? 'Couldn’t sign in with Google' : 'Signing you in…'}>
      {problem ? (
        <div className="flex flex-col gap-4">
          <Notice tone="error" message={problem} />
          <Link to="/sign-in" className="t-subhead text-center font-bold text-accent hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <div className="flex justify-center py-6">
          <Spinner className="size-7 text-accent" />
        </div>
      )}
    </AuthCard>
  );
}
