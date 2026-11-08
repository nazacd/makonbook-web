import { Lock, Smartphone, X } from 'lucide-react';
import { createContext, use, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';

import { useAuth } from '@/auth/session';
import { PhoneCode } from '@/components/accounts/PhoneCode';
import { useDialog } from '@/lib/dialog';

// Accounts made with Google or email have no phone number, and everything
// but the dashboard and Profile stays locked until they prove one, by SMS or
// with Telegram. If the number already has an account (an earlier one, or a
// SATMAKON student's or teacher's), proving it moves them into that account.

/** Opens the panel from anywhere in the frame (the dashboard, Profile). */
export const ProvePanelContext = createContext<() => void>(() => {});
export const useProvePhone = () => use(ProvePanelContext);

/**
 * The panel's state. It offers itself once per visit, after a little
 * interaction (shortly after the first click or tap, or after 10 s), and
 * again whenever something locked is opened.
 */
export function useProvePanel(active: boolean) {
  const [shown, setShown] = useState(false);
  const offered = useRef(false);
  useEffect(() => {
    if (!active) return;
    let soon: ReturnType<typeof setTimeout> | undefined;
    const offer = () => {
      if (offered.current) return;
      offered.current = true;
      setShown(true);
    };
    const later = setTimeout(offer, 10_000);
    const onFirstTap = () => {
      soon = setTimeout(offer, 700);
    };
    document.addEventListener('pointerdown', onFirstTap, { once: true });
    return () => {
      clearTimeout(later);
      clearTimeout(soon);
      document.removeEventListener('pointerdown', onFirstTap);
    };
  }, [active]);
  const open = useCallback(() => {
    offered.current = true;
    setShown(true);
  }, []);
  const close = useCallback(() => setShown(false), []);
  return { shown: shown && active, open, close };
}

export function ProvePhonePanel({ onClose }: { onClose: () => void }) {
  const dialog = useDialog<HTMLDivElement>(onClose);
  const { adopt } = useAuth();
  const { pathname } = useLocation();
  return (
    <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[6px]" onClick={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prove-title"
        className="sheet-up relative max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-panel bg-surface px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2.5 outline-none sm:px-7"
        onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line-strong" />
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-chip text-ink-2 hover:bg-surface-2">
          <X size={18} />
        </button>
        <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-accent-tint text-primary">
          <Smartphone size={22} aria-hidden="true" />
        </span>
        <h2 id="prove-title" className="text-[22px] font-bold leading-7 text-ink">
          Prove your phone number
        </h2>
        <p className="t-subhead mb-5 mt-1.5 text-ink-2">To open mock tests, the Training Hall and vocabulary, prove your number. If it already has a SATMAKON account, we’ll take you to it.</p>
        <PhoneCode
          purpose="verify"
          returnTo={pathname}
          onSignedIn={(login) => {
            adopt(login);
            // A fresh start: the person may now be the account that already had the number.
            window.location.replace(pathname);
          }}
        />
        <button type="button" onClick={onClose} className="t-subhead mt-4 w-full text-center font-semibold text-ink-2 hover:text-ink">
          Not now
        </button>
      </div>
    </div>
  );
}

/** What a locked page shows instead of itself. */
export function PhoneLocked({ onProve }: { onProve: () => void }) {
  return (
    <div className="rise mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-accent-tint text-primary">
        <Lock size={26} aria-hidden="true" />
      </span>
      <h1 className="text-[24px] font-bold text-ink">Prove your phone number first</h1>
      <p className="t-subhead mt-2 text-ink-2">This page opens once your account has a proven phone number. It takes a minute, by SMS or with Telegram.</p>
      <button type="button" onClick={onProve} className="lift mt-6 h-11 rounded-full bg-primary px-6 text-[15px] font-bold text-on-primary hover:bg-primary-hover">
        Prove my number
      </button>
    </div>
  );
}
