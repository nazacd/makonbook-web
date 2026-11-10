import { useEffect, useRef, useState } from 'react';

import { canDrawWebGL, GlobeScene, type GlobeMode, type GlobePoint } from './scene';

// The onboarding's globe, as a React component (loaded lazily: three.js only
// comes with this screen). It fills its container; everything it shows comes
// from props. Without WebGL it draws a still dome instead.

export type GlobeProps = {
  points: GlobePoint[];
  selected: string | null;
  /** Universities the search matches, drawn brighter. */
  matches: string[];
  /** A point to turn to without choosing it (a country, a search result). */
  look: { lat: number; lng: number } | null;
  /** The finale: draw the arc from Tashkent to this university. */
  arcTo: string | null;
  mode: GlobeMode;
  onPick?: (id: string) => void;
};

export default function Globe({ points, selected, matches, look, arcTo, mode, onPick }: GlobeProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<GlobeScene | null>(null);
  const pick = useRef(onPick);
  const [ready, setReady] = useState(false);
  const [webgl] = useState(canDrawWebGL);

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!webgl || !canvas.current) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const s = new GlobeScene(canvas.current, { reducedMotion, onPick: (id) => pick.current?.(id), onReady: () => setReady(true) });
    scene.current = s;
    const ro = new ResizeObserver(() => s.resize());
    ro.observe(canvas.current);
    return () => {
      ro.disconnect();
      s.dispose();
      scene.current = null;
    };
  }, [webgl]);

  useEffect(() => {
    scene.current?.setUniversities(points);
  }, [points]);
  useEffect(() => {
    scene.current?.setMode(mode);
  }, [mode]);
  useEffect(() => {
    scene.current?.select(selected);
  }, [selected, points]);
  useEffect(() => {
    scene.current?.highlight(new Set(matches));
  }, [matches, points]);
  useEffect(() => {
    if (look) scene.current?.focus(look.lat, look.lng);
  }, [look]);
  useEffect(() => {
    scene.current?.flyTo(arcTo);
  }, [arcTo, points]);

  if (!webgl) return <div className="globe-fallback" aria-hidden="true" />;
  return <canvas ref={canvas} className={`globe-canvas ${ready ? 'is-ready' : ''}`} aria-hidden="true" />;
}
