import { useQueryClient } from '@tanstack/react-query';
import { Check, Sparkles, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { State, type Grade } from 'ts-fsrs';

import { describeError } from '@/api/errors';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { Skeleton } from '@/components/States';
import { SpeakButton } from '@/components/vocab/Game';
import { usePerson } from '@/lib/practice/hooks';
import { useTitle } from '@/lib/title';
import { hasImage, imageUri } from '@/lib/vocab/files';
import { useDeck, useRecordReview, useSettings, useVocabState, useVocabSync } from '@/lib/vocab/hooks';
import { activeLists, GRADES, newToday, preview, queue } from '@/lib/vocab/scheduler';
import type { VocabWord } from '@/lib/vocab/types';

// The four ratings in their own colours (Again red, Hard orange, Good green, Easy blue), tinted.
const GRADE_BG: Record<number, string> = { 1: 'bg-bad-tint text-bad', 2: 'bg-watch-tint text-watch', 3: 'bg-good-tint text-good', 4: 'bg-info-tint text-info' };
const KEYS = ['1', '2', '3', '4'];

// The word in the example sentence in bold: "abate" also in "abated".
function Example({ text, word }: { text: string; word: string }) {
  const stem = word.toLowerCase().replace(/e$/, '');
  const parts = text.split(/(\s+)/);
  return (
    <p className="t-callout mt-2.5 border-l-2 border-line-strong pl-3.5 italic leading-6 text-ink-2">
      {parts.map((p, i) => (stem.length > 2 && p.toLowerCase().replace(/^[^a-z]+/, '').startsWith(stem) ? <strong key={i} className="font-bold text-ink">{p}</strong> : p))}
    </p>
  );
}

// A study session (the phone's vocab/study): cards due, then today's new
// words, one at a time. The student recalls the meaning, shows the answer
// and says how well they knew it; FSRS decides when it comes back. Every
// rating is saved at once, so the session can be left at any point. The
// card turns over on a click; keys: space shows the answer, 1–4 rate.
export function Study() {
  useTitle('Study');
  const navigate = useNavigate();
  const person = usePerson();
  const queryClient = useQueryClient();
  const deck = useDeck();
  const state = useVocabState();
  const settings = useSettings();
  const record = useRecordReview();
  // Opened straight from a link before Words ever downloaded the deck.
  const needDeck = deck.isSuccess && deck.data == null;
  const sync = useVocabSync(needDeck);
  const [saveFailed, setSaveFailed] = useState(false);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const [newDone, setNewDone] = useState(0);
  const [shownAt, setShownAt] = useState(() => Date.now());
  // "Now" for picking cards: refreshed after each rating, not on every render.
  const [now, setNow] = useState(() => new Date());

  const close = () => {
    void queryClient.invalidateQueries({ queryKey: ['vocab-sync', person] }); // upload what was studied
    void navigate('/words');
  };

  const closeButton = (
    <button type="button" onClick={close} aria-label="Finish studying" className="-ml-2.5 flex size-11 items-center justify-center rounded-chip active:opacity-60">
      <Icon as={X} size={22} />
    </button>
  );

  if (!deck.data || !state.data || !settings.data) {
    const failed = deck.isError || state.isError || settings.isError || (needDeck && sync.isError);
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5">
        <div className="flex h-[52px] shrink-0 items-center">{closeButton}</div>
        {failed ? (
          <div className="flex flex-1 flex-col justify-center gap-4 pb-[52px]">
            <Notice
              tone="error"
              title="Couldn’t load your words"
              message={needDeck && sync.isError ? describeError(sync.error) : 'This browser couldn’t open the words it keeps. Check that it lets this site keep data.'}
            />
            <Button label="Back to Words" onClick={close} />
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-[68px]">
            <Skeleton width={180} height={48} />
            <Skeleton width={90} />
          </div>
        )}
      </div>
    );
  }

  const s = { ...settings.data, active: activeLists(settings.data, deck.data, state.data.cards) };
  const newLeft = Math.max(0, s.newPerDay - newToday(state.data.log, now));
  const q = queue(deck.data, s.active, state.data.cards, now, newLeft);
  const word: VocabWord | undefined = q.due[0] ?? q.fresh[0] ?? q.soon[0];
  const left = q.due.length + q.fresh.length + q.soon.length;
  const card = word ? state.data.cards.get(word.id) : undefined;
  const gaps = preview(card, now);
  const progress = done + left > 0 ? done / (done + left) : 1;
  const waiting = [...q.due, ...q.soon];
  const counts = {
    fresh: q.fresh.length,
    learning: waiting.filter((w) => state.data.cards.get(w.id)?.state !== State.Review).length,
    review: waiting.filter((w) => state.data.cards.get(w.id)?.state === State.Review).length,
  };

  const answer = async (rating: Grade, at: number) => {
    if (!word) return;
    setShown(false);
    const wasNew = !card;
    try {
      await record(word.id, card, rating, at - shownAt);
    } catch {
      setSaveFailed(true); // shown on screen; the session goes on
    }
    setDone((n) => n + 1);
    if (wasNew) setNewDone((n) => n + 1);
    setNow(new Date(at));
    setShownAt(at);
  };

  return (
    <div className="mx-auto flex h-dvh w-full max-w-xl flex-col px-5">
      <Keys shown={shown} hasWord={!!word} onShow={() => setShown(true)} onRate={(g, at) => void answer(g, at)} />
      <div className="flex h-[52px] shrink-0 items-center gap-3">
        {closeButton}
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track" role="progressbar" aria-label={`${done} done, ${left} left`} aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="t-subhead tabular min-w-12 text-right font-medium text-ink-2">{left} left</span>
      </div>

      {saveFailed && (
        <Notice tone="error" title="Answers aren’t being saved" message="This browser didn’t let SATMAKON keep your last answer. Check that it lets this site keep data." />
      )}
      {!word ? (
        <Finish done={done} newDone={newDone} onClose={close} />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto pb-6 pt-3">
            <p className="mb-3 flex flex-wrap items-center gap-1.5" aria-label={`${counts.fresh} new, ${counts.learning} learning, ${counts.review} to review`}>
              <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${!card ? 'bg-math-tint text-math' : 'bg-surface-2 text-ink-3'}`}>{counts.fresh} new</span>
              <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${card && card.state !== State.Review ? 'bg-watch-tint text-watch' : 'bg-surface-2 text-ink-3'}`}>{counts.learning} learning</span>
              <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${card?.state === State.Review ? 'bg-good-tint text-good' : 'bg-surface-2 text-ink-3'}`}>{counts.review} to review</span>
            </p>
            <div key={word.id} className="flip rise" data-shown={shown}>
              <div className="flip-inner">
                {/* The front: the word alone. Click it (or press space) to turn it over. */}
                <button
                  type="button"
                  onClick={() => setShown(true)}
                  disabled={shown}
                  inert={shown}
                  aria-label={`${word.word}. Show the answer`}
                  className="relative flex min-h-[340px] flex-col items-center justify-center rounded-panel border border-line bg-surface p-6 text-center shadow-[0_10px_30px_rgba(20,10,60,0.06)]">
                  {!card && (
                    <span className="t-subhead absolute left-5 top-4 flex items-center gap-1.5 font-medium text-accent">
                      <Icon as={Sparkles} size={15} className="text-accent" />
                      New word
                    </span>
                  )}
                  <span className="font-title break-words text-[44px] font-bold leading-[50px] text-ink">{word.word}</span>
                  {word.part_of_speech && <span className="t-callout mt-1.5 italic text-ink-2">{word.part_of_speech}</span>}
                  <span className="t-subhead absolute inset-x-0 bottom-5 text-ink-3">Say what it means, then turn the card</span>
                </button>
                {/* The back: the meaning, the word in a sentence, its picture. */}
                <div inert={!shown} className="flip-back flex min-h-[340px] flex-col rounded-panel border border-line bg-surface p-6 shadow-[0_10px_30px_rgba(20,10,60,0.06)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h1 className="font-title break-words text-[30px] font-bold leading-9 text-ink">{word.word}</h1>
                      {word.part_of_speech && <p className="t-footnote italic text-ink-2">{word.part_of_speech}</p>}
                    </div>
                    <SpeakButton word={word.word} />
                  </div>
                  <p className="mt-4 text-[20px] font-medium leading-7 text-ink">{word.definition}</p>
                  <Example text={word.example} word={word.word} />
                  {word.image && hasImage(word.image.file) && (
                    <img src={imageUri(word.image.file)} alt="" width={word.image.width} height={word.image.height} className="mt-[18px] max-h-72 w-full rounded-control object-contain" />
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="shrink-0 pb-4 pt-2">
            {shown ? (
              <div className="flex gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g.rating}
                    type="button"
                    onClick={() => void answer(g.rating, Date.now())}
                    aria-label={`${g.label}, comes back in ${gaps[g.rating]}`}
                    className={`flex h-16 flex-1 flex-col items-center justify-center gap-0.5 rounded-control transition-transform active:scale-[0.97] ${GRADE_BG[g.rating]}`}>
                    <span className="t-callout font-bold">
                      {g.label} <span className="t-caption font-semibold opacity-60">{g.rating}</span>
                    </span>
                    <span className="t-caption tabular font-semibold opacity-75">{gaps[g.rating]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <Button label="Show answer" onClick={() => setShown(true)} className="w-full" />
            )}
            {!shown && <p className="t-caption mt-2 hidden text-center text-ink-3 sm:block">Space turns the card · 1 to 4 rate it</p>}
          </div>
        </>
      )}
    </div>
  );
}

// Keyboard: space shows the answer, 1–4 rate. Listens on the window, so no
// element needs focus; reads the latest props through a ref.
function Keys({ shown, hasWord, onShow, onRate }: { shown: boolean; hasWord: boolean; onShow: () => void; onRate: (g: Grade, at: number) => void }) {
  const latest = useRef({ shown, hasWord, onShow, onRate });
  useLayoutEffect(() => {
    latest.current = { shown, hasWord, onShow, onRate };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const l = latest.current;
      if (!l.hasWord || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ' && !l.shown) {
        e.preventDefault();
        l.onShow();
      } else if (l.shown && KEYS.includes(e.key)) {
        e.preventDefault();
        l.onRate(Number(e.key) as Grade, Date.now());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}

function Finish({ done, newDone, onClose }: { done: number; newDone: number; onClose: () => void }) {
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {done > 0 && (
          <span className="mb-[18px] flex size-[72px] items-center justify-center rounded-full bg-good-tint">
            <Icon as={Check} size={36} strokeWidth={2.4} className="text-good" />
          </span>
        )}
        <h1 className="t-title text-ink">{done > 0 ? 'Well done' : 'Nothing to study'}</h1>
        <p className="t-body mt-2.5 text-ink-2">{done > 0 ? 'They come back when you’re about to forget them.' : 'No words are due. Come back later, or add a list.'}</p>
        {done > 0 && (
          <div className="mt-[18px] flex gap-6">
            <Stat value={done} label={done === 1 ? 'word' : 'words'} />
            {newDone > 0 && <Stat value={newDone} label="new" />}
          </div>
        )}
      </div>
      <div className="shrink-0 pb-4 pt-2">
        <Button label="Done" onClick={onClose} className="w-full" />
      </div>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <p className="flex flex-col items-center" aria-label={`${value} ${label}`}>
      <span className="font-title tabular text-[26px] font-bold leading-[30px] text-ink">{value}</span>
      <span className="t-footnote text-ink-2">{label}</span>
    </p>
  );
}
