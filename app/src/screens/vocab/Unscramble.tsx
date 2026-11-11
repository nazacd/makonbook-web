import { Delete, Lightbulb, SkipForward } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { GameFrame, GameGate, GameResult, SpeakButton, type GameWords } from '@/components/vocab/Game';
import { useRecordGame } from '@/api/vocabSocial';
import { uuid } from '@/lib/device-id';
import { usePerson } from '@/lib/practice/hooks';
import { speak } from '@/lib/speak';
import { useTitle } from '@/lib/title';
import { GAMES, pickRound, saveResult, scramble, spellable } from '@/lib/vocab/games';
import type { VocabWord } from '@/lib/vocab/types';

const WORDS = 8;
const HINTS = 3;

type Item = { word: VocabWord; tiles: string[] };

// Unscramble: the meaning is shown, the word's letters are mixed. Click the
// letters or type them; a hint places the next letter (three a round), Skip
// shows the word. A word counts when it was built without a hint.
export function Unscramble() {
  useTitle(GAMES.unscramble.title);
  const [round, setRound] = useState(0);
  return (
    <GameGate title={GAMES.unscramble.title} fits={spellable}>
      {(words) => <Round key={round} from={words} onAgain={() => setRound((n) => n + 1)} />}
    </GameGate>
  );
}

