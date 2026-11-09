import { Sparkles } from 'lucide-react';

// The mascot's spots (docs/mascot-brief.md). SATMAKON's illustrator draws the
// character; until a pose's art is in public/mascot/<pose>.webp and listed in
// DRAWN, a quiet placeholder holds its place, so the art drops in with no
// other change.

export type Pose = 'wave' | 'think' | 'point' | 'cheer';

/** The poses whose art is in public/mascot/. */
const DRAWN = new Set<Pose>([]);

export function Mascot({ pose, size = 120, className = '' }: { pose: Pose; size?: number; className?: string }) {
  if (DRAWN.has(pose)) return <img src={`/mascot/${pose}.webp`} alt="" width={size} height={size} draggable={false} className={`float-y select-none ${className}`} />;
  return (
    <span
      className={`float-y relative inline-flex items-center justify-center rounded-full ${className}`}
      style={{ width: size * 0.6, height: size * 0.6, background: 'radial-gradient(circle at 35% 30%, rgba(255,215,106,0.35), rgba(143,107,255,0.18) 60%, transparent 72%)' }}
      aria-hidden="true">
      <Sparkles size={size * 0.24} className="text-[var(--onb-gold)]" />
    </span>
  );
}
