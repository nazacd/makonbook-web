import { useSyncExternalStore } from 'react';

// Small sounds (the achievement chime), on unless the viewer turns them off
// in Profile. Synthesised here with WebAudio: nothing is downloaded and the
// strict CSP stays. Browsers allow sound only after a gesture on the page;
// a toast after a click or a submit qualifies, and a silent failure is fine.

const KEY = 'mb.sounds';
const EVENT = 'mb:sounds';

export function soundsOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}
export function setSoundsOn(on: boolean) {
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, 'off');
  } catch {
    // Not kept: lasts as long as the page.
  }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(cb: () => void) {
  const storage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', storage);
  };
}
export function useSounds(): [boolean, (on: boolean) => void] {
  return [useSyncExternalStore(subscribe, soundsOn, () => true), setSoundsOn];
}

let ctx: AudioContext | null = null;

/** A short rising chime, two notes, like a level-up bell. */
export function chime(kind: 'achievement' | 'challenge' | 'quest' = 'achievement') {
  if (!soundsOn()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const notes = kind === 'challenge' ? [659, 880, 1319] : kind === 'quest' ? [784, 1047] : [880, 1319];
    const t0 = ctx.currentTime + 0.02;
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const at = t0 + i * 0.11;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.18, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
      o.connect(g).connect(ctx!.destination);
      o.start(at);
      o.stop(at + 0.35);
    });
  } catch {
    // No audio here: the toast is enough.
  }
}
