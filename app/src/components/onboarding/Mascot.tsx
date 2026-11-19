import { Panda, type Emotion } from '@/components/mascot/Panda';
import { useSeason } from '@/lib/season';

// The mascot's spots in onboarding. The mascot is Mako the panda
// (components/mascot/Panda, docs/mascot-brief.md): each pose is one of his
// emotions, so the welcome waves and the finale celebrates.

export type Pose = 'wave' | 'think' | 'point' | 'cheer';

const EMOTION: Record<Pose, Emotion> = { wave: 'greet', think: 'thinking', point: 'happy', cheer: 'celebrate' };

export function Mascot({ pose, size = 120, className = '' }: { pose: Pose; size?: number; className?: string }) {
  const { season } = useSeason();
  return (
    <span className={`float-y inline-flex select-none ${className}`} style={{ width: size, height: size * (250 / 240) }}>
      <Panda season={season} initial={EMOTION[pose]} label="" />
    </span>
  );
}
