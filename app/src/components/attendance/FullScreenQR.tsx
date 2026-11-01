import { useEffect, useState } from 'react';

import { RotatingQR } from './RotatingQR';

type Props = { onClose: () => void; sessionId: string; secret: string; clockOffsetMs: number };

// The attendance code filling the screen on white, for the classroom
// projector (docs/handoff.md section 3). Goes into the browser's full-screen
// mode when it may; Escape or a click anywhere closes it.
export function FullScreenQR({ onClose, sessionId, secret, clockOffsetMs }: Props) {
  const [box, setBox] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setBox({ w: window.innerWidth, h: window.innerHeight });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);
  const size = Math.min(box.w - 40, box.h - 120, 720);
  return (
    <button type="button" onClick={onClose} aria-label="Close the full-screen code" className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-white">
      <RotatingQR sessionId={sessionId} secret={secret} clockOffsetMs={clockOffsetMs} size={size} bare />
    </button>
  );
}
