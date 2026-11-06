import { useEffect, useRef, useState, type FormEvent } from 'react';

import { checkEmailCode, sendEmailCode } from '@/api/accounts';
import { describeError } from '@/api/errors';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';

// An email address, then the 6-digit code sent to it. Answers the address and
// the server's ticket proving it.
export function EmailCode({ onVerified }: { onVerified: (email: string, ticket: string) => void }) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await sendEmailCode(email.trim());
      setSentTo(email.trim().toLowerCase());
      setCode('');
      setWait(r.resend_in);
      setTimeout(() => codeRef.current?.focus(), 0);
    } catch (err) {
      setProblem(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e?: FormEvent, value = code) {
    e?.preventDefault();
    if (!sentTo || value.length !== 6 || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      onVerified(sentTo, await checkEmailCode(sentTo, value));
    } catch (err) {
      setProblem(describeError(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (!sentTo) {
    return (
      <form onSubmit={send} className="flex flex-col gap-4" noValidate>
        <TextField label="Email" value={email} onChange={(e) => { setEmail(e.target.value); setProblem(null); }} placeholder="you@example.com" inputMode="email" autoComplete="email" error={problem} hint="We’ll send a 6-digit code to check it’s yours." />
        <Button type="submit" label="Send code" loading={busy} disabled={!valid && !busy} className="w-full" />
      </form>
    );
  }
  return (
    <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
      <p className="t-subhead text-ink-2">
        Enter the code we sent to <b className="font-bold text-ink">{sentTo}</b>.{' '}
        <button type="button" onClick={() => setSentTo(null)} className="font-bold text-accent hover:underline">
          Change
        </button>
      </p>
      <TextField
        ref={codeRef}
        label="Code"
        value={code}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
          setCode(v);
          setProblem(null);
          if (v.length === 6) void verify(undefined, v);
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="••••••"
        error={problem}
        hint="Can’t find it? Check the spam folder."
      />
      <Button type="submit" label="Continue" loading={busy} disabled={code.length !== 6 && !busy} className="w-full" />
      <p className="t-footnote text-center text-ink-2">
        {wait > 0 ? `You can ask again in ${wait} s.` : <button type="button" onClick={() => void send()} className="font-bold text-accent hover:underline">Send the code again</button>}
      </p>
    </form>
  );
}
