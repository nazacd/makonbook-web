import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { telegramTicket, verifyPhoneByTelegram } from '@/api/accounts';
import { describeError } from '@/api/errors';
import { useAuth } from '@/auth/session';
import { AuthCard } from '@/components/brand/AuthCard';
import { Spinner } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { useTitle } from '@/lib/title';

// Where Telegram sends people back (through the API's callback):
// ?ticket=…&purpose=signin|verify&return=… or ?error=….
// - signin: the account with that Telegram or that number, else a new one.
// - verify: the signed-in person's number is proven; if another account
//   already had it, they're moved into that account.
const ERRORS: Record<string, string> = {
  telegram_denied: 'Telegram sign-in was cancelled.',
  telegram_failed: 'Telegram sign-in didn’t work this time. Try again, or use another way.',
};

export function TelegramCallback() {
  const { adopt, status } = useAuth();
  // Read once, before the first render: what Telegram's round trip brought back.
  const [q] = useState(() => new URLSearchParams(window.location.search));
  const ticket = q.get('ticket');
  const error = q.get('error');
  const verify = q.get('purpose') === 'verify';
  const ret = q.get('return')?.startsWith('/') ? q.get('return')! : '/';
  useTitle(verify ? 'Checking your number' : 'Signing in');
  const [failed, setFailed] = useState<string | null>(null);
  const problem = error || !ticket ? (ERRORS[error ?? ''] ?? ERRORS.telegram_failed!) : failed;
  const done = useRef(false);

  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname);
    if (done.current || !ticket || error) return; // a ticket works once
    if (verify && status !== 'signedIn') return;
    done.current = true;
    (verify ? verifyPhoneByTelegram(ticket) : telegramTicket(ticket)).then(
      (login) => {
        adopt(login);
        // A fresh start: after proving a number the person may now be another
        // account (the one that already had it).
        window.location.replace(ret);
      },
      (err: unknown) => setFailed(describeError(err)),
    );
  }, [adopt, ticket, error, verify, status, ret]);

  const back = verify && status === 'signedIn' ? { to: ret, label: 'Back to SATMAKON' } : { to: '/sign-in', label: 'Back to sign in' };
  return (
    <AuthCard title={problem ? (verify ? 'Couldn’t check your number' : 'Couldn’t sign in with Telegram') : verify ? 'Checking your number…' : 'Signing you in…'}>
      {problem ? (
        <div className="flex flex-col gap-4">
          <Notice tone="error" message={problem} />
          <Link to={back.to} className="t-subhead text-center font-bold text-accent hover:underline">
            {back.label}
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
