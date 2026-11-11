import { Check, Flame, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Button } from '@/components/Button';
import { GameFrame, GameGate, GameResult, SpeakButton, type GameWords } from '@/components/vocab/Game';
import { useRecordGame } from '@/api/vocabSocial';
import { uuid } from '@/lib/device-id';
import { usePerson } from '@/lib/practice/hooks';
import { useTitle } from '@/lib/title';
import { distractors, GAMES, gapOf, pickRound, saveResult, shuffle } from '@/lib/vocab/games';
import type { VocabWord } from '@/lib/vocab/types';

const QUESTIONS = 10;

type Question = { word: VocabWord; before: string; after: string; shown: string; options: VocabWord[] };

const hasGap = (w: VocabWord) => gapOf(w) != null;

// Fill the gap: the word's example sentence with the word taken out, and
// four words to choose from. After each answer the sentence is completed and
// the meaning shown. Keys: 1–4 choose, Enter goes on.
export function FillGap() {
  useTitle(GAMES.gap.title);
  const [round, setRound] = useState(0);
  return (
    <GameGate title={GAMES.gap.title} fits={hasGap}>
      {(words) => <Round key={round} from={words} onAgain={() => setRound((n) => n + 1)} />}
    </GameGate>
  );
}

function Round({ from, onAgain }: { from: GameWords; onAgain: () => void }) {
  const person = usePerson();
  const record = useRecordGame();
  const [startedAt] = useState(() => Date.now());
  const [questions] = useState<Question[]>(() =>
    pickRound(from, QUESTIONS, hasGap).map((word) => {
      // Wrong choices come from the person's own lists when there are enough, so they are words worth knowing too.
      const own = [...from.met, ...from.unmet];
      const others = distractors(word, own.length >= 8 ? own : from.all);
      return { word, ...gapOf(word)!, options: shuffle([word, ...others]) };
    }),
  );
  const [at, setAt] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const [run, setRun] = useState(0);
  const [bestRun, setBestRun] = useState(0);
  const [missed, setMissed] = useState<VocabWord[]>([]);
  const [result, setResult] = useState<{ newBest: boolean } | null>(null);

  const q = questions[at]!;

  const choose = (id: string) => {
    if (chosen) return;
    setChosen(id);
    if (id === q.word.id) {
      setRight(right + 1);
      setRun(run + 1);
      setBestRun(Math.max(bestRun, run + 1));
    } else {
      setRun(0);
      setMissed((m) => [...m, q.word]);
    }
  };
  const next = (at: number) => {
    if (!chosen) return;
    if (at + 1 < questions.length) {
      setAt(at + 1);
      setChosen(null);
    } else {
      record({ id: uuid(), game: 'gap', score: right, total: questions.length, mistakes: questions.length - right, duration_ms: at - startedAt, missed: missed.map((w) => w.id), played_at: new Date(at).toISOString() });
      setResult({ newBest: saveResult(person, 'gap', right) });
    }
  };

  const latest = useRef({ choose, next, options: q.options });
  useLayoutEffect(() => {
    latest.current = { choose, next, options: q.options };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const l = latest.current;
      if (e.key === 'Enter') l.next(Date.now());
      else if (/^[1-4]$/.test(e.key)) {
        const o = l.options[Number(e.key) - 1];
        if (o) l.choose(o.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (result) {
    return (
      <GameFrame title={GAMES.gap.title}>
        <GameResult
          headline={right === questions.length ? 'Not one gap left' : right >= questions.length * 0.7 ? 'Good reading' : 'Round done'}
          detail="Seeing a word in a sentence is how the SAT asks for it."
          stats={[
            { value: `${right}/${questions.length}`, label: 'right' },
            { value: String(bestRun), label: 'in a row' },
          ]}
          newBest={result.newBest}
          missed={missed.map((w) => ({ word: w }))}
          onAgain={onAgain}
        />
      </GameFrame>
    );
  }

  const answered = chosen != null;
  const correct = chosen === q.word.id;

  return (
    <GameFrame
      title={GAMES.gap.title}
      step={at}
      total={questions.length}
      right={
        run >= 2 ? (
          <span className="t-subhead tabular inline-flex items-center gap-1 rounded-full bg-watch-tint px-2.5 py-1 font-bold text-watch" aria-label={`${run} in a row`}>
            <Flame size={15} aria-hidden="true" /> {run}
          </span>
        ) : undefined
      }>
      <div key={q.word.id} className="rise flex flex-1 flex-col">
        <section className="rounded-card border border-line bg-surface p-5 sm:p-7">
          <p className="t-footnote font-semibold uppercase tracking-wide text-ink-3">Which word fits?</p>
          <p className="mt-3 text-[20px] font-medium leading-8 text-ink sm:text-[23px] sm:leading-9">
            {q.before}
            {answered ? (
              <span className={`rounded-[8px] px-1.5 py-0.5 font-bold ${correct ? 'bg-good-tint text-good' : 'bg-watch-tint text-watch'}`}>{q.shown}</span>
            ) : (
              <span className="mx-0.5 inline-block w-24 translate-y-1 border-b-[3px] border-dashed border-primary align-baseline" aria-label="gap" />
            )}
            {q.after}
          </p>
        </section>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2" role="group" aria-label="Choices">
          {q.options.map((o, i) => {
            const isAnswer = o.id === q.word.id;
            const isChosen = o.id === chosen;
            const tone = !answered ? 'border-line bg-surface text-ink hover:border-primary/50' : isAnswer ? 'border-good bg-good-tint text-good' : isChosen ? 'shake border-bad bg-bad-tint text-bad' : 'border-line bg-surface text-ink-3';
            return (
              <button key={o.id} type="button" disabled={answered} onClick={() => choose(o.id)} className={`flex h-14 items-center gap-3 rounded-control border px-3.5 text-left text-[17px] font-bold transition-colors ${tone}`}>
                <span className={`t-footnote flex size-6 shrink-0 items-center justify-center rounded-[7px] font-bold ${answered ? 'bg-transparent' : 'bg-surface-2 text-ink-3'}`}>
                  {answered && isAnswer ? <Check size={17} strokeWidth={3} aria-hidden="true" /> : answered && isChosen ? <X size={17} strokeWidth={3} aria-hidden="true" /> : i + 1}
                </span>
                {o.word}
              </button>
            );
          })}
        </div>

        {answered && (
          <section className="rise mt-4 flex items-start gap-3 rounded-card bg-surface-2 p-4" aria-live="polite">
            <span className="min-w-0 flex-1">
              <span className="t-body">
                <span className="font-bold text-ink">{q.word.word}</span>
                {q.word.part_of_speech && <span className="t-footnote italic text-ink-3"> {q.word.part_of_speech}</span>}
              </span>
              <span className="t-subhead block text-ink-2">{q.word.definition}</span>
            </span>
            <SpeakButton word={q.word.word} />
          </section>
        )}

        <div className="mt-auto pt-8 sm:mt-0">
          <Button label={at + 1 < questions.length ? 'Next' : 'See the result'} onClick={() => next(Date.now())} disabled={!answered} className="w-full" />
        </div>
      </div>
    </GameFrame>
  );
}
