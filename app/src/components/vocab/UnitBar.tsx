import type { ListProgress } from '@/lib/vocab/progress';

/** A list's progress as one bar: learned (dark) over started (grey) on the track. */
export function UnitBar({ progress, height = 6 }: { progress: ListProgress; height?: number }) {
  const pct = (n: number) => `${progress.total ? (100 * n) / progress.total : 0}%`;
  return (
    <div
      role="img"
      aria-label={`${progress.learned} of ${progress.total} learned, ${progress.started} started. A word counts as learned once its next review is three weeks or more away.`}
      className="relative w-full overflow-hidden rounded-full bg-track"
      style={{ height }}>
      <div className="absolute inset-y-0 left-0 bg-line-strong" style={{ width: pct(progress.started) }} />
      <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: pct(progress.learned) }} />
    </div>
  );
}
