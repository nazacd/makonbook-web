import { useEffect, useEffectEvent, useState } from 'react';

import { RotatingQR } from './RotatingQR';

type Props = { onClose: () => void; sessionId: string; secret: string; clockOffsetMs: number };

// The attendance code filling the screen on white, for the classroom
// projector (docs/handoff.md section 3). Goes into the browser's full-screen
// mode when it may; Escape or a click anywhere closes it.
export function FullScreenQR({ onClose, sessionId, secret, clockOffsetMs }: Props) {
  const [box, setBox] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  // Once, when it opens: the session screen re-renders on every poll (3 s),
  // and leaving full screen on each of them would drop out of it for good
  // (going back in needs a click).
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const onResize = () => setBox({ w: window.innerWidth, h: window.innerHeight });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    // The browser's own way out of full screen (Escape, F11) closes it too.
    let entered = false;
    const onFullscreen = () => {
      if (document.fullscreenElement) entered = true;
      else if (entered) close();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);
  const size = Math.min(box.w - 40, box.h - 120, 720);
  return (
    <button type="button" onClick={onClose} aria-label="Close the full-screen code" className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-white">
      <RotatingQR sessionId={sessionId} secret={secret} clockOffsetMs={clockOffsetMs} size={size} bare />
    </button>
  );
}
