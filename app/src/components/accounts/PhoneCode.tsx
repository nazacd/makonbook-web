import { useEffect, useRef, useState, type FormEvent } from 'react';

import { checkResetCode, formatUzPhone, sendResetCode, sendVerifyCode, useAppConfig, verifyPhone } from '@/api/accounts';
import { describeError } from '@/api/errors';
import type { LoginResponse } from '@/api/types';
import { TelegramButton } from '@/components/accounts/TelegramButton';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';

type Props =
  /** A forgotten password: answers the server's ticket for the new password. */
  | { purpose: 'reset'; onVerified: (phone: string, ticket: string) => void }
  /**
   * Proving the signed-in person's number (by SMS, or with Telegram):
   * answers the session, which is the account that already had the number
   * when there was one.
   */
  | { purpose: 'verify'; onSignedIn: (login: LoginResponse) => void; returnTo?: string };

// The phone number, then the 6-digit code sent to it by SMS.
export function PhoneCode(props: Props) {
  const { purpose } = props;
  const [digits, setDigits] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const phone = `+998${digits}`;
  const config = useAppConfig().data;
  const telegram = config?.telegram;
  // No SMS on this server: proving a number is Telegram only.
  const sms = config?.reset !== false;

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
      const r = await (purpose === 'reset' ? sendResetCode(phone) : sendVerifyCode(phone));
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
      if (props.purpose === 'reset') props.onVerified(sentTo, await checkResetCode(sentTo, value));
      else props.onSignedIn(await verifyPhone(sentTo, value));
    } catch (err) {
      setProblem(describeError(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (!sentTo && !sms && props.purpose === 'verify') {
    return telegram ? <TelegramButton purpose="verify" label="Verify with Telegram" returnTo={props.returnTo} /> : <p className="t-subhead text-ink-2">Proving a phone number isn’t available right now. Please try again later.</p>;
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
          autoFocus={purpose === 'reset'}
          error={problem}
          hint="We’ll send a 6-digit code by SMS."
        />
        <Button type="submit" label="Send code" loading={busy} disabled={digits.length !== 9 && !busy} className="w-full" />
        {props.purpose === 'verify' && telegram && (
          <>
            <div className="flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
            <TelegramButton purpose="verify" label="Verify with Telegram" returnTo={props.returnTo} />
          </>
        )}
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
