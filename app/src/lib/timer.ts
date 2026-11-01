import { useEffect, useState } from 'react';

// The phone's src/lib/timer.ts for the browser: a countdown derived from
// `duration - (now - start)` on every tick, never a naive decrement.
// `enabled` false freezes the tick (the caller moves `start` to make up for
// the pause). The tab coming back into view ticks at once.
export function useRemainingTime(startTimestamp: number | null, enabled: boolean, durationMs: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    const kick = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, startTimestamp]);

  const remainingMs = startTimestamp == null ? durationMs : Math.min(durationMs, Math.max(0, durationMs - (now - startTimestamp)));
  return { remainingMs, isExpired: remainingMs <= 0 };
}

export function formatRemainingTime(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
