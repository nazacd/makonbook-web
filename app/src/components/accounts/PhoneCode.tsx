import { useEffect, useRef, useState, type FormEvent } from 'react';

import { checkCode, formatUzPhone, sendCode, type Purpose } from '@/api/accounts';
import { describeError } from '@/api/errors';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';

// The phone number, then the 6-digit code sent to it by SMS. Answers the
// verified phone (E.164-ish, "+998…") and the server's ticket.
export function PhoneCode({ purpose, onVerified, initialPhone = '' }: { purpose: Purpose; onVerified: (phone: string, ticket: string) => void; initialPhone?: string }) {
  const [digits, setDigits] = useState(initialPhone.replace(/\D/g, '').replace(/^998/, '').slice(0, 9));
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const phone = `+998${digits}`;

  // The resend countdown, once a second.
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (digits.length !== 9 || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await sendCode(phone, purpose);
      setSentTo(phone);
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
      onVerified(sentTo, await checkCode(sentTo, value, purpose));
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
        <TextField
          label="Phone number"
          prefix="+998"
          value={formatUzPhone(digits)}
          onChange={(e) => {
            setDigits(e.target.value.replace(/\D/g, '').replace(/^998/, '').slice(0, 9));
            setProblem(null);
          }}
          placeholder="90 123 45 67"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus
          error={problem}
          hint="We’ll send a 6-digit code by SMS."
        />
        <Button type="submit" label="Send code" loading={busy} disabled={digits.length !== 9 && !busy} className="w-full" />
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
      <p className="t-subhead text-ink-2">
        Enter the code we sent to <b className="font-bold text-ink">+998 {formatUzPhone(digits)}</b>.{' '}
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
      />
      <Button type="submit" label="Continue" loading={busy} disabled={code.length !== 6 && !busy} className="w-full" />
      <p className="t-footnote text-center text-ink-2">
        {wait > 0 ? (
          `No SMS? You can ask again in ${wait} s.`
        ) : (
          <button type="button" onClick={() => void send()} className="font-bold text-accent hover:underline">
            Send the code again
          </button>
        )}
      </p>
    </form>
  );
}
