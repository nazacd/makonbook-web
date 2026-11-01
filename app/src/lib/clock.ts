// Copied from makonbook-mobile/src/lib/clock.ts.

import { useSyncExternalStore } from 'react';

// The current time as a value render can read without calling Date.now()
// itself (render must stay pure for the React Compiler). Each clock runs one
// shared interval for all its subscribers, only while someone is subscribed.
function createClock(intervalMs: number) {
  let now = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();

  function tick() {
    now = Date.now();
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    if (!timer) {
      tick();
      timer = setInterval(tick, intervalMs);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }

  return () => useSyncExternalStore(subscribe, () => now);
}

/** Now, refreshed every 30 s: enough for "next class" and lesson states. */
export const useNow = createClock(30_000);

/** Now, refreshed four times a second: for the rotating attendance QR. */
export const useFastNow = createClock(250);
