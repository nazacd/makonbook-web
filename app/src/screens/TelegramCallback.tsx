import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { telegramSignIn } from '@/api/accounts';
import { describeError } from '@/api/errors';
import { useAuth } from '@/auth/session';
import { AuthCard } from '@/components/brand/AuthCard';
import { Spinner } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { useTitle } from '@/lib/title';

// Where Telegram's sign-in page sends people back: #tgAuthResult=<base64 JSON
// signed by Telegram>. The API checks the signature; a linked Telegram
// account signs in, a new one goes on to sign-up.
function readResult(): Record<string, unknown> | null {
  const raw = new URLSearchParams(window.location.hash.slice(1)).get('tgAuthResult');
  if (!raw) return null;
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function TelegramCallback() {
  useTitle('Signing in');
  const { adopt } = useAuth();
  const navigate = useNavigate();
  const [auth] = useState(readResult);
  const [failed, setFailed] = useState<string | null>(null);
  const problem = auth ? failed : 'Telegram sign-in was cancelled or didn’t finish. Try again, or use another way.';
  const done = useRef(false);

  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname);
    if (done.current || !auth) return;
    done.current = true;
    telegramSignIn(auth).then(
      (r) => {
        if (r.status === 'signed_in') adopt({ token: r.token, expires_at: r.expires_at, user: r.user });
        else void navigate('/sign-up', { replace: true, state: { telegram: { telegram_ticket: r.telegram_ticket, first_name: r.first_name, last_name: r.last_name } } });
      },
      (err: unknown) => setFailed(describeError(err)),
    );
  }, [adopt, navigate, auth]);

  return (
    <AuthCard title={problem ? 'Couldn’t sign in with Telegram' : 'Signing you in…'}>
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
