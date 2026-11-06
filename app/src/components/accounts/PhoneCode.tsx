import { useEffect, useRef, useState, type FormEvent } from 'react';

import { checkCode, checkTelegramPhone, formatUzPhone, sendCode, startTelegramPhone, useAppConfig, type Identity, type NumberOwner, type Purpose } from '@/api/accounts';
import { TelegramMark } from '@/components/accounts/TelegramButton';
import { describeError } from '@/api/errors';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';

// The phone number, then the 6-digit code sent to it by SMS. Answers the
// verified phone ("+998…"), the server's ticket and, for sign-up, whose
// number it is.
export function PhoneCode({ purpose, onVerified, initialPhone = '', identity }: { purpose: Purpose; onVerified: (phone: string, ticket: string, account: NumberOwner) => void; initialPhone?: string; identity?: Identity }) {
  const [digits, setDigits] = useState(initialPhone.replace(/\D/g, '').replace(/^998/, '').slice(0, 9));
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const phone = `+998${digits}`;
  const telegram = useAppConfig().data?.telegram;
  // Checking the number through the bot instead of an SMS: the link to open,
  // then a poll every 2 s until the number is shared there.
  const [tg, setTg] = useState<{ nonce: string; link: string } | null>(null);
  const onVerifiedRef = useRef(onVerified);
  useEffect(() => {
    onVerifiedRef.current = onVerified;
  });
  useEffect(() => {
    if (!tg) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await checkTelegramPhone(tg.nonce);
        if (stop) return;
        if (r.status === 'verified') {
          setTg(null);
          onVerifiedRef.current(r.phone, r.ticket, r.account);
          return;
        }
      } catch (err) {
        if (!stop) {
          setTg(null);
          setProblem(describeError(err));
        }
        return;
      }
      if (!stop) timer = setTimeout(() => void tick(), 2000);
    };
    let timer = setTimeout(() => void tick(), 2000);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [tg]);

  async function viaTelegram() {
    setBusy(true);
    setProblem(null);
    try {
      const r = await startTelegramPhone(purpose, identity);
      setTg({ nonce: r.nonce, link: r.link });
      window.open(r.link, '_blank', 'noopener');
    } catch (err) {
      setProblem(describeError(err));
    } finally {
      setBusy(false);
    }
  }



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
      const r = await checkCode(sentTo, value, purpose, identity);
      onVerified(sentTo, r.ticket, r.account);
    } catch (err) {
      setProblem(describeError(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (tg) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex gap-3 rounded-card bg-surface-2 p-4">
          <TelegramMark size={22} />
          <p className="t-subhead text-ink">
            In Telegram, press <b className="font-bold">Start</b>, then <b className="font-bold">Share my number</b>. This page carries on by itself.
          </p>
        </div>
        <a href={tg.link} target="_blank" rel="noopener noreferrer" className="lift flex h-[46px] items-center justify-center gap-2 rounded-card bg-[#2AABEE] text-[15px] font-bold text-white">
          Open Telegram
        </a>
        <p className="t-footnote flex items-center justify-center gap-2 text-ink-2">
          <span className="size-2 animate-pulse rounded-full bg-[#2AABEE]" aria-hidden="true" /> Waiting for your number…
        </p>
        <button type="button" onClick={() => setTg(null)} className="t-footnote font-bold text-accent hover:underline">
          Use an SMS code instead
        </button>
      </div>
    );
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
        {telegram && (
          <button type="button" onClick={() => void viaTelegram()} disabled={busy} className="flex h-12 w-full items-center justify-center gap-3 rounded-card border border-line-strong bg-surface text-[15px] font-bold text-ink hover:bg-surface-2">
            <TelegramMark />
            Check my number with Telegram
          </button>
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
