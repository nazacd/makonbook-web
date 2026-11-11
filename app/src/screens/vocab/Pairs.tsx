import { Timer } from 'lucide-react';
import { useState } from 'react';

import { GameFrame, GameGate, GameResult, type GameWords } from '@/components/vocab/Game';
import { useFastNow } from '@/lib/clock';
import { usePerson } from '@/lib/practice/hooks';
import { useTitle } from '@/lib/title';
import { clock, GAMES, pickRound, saveResult, shuffle } from '@/lib/vocab/games';
import type { VocabWord } from '@/lib/vocab/types';

const PER_BOARD = 5;
const BOARDS = 2;

type Board = { words: VocabWord[]; meanings: VocabWord[] };

// Pairs: five words and their five meanings, mixed. Click a word and its
// meaning (either first) to join them; a wrong pair shakes and costs five
// seconds. Two boards, against the clock: the best time is kept.
export function Pairs() {
  useTitle(GAMES.pairs.title);
  const [round, setRound] = useState(0);
  return <GameGate title={GAMES.pairs.title}>{(words) => <Round key={round} from={words} onAgain={() => setRound((n) => n + 1)} />}</GameGate>;
}

const PENALTY_MS = 5000;

function Round({ from, onAgain }: { from: GameWords; onAgain: () => void }) {
  const person = usePerson();
  const [boards] = useState<Board[]>(() => {
    const picked = pickRound(from, PER_BOARD * BOARDS);
    const out: Board[] = [];
    for (let i = 0; i + PER_BOARD <= picked.length; i += PER_BOARD) {
      const words = picked.slice(i, i + PER_BOARD);
      out.push({ words, meanings: shuffle(words) });
    }
    return out;
  });
  const [at, setAt] = useState(0);
  const [word, setWord] = useState<string | null>(null);
  const [meaning, setMeaning] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<[string, string] | null>(null);
  const [mistakes, setMistakes] = useState<VocabWord[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [result, setResult] = useState<{ ms: number; newBest: boolean } | null>(null);
  const now = useFastNow();

  const board = boards[at]!;
  const total = boards.length * PER_BOARD;
  const done = at * PER_BOARD + matched.length;
  const elapsed = result ? result.ms : Math.max(0, now - startedAt) + mistakes.length * PENALTY_MS;

  const tryPair = (w: string, m: string, clickedAt: number) => {
    if (w === m) {
      const next = [...matched, w];
      setMatched(next);
      setWord(null);
      setMeaning(null);
      if (next.length === board.words.length) {
        const finishedAt = clickedAt;
        window.setTimeout(() => {
          if (at + 1 < boards.length) {
            setAt(at + 1);
            setMatched([]);
          } else {
            const ms = finishedAt - startedAt + mistakes.length * PENALTY_MS;
            setResult({ ms, newBest: saveResult(person, 'pairs', ms, true) });
          }
        }, 450);
      }
      return;
    }
    setWrong([w, m]);
    const missed = board.words.find((x) => x.id === w);
    if (missed) setMistakes((list) => [...list, missed]);
    window.setTimeout(() => {
      setWrong(null);
      setWord(null);
      setMeaning(null);
    }, 420);
  };

  const pick = (side: 'word' | 'meaning', id: string, clickedAt: number) => {
    if (wrong || matched.includes(id)) return;
    if (side === 'word') {
      setWord(id);
      if (meaning) tryPair(id, meaning, clickedAt);
    } else {
      setMeaning(id);
      if (word) tryPair(word, id, clickedAt);
    }
  };

  if (result) {
    const unique = [...new Map(mistakes.map((w) => [w.id, w])).values()];
    return (
      <GameFrame title={GAMES.pairs.title}>
        <GameResult
          headline={mistakes.length === 0 ? 'A clean sweep' : 'All joined up'}
          detail={mistakes.length === 0 ? 'Every pair right the first time.' : `Each wrong pair added ${PENALTY_MS / 1000} seconds.`}
          stats={[
            { value: clock(result.ms), label: 'your time' },
            { value: String(total), label: 'pairs' },
            { value: String(mistakes.length), label: mistakes.length === 1 ? 'wrong pair' : 'wrong pairs' },
          ]}
          newBest={result.newBest}
          missed={unique.map((w) => ({ word: w }))}
          onAgain={onAgain}
        />
      </GameFrame>
    );
  }

  const tile = (side: 'word' | 'meaning', w: VocabWord) => {
    const isMatched = matched.includes(w.id);
    const selected = (side === 'word' ? word : meaning) === w.id;
    const isWrong = wrong != null && (side === 'word' ? wrong[0] : wrong[1]) === w.id;
    return (
      <button
        key={w.id}
        type="button"
        disabled={isMatched}
        aria-pressed={selected}
        onClick={() => pick(side, w.id, Date.now())}
        className={`flex min-h-[64px] w-full items-center rounded-control border px-3.5 py-2.5 text-left transition-colors sm:min-h-[76px] ${side === 'word' ? 'justify-center text-center text-[17px] font-bold' : 'text-[14px] leading-5'} ${
          isMatched ? 'pulse-good border-good/40 bg-good-tint text-good opacity-60' : isWrong ? 'shake border-bad bg-bad-tint text-bad' : selected ? 'border-primary bg-accent-tint text-ink ring-2 ring-primary/30' : 'border-line bg-surface text-ink hover:border-primary/50'
        }`}>
        {side === 'word' ? w.word : w.definition}
      </button>
    );
  };

  return (
    <GameFrame
      title={GAMES.pairs.title}
      step={done}
      total={total}
      right={
        <span className="t-subhead tabular inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 font-semibold text-ink" aria-label={`Time ${clock(elapsed)}`}>
          <Timer size={15} aria-hidden="true" className="text-ink-3" />
          {clock(elapsed)}
        </span>
      }>
      <p className="t-subhead mb-4 text-ink-2">Join each word to its meaning.</p>
      <div key={at} className="rise grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2.5 sm:gap-x-5">
        <div className="flex flex-col gap-2.5" role="group" aria-label="Words">
          {board.words.map((w) => tile('word', w))}
        </div>
        <div className="flex flex-col gap-2.5" role="group" aria-label="Meanings">
          {board.meanings.map((w) => tile('meaning', w))}
        </div>
      </div>
    </GameFrame>
  );
}
