import { ArrowLeft, RotateCcw, Trophy, Volume2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { useStudyDeck } from '@/api/vocabSocial';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { Skeleton } from '@/components/States';
import { MIN_WORDS, pool } from '@/lib/vocab/games';
import { useSettings, useVocabState, useVocabSync } from '@/lib/vocab/hooks';
import { activeLists } from '@/lib/vocab/scheduler';
import type { VocabWord } from '@/lib/vocab/types';
import { canSpeak, speak } from '@/lib/speak';

export type GameWords = { met: VocabWord[]; unmet: VocabWord[]; all: VocabWord[] };

/** The frame of a word game: a full screen with a way back, where the round stands, and the game below. */
export function GameFrame({ title, step, total, right, children }: { title: string; step?: number; total?: number; right?: ReactNode; children: ReactNode }) {
  const progress = step != null && total ? Math.min(1, step / total) : null;
  return (
    <div className="flex min-h-dvh flex-col bg-brand">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[760px] items-center gap-3 px-4">
          <Link to="/words" aria-label="Back to Vocabulary" className="-ml-2 flex size-10 items-center justify-center rounded-chip text-ink hover:bg-surface-2">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <h1 className="t-headline min-w-0 flex-1 truncate text-ink">{title}</h1>
          {right}
          {step != null && total != null && (
            <span className="t-subhead tabular font-semibold text-ink-2" aria-label={`${Math.min(step + 1, total)} of ${total}`}>
              {Math.min(step + 1, total)} <span className="text-ink-3">/ {total}</span>
            </span>
          )}
        </div>
        {progress != null && (
          <div className="mx-auto w-full max-w-[760px] px-4">
            <div className="h-1 overflow-hidden rounded-full bg-track">
              <div className="h-1 rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-4 pb-8 pt-6">{children}</main>
    </div>
  );
}

/**
 * Loads the person's words and hands them to the game once: the words of the
 * lists turned on, those met in the flashcards first. Too few words, and it
 * says what to do instead of starting.
 */
export function GameGate({ title, fits, children }: { title: string; fits?: (w: VocabWord) => boolean; children: (words: GameWords) => ReactNode }) {
  const deck = useStudyDeck();
  const state = useVocabState();
  const settings = useSettings();
  const needDeck = deck.isSuccess && deck.data == null;
  const sync = useVocabSync(needDeck);

  if (!deck.data || !state.data || !settings.data) {
    const failed = deck.isError || state.isError || settings.isError || (needDeck && sync.isError);
    return (
      <GameFrame title={title}>
        {failed ? (
          <Notice tone="error" title="Couldn’t load your words" message="Open Vocabulary first, then come back to play." />
        ) : (
          <div className="flex flex-col gap-4 pt-6">
            <Skeleton height={120} radius={16} />
            <Skeleton height={56} radius={12} />
            <Skeleton height={56} radius={12} />
          </div>
        )}
      </GameFrame>
    );
  }

  const active = activeLists(settings.data, deck.data, state.data.cards);
  const from = pool(deck.data, active, state.data.cards);
  const usable = [...from.met, ...from.unmet].filter(fits ?? (() => true));
  if (usable.length < MIN_WORDS) {
    return (
      <GameFrame title={title}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <h2 className="t-title2 text-ink">{active.length === 0 ? 'Pick a list first' : 'Not enough words yet'}</h2>
          <p className="t-body max-w-[360px] text-ink-2">{active.length === 0 ? 'The games use the words of your lists. Turn one on in Vocabulary, then play.' : 'This game needs a few more words than your lists have for it. Add another list in Vocabulary.'}</p>
          <Link to="/words" className="lift inline-flex h-[46px] items-center rounded-card bg-primary px-6 text-[15px] font-bold text-on-primary">
            Open Vocabulary
          </Link>
        </div>
      </GameFrame>
    );
  }
  return <>{children({ ...from, all: deck.data.lists.flatMap((l) => l.words) })}</>;
}

/** Says the word aloud; nothing on browsers without voices. */
export function SpeakButton({ word, className = '' }: { word: string; className?: string }) {
  if (!canSpeak()) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(word);
      }}
      aria-label={`Hear “${word}”`}
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-accent hover:bg-accent-tint ${className}`}>
      <Volume2 size={18} aria-hidden="true" />
    </button>
  );
}

export type Missed = { word: VocabWord; note?: string };

/** The end of a round: the result, whether it's a new best, the words to look at again, and another go. */
export function GameResult({ headline, detail, stats, newBest, missed, onAgain }: { headline: string; detail: string; stats: { value: string; label: string }[]; newBest: boolean; missed: Missed[]; onAgain: () => void }) {
  return (
    <div className="rise mx-auto flex w-full max-w-[520px] flex-1 flex-col">
      <div className="flex flex-col items-center pt-6 text-center">
        <span className="mb-4 flex size-[72px] items-center justify-center rounded-full bg-accent-tint">
          <Icon as={Trophy} size={34} className="text-accent" />
        </span>
        <h2 className="t-title text-ink">{headline}</h2>
        <p className="t-body mt-2 text-ink-2">{detail}</p>
        {newBest && <p className="t-subhead mt-3 rounded-full bg-watch-tint px-3 py-1 font-bold text-watch">New personal best</p>}
        <div className="mt-6 flex justify-center gap-8">
          {stats.map((s) => (
            <p key={s.label} className="flex flex-col items-center" aria-label={`${s.value} ${s.label}`}>
              <span className="t-number text-[30px] leading-9 text-ink">{s.value}</span>
              <span className="t-footnote text-ink-2">{s.label}</span>
            </p>
          ))}
        </div>
      </div>
      {missed.length > 0 && (
        <section className="mt-8 rounded-card border border-line bg-surface p-5">
          <h3 className="t-headline text-ink">Worth another look</h3>
          <ul className="mt-2">
            {missed.map(({ word }, i) => (
              <li key={word.id} className={`flex items-start gap-3 py-2.5 ${i ? 'border-t border-line' : ''}`}>
                <span className="min-w-0 flex-1">
                  <span className="t-body font-bold text-ink">{word.word}</span>
                  <span className="t-footnote block text-ink-2">{word.definition}</span>
                </span>
                <SpeakButton word={word.word} className="size-9" />
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-auto flex flex-col gap-2 pt-8 sm:mt-0 sm:flex-row-reverse">
        <Button label="Play again" onClick={onAgain} className="flex-1" icon={<RotateCcw size={17} aria-hidden="true" />} />
        <Link to="/words" className="t-headline inline-flex h-[46px] flex-1 items-center justify-center rounded-card border border-line-strong bg-surface px-6 text-ink hover:bg-surface-2">
          Back to Vocabulary
        </Link>
      </div>
    </div>
  );
}
