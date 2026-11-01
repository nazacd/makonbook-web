import { useEffect, useEffectEvent, useRef } from 'react';

// What every dialog of the test screen does for the keyboard: focus moves
// into it when it opens and back to where it was when it closes, and Escape
// closes it (only the one on top, when one opens over another).
const open: symbol[] = [];

export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const me = Symbol('dialog');
    open.push(me);
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || open[open.length - 1] !== me) return;
      e.preventDefault();
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      open.splice(open.indexOf(me), 1);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, []);
  return ref;
}
