import { useEffect, useRef } from 'react';

import { Particles, recipe } from '@/components/season/particles';
import { SCENES } from '@/components/season/scenes';
import { useIsDark } from '@/lib/appearance';
import { onBurst, useReducedMotion, useSeason, useSeasonFx } from '@/lib/season';

// The season behind the page (docs/design.md, "Seasons"): a fixed layer at
// z-index -1, so it paints over the canvas colour but under every card and
// the sidebar, never over text. It holds two soft colour washes, the
// season's corner piece and scene (on the dashboard; `full`), and the
// particle canvas; a sparse blurred canvas in front adds depth on wide
// screens. It sets `data-season` on <html> for the rest of the page (the
// logo's ornament). Off when the tab is hidden, under reduced motion, and
// when the viewer turns "Seasonal effects" off in Profile (then only the
// washes stay). Mako's celebrations burst into it (lib/season `burst`).

export function SeasonLayer({ full }: { full: boolean }) {
  const { season, holiday } = useSeason();
  const dark = useIsDark();
  const [fx] = useSeasonFx();
  const reduce = useReducedMotion();
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Particles | null>(null);
  const particles = fx && !reduce;

  useEffect(() => {
    document.documentElement.dataset.season = season;
    return () => {
      delete document.documentElement.dataset.season;
    };
  }, [season]);

  // The engine lives as long as its canvases do.
  useEffect(() => {
    if (!particles || !back.current) return;
    const p = new Particles({ back: back.current, front: front.current, dense: full });
    engine.current = p;
    const off = onBurst((n, o) => p.burst(n, o));
    const sync = () => p.setRunning(!document.hidden);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      document.removeEventListener('visibilitychange', sync);
      off();
      p.destroy();
      engine.current = null;
    };
  }, [particles, full]);

  // The mix follows the season, the holiday and the theme (snow is blue-grey on light).
  const holidayKey = holiday?.key ?? null;
  useEffect(() => {
    engine.current?.setRecipe(recipe(season, holiday, dark));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the holiday object changes with its key
  }, [season, holidayKey, dark, particles, full]);

  const Scene = SCENES[season];
  return (
    <>
      <div className="mbs-layer" data-season-layer={season} data-dark={dark || undefined} aria-hidden="true">
        <div className="mbs-wash" />
        {fx && full && <Scene />}
        {particles && <canvas className="mbs-particles" ref={back} />}
      </div>
      {particles && full && <canvas className="mbs-front" ref={front} aria-hidden="true" />}
    </>
  );
}
