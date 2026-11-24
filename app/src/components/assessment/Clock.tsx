import { Pause, Play, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useFastNow } from '@/lib/clock';

// The clock in the middle of a set's header (screens/roadmap/AssessmentRun).
// A timed set counts down to its deadline and hands itself in at zero; an
// untimed one counts the time spent and can be paused. Either can be hidden,
// except in a countdown's last minute.

function digits(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}

export function Clock({ deadline, onEnd, spent, paused, onPause }: { deadline: number | null; onEnd: () => void; /** Seconds already spent on the set. */ spent: number; paused: boolean; onPause: (on: boolean) => void }) {
  const [hidden, setHidden] = useState(false);
  const hide = (
    <button type="button" onClick={() => setHidden((h) => !h)} aria-pressed={hidden} className="t-caption flex h-6 items-center rounded-full border border-line px-2.5 font-semibold text-ink-2 hover:border-line-strong hover:text-ink">
      {hidden ? 'Show' : 'Hide'}
    </button>
  );
  if (deadline != null) return <Countdown deadline={deadline} onEnd={onEnd} hidden={hidden} hide={hide} />;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Stopwatch spent={spent} running={!paused} hidden={hidden} />
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onPause(!paused)} aria-label={paused ? 'Resume' : 'Pause'} title={paused ? 'Resume' : 'Pause'} className={`flex size-6 items-center justify-center rounded-full border ${paused ? 'border-primary bg-accent-tint text-accent' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink'}`}>
          {paused ? <Play size={11} fill="currentColor" aria-hidden="true" /> : <Pause size={11} fill="currentColor" aria-hidden="true" />}
        </button>
        {hide}
      </div>
    </div>
  );
}

const face = 'tabular font-title text-[21px] font-bold leading-7';
const veiled = (
  <span className="flex h-7 items-center text-ink-2" aria-label="Time hidden">
    <Timer size={19} strokeWidth={1.75} aria-hidden="true" />
  </span>
);

function Countdown({ deadline, onEnd, hidden, hide }: { deadline: number; onEnd: () => void; hidden: boolean; hide: React.ReactNode }) {
  const now = useFastNow();
  const left = Math.max(0, deadline - now);
  const ended = useRef(false);
  const latest = useRef(onEnd);
  useEffect(() => {
    latest.current = onEnd;
  });
  useEffect(() => {
    if (left === 0 && !ended.current) {
      ended.current = true;
      latest.current();
    }
  }, [left]);
  const s = Math.ceil(left / 1000);
  const low = s <= 60;
  return (
    <div className="flex flex-col items-center gap-0.5">
      {hidden && !low ? (
        veiled
      ) : (
        <span role="timer" aria-label={`${Math.floor(s / 60)} minutes ${s % 60} seconds left`} className={`${face} ${low ? 'text-bad' : 'text-ink'}`}>
          {digits(s)}
        </span>
      )}
      {hide}
    </div>
  );
}

/** Time spent, counted while it runs and the tab is in front. */
function Stopwatch({ spent, running, hidden }: { spent: number; running: boolean; hidden: boolean }) {
  const [ms, setMs] = useState(spent * 1000);
  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    const front = () => {
      last = Date.now();
    };
    const id = setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === 'visible') setMs((m) => m + (now - last));
      last = now;
    }, 500);
    document.addEventListener('visibilitychange', front);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', front);
    };
  }, [running]);
  if (hidden) return veiled;
  const s = Math.floor(ms / 1000);
  return (
    <span role="timer" aria-label={`${Math.floor(s / 60)} minutes ${s % 60} seconds spent${running ? '' : ', paused'}`} className={`${face} ${running ? 'text-ink' : 'text-ink-3'}`}>
      {digits(s)}
    </span>
  );
}