function Round({ from, onAgain }: { from: GameWords; onAgain: () => void }) {
  const person = usePerson();
  const record = useRecordGame();
  const [startedAt] = useState(() => Date.now());
  const [items] = useState<Item[]>(() => pickRound(from, WORDS, spellable).map((word) => ({ word, tiles: scramble(word.word) })));
  const [at, setAt] = useState(0);
  // The tiles placed, by their position among the mixed letters.
  const [placed, setPlaced] = useState<number[]>([]);
  const [phase, setPhase] = useState<'play' | 'right' | 'wrong' | 'shown'>('play');
  const [hintsLeft, setHintsLeft] = useState(HINTS);
  const [helped, setHelped] = useState(false);
  const [clean, setClean] = useState(0);
  const [missed, setMissed] = useState<VocabWord[]>([]);
  const [result, setResult] = useState<{ newBest: boolean } | null>(null);

  const item = items[at]!;
  const answer = item.word.word.toLowerCase();

  const next = (cleanNow: number, missedNow: VocabWord[], at: number) => {
    if (at + 1 < items.length) {
      setAt(at + 1);
      setPlaced([]);
      setPhase('play');
      setHelped(false);
    } else {
      record({ id: uuid(), game: 'unscramble', score: cleanNow, total: items.length, mistakes: HINTS - hintsLeft, duration_ms: at - startedAt, missed: [...new Set(missedNow.map((w) => w.id))], played_at: new Date(at).toISOString() });
      setResult({ newBest: saveResult(person, 'unscramble', cleanNow) });
    }
  };

  const check = (tiles: number[], withHelp: boolean) => {
    if (tiles.length < answer.length) return;
    if (tiles.map((i) => item.tiles[i]).join('') === answer) {
      setPhase('right');
      speak(item.word.word);
      const cleanNow = clean + (withHelp ? 0 : 1);
      const missedNow = withHelp ? [...missed, item.word] : missed;
      setClean(cleanNow);
      setMissed(missedNow);
      window.setTimeout(() => next(cleanNow, missedNow, Date.now()), 1100);
    } else {
      setPhase('wrong');
      window.setTimeout(() => {
        setPlaced([]);
        setPhase('play');
      }, 450);
    }
  };

  const place = (i: number) => {
    if (phase !== 'play' || placed.includes(i)) return;
    const tiles = [...placed, i];
    setPlaced(tiles);
    check(tiles, helped);
  };
  const typeLetter = (letter: string) => {
    const i = item.tiles.findIndex((t, k) => t === letter && !placed.includes(k));
    if (i >= 0) place(i);
  };
  const back = () => phase === 'play' && setPlaced((p) => p.slice(0, -1));

  // A hint keeps the letters that are right so far and places the next one.
  const hint = () => {
    if (phase !== 'play' || hintsLeft === 0) return;
    let good = 0;
    while (good < placed.length && item.tiles[placed[good]!] === answer[good]) good++;
    const tiles = placed.slice(0, good);
    const i = item.tiles.findIndex((t, k) => t === answer[good] && !tiles.includes(k));
    if (i < 0) return;
    tiles.push(i);
    setHintsLeft(hintsLeft - 1);
    setHelped(true);
    setPlaced(tiles);
    check(tiles, true);
  };

  const skip = () => {
    if (phase !== 'play') return;
    setPhase('shown');
    const missedNow = [...missed, item.word];
    setMissed(missedNow);
    window.setTimeout(() => next(clean, missedNow, Date.now()), 1700);
  };

  const latest = useRef({ typeLetter, back, hint });
  useLayoutEffect(() => {
    latest.current = { typeLetter, back, hint };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        latest.current.back();
      } else if (/^[a-z]$/i.test(e.key)) {
        latest.current.typeLetter(e.key.toLowerCase());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (result) {
    return (
      <GameFrame title={GAMES.unscramble.title}>
        <GameResult
          headline={clean === items.length ? 'Every one, unaided' : clean >= items.length / 2 ? 'Nicely spelled' : 'Round done'}
          detail="A word counts when you build it without a hint."
          stats={[
            { value: `${clean}/${items.length}`, label: 'on your own' },
            { value: String(HINTS - hintsLeft), label: 'hints used' },
          ]}
          newBest={result.newBest}
          missed={[...new Map(missed.map((w) => [w.id, w])).values()].map((w) => ({ word: w }))}
          onAgain={onAgain}
        />
      </GameFrame>
    );
  }

  const letters = phase === 'shown' ? answer.split('') : placed.map((i) => item.tiles[i]!);
  const slotTone = phase === 'right' ? 'border-good bg-good-tint text-good' : phase === 'wrong' ? 'border-bad bg-bad-tint text-bad' : phase === 'shown' ? 'border-watch bg-watch-tint text-watch' : 'border-primary bg-accent-tint text-ink';

  return (
    <GameFrame title={GAMES.unscramble.title} step={at} total={items.length}>
      <div key={item.word.id} className="rise flex flex-1 flex-col items-center">
        <section className="w-full rounded-card border border-line bg-surface p-5 text-center sm:p-7">
          {item.word.part_of_speech && <p className="t-footnote italic text-ink-3">{item.word.part_of_speech}</p>}
          <p className="mt-1 text-[19px] font-medium leading-7 text-ink sm:text-[21px]">{item.word.definition}</p>
        </section>

        <div className={`mt-8 flex flex-wrap justify-center gap-1.5 ${phase === 'wrong' ? 'shake' : phase === 'right' ? 'pulse-good' : ''}`} aria-label={`${letters.length} of ${answer.length} letters placed`} role="group">
          {answer.split('').map((_, k) => (
            <span key={k} className={`flex h-12 w-9 items-center justify-center rounded-chip border-b-[3px] text-[22px] font-extrabold uppercase sm:h-14 sm:w-11 sm:text-[26px] ${letters[k] ? slotTone : 'border-line-strong bg-surface-2 text-transparent'}`}>
              {letters[k] ?? '·'}
            </span>
          ))}
        </div>
        <p className="t-subhead mt-3 flex h-10 items-center gap-2 text-ink-2" aria-live="polite">
          {phase === 'right' ? (
            <>
              <span className="font-bold text-good">{item.word.word}</span> <SpeakButton word={item.word.word} className="size-8" />
            </>
          ) : phase === 'shown' ? (
            <>
              It was <span className="font-bold text-ink">{item.word.word}</span>
            </>
          ) : phase === 'wrong' ? (
            'Not quite. Try another order.'
          ) : (
            'Click the letters, or type.'
          )}
        </p>

        <div className="mt-5 flex max-w-[460px] flex-wrap justify-center gap-2" role="group" aria-label="Letters">
          {item.tiles.map((t, i) => {
            const used = placed.includes(i) || phase === 'shown';
            return (
              <button
                key={i}
                type="button"
                disabled={used || phase !== 'play'}
                onClick={() => place(i)}
                aria-label={`Letter ${t.toUpperCase()}`}
                className={`flex size-12 items-center justify-center rounded-control text-[22px] font-extrabold uppercase transition-all sm:size-14 sm:text-[24px] ${used ? 'scale-90 bg-surface-2 text-transparent' : 'bg-primary text-on-primary shadow-[0_3px_0_var(--color-primary-deep)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none'}`}>
                {t}
              </button>
            );
          })}
        </div>

        <div className="mt-auto flex w-full max-w-[460px] items-center justify-center gap-2 pt-10 sm:mt-0">
          <button type="button" onClick={back} disabled={phase !== 'play' || placed.length === 0} className="t-subhead inline-flex h-11 items-center gap-2 rounded-control border border-line-strong bg-surface px-4 font-semibold text-ink hover:bg-surface-2 disabled:opacity-40">
            <Delete size={17} aria-hidden="true" /> Undo
          </button>
          <button type="button" onClick={hint} disabled={phase !== 'play' || hintsLeft === 0} className="t-subhead inline-flex h-11 items-center gap-2 rounded-control border border-line-strong bg-surface px-4 font-semibold text-ink hover:bg-surface-2 disabled:opacity-40">
            <Lightbulb size={17} aria-hidden="true" className="text-watch" /> Hint <span className="tabular text-ink-3">{hintsLeft}</span>
          </button>
          <button type="button" onClick={skip} disabled={phase !== 'play'} className="t-subhead inline-flex h-11 items-center gap-2 rounded-control px-4 font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-40">
            <SkipForward size={17} aria-hidden="true" /> Skip
          </button>
        </div>
      </div>
    </GameFrame>
  );
}
