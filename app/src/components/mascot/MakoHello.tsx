import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { Panda, type PandaHandle } from '@/components/mascot/Panda';
import { LINES, say, type MakoMood } from '@/lib/mako';
import { burstFrom, useSeason } from '@/lib/season';

// The dashboard's header: Mako beside "Welcome back", his line of the day
// in a speech bubble (lib/mako.ts decides it from the page's data) and one
// next step at a time. He watches the pointer; pressing him gets a giggle
// and a line, and shows the next step; five pokes in a row make him cross
// for a moment; a double press is a celebration that bursts into the
// season's particles. His accessory follows the season.

const POKE_WINDOW = 2600;

export function MakoHello({ name, summary, mood, right }: { name: string; summary?: ReactNode; mood: MakoMood; /** Something small at the far end of the header (the Customise button). */ right?: ReactNode }) {
  const { season } = useSeason();
  const panda = useRef<PandaHandle>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [line, setLine] = useState<string | null>(null);
  const [stepAt, setStepAt] = useState(0);
  const lineTimer = useRef(0);
  const hits = useRef<number[]>([]);
  const cross = useRef(0);
  const calming = useRef(0);

  // His mood, a moment after the page is up; a celebration throws particles.
  useEffect(() => {
    const t = window.setTimeout(() => {
      panda.current?.set(mood.emotion, 3200);
      if (mood.emotion === 'celebrate') burstFrom(button.current, 30);
    }, 350);
    return () => clearTimeout(t);
  }, [mood.emotion, mood.headline]);

  useEffect(
    () => () => {
      clearTimeout(lineTimer.current);
      clearTimeout(calming.current);
    },
    [],
  );

  const speak = (text: string, ms: number) => {
    setLine(text);
    panda.current?.talk(Math.min(1600, 40 * text.length));
    clearTimeout(lineTimer.current);
    lineTimer.current = window.setTimeout(() => setLine(null), ms);
  };

  const poke = () => {
    const p = panda.current;
    if (!p) return;
    const now = Date.now();
    if (mood.steps.length > 1) setStepAt((k) => (k + 1) % mood.steps.length);
    if (now < cross.current) return; // still cross (and then making up): more pokes don't reset that
    const h = hits.current;
    h.push(now);
    while (h.length && now - h[0]! > POKE_WINDOW) h.shift();
    clearTimeout(calming.current);
    if (h.length >= 5) {
      cross.current = now + 4700;
      p.set('angry', 2600);
      speak(say(LINES.angry), 2600);
      calming.current = window.setTimeout(() => {
        p.set('skeptical', 2000);
        speak(say(LINES.makeUp), 2000);
      }, 2700);
      h.length = 0;
      return;
    }
    if (h.length === 1 && Math.random() < 0.3) {
      p.set('love', 1800);
      speak(say(LINES.love), 2200);
      return;
    }
    p.set(h.length >= 3 ? 'surprised' : 'happy', 1700);
    speak(say(LINES.poke), 2600);
    if (h.length === 2) burstFrom(button.current, 10);
  };

  const step = mood.steps[stepAt % Math.max(1, mood.steps.length)];
  const stepClass = 'mk-say-step pop inline-flex max-w-full min-h-8 items-center gap-1.5 rounded-chip bg-primary px-3 py-1 text-left text-[12.5px] font-bold leading-[18px] text-on-primary';
  return (
    <header className="mk-hello mb-5 flex items-start gap-3 pt-1 md:gap-4">
      <button
        ref={button}
        type="button"
        onClick={poke}
        onDoubleClick={() => {
          panda.current?.set('celebrate', 2100);
          burstFrom(button.current, 26);
        }}
        onPointerEnter={() => {
          const p = panda.current;
          if (!p) return;
          p.perk();
          if (p.emotion === 'idle') p.set('happy', 1100);
        }}
        className="mk-panda shrink-0 rounded-[30%]"
        aria-label="Mako the panda. Press to say hi.">
        <Panda ref={panda} season={season} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.02em] text-ink md:text-[28px]">Welcome back, {name}</h1>
        {summary && <p className="t-subhead mt-0.5 text-ink-2">{summary}</p>}
        <div className="mk-say" aria-live="polite">
          <span className="mk-say-name">Mako</span>
          {line ? (
            <strong className="t-headline text-ink">{line}</strong>
          ) : (
            <>
              <strong className="t-headline text-ink">{mood.headline}</strong>
              <span className="t-footnote text-ink-2">{mood.message}</span>
            </>
          )}
          {step &&
            (step.to ? (
              <Link key={step.title} to={step.to} className={stepClass}>
                {step.title} <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            ) : (
              <button key={step.title} type="button" onClick={step.onClick} className={stepClass}>
                {step.title} <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
              </button>
            ))}
        </div>
      </div>
      {right}
    </header>
  );
}
