import { ArrowRight, Lightbulb } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { AnswerChoice } from '@/components/practice/AnswerChoice';
import { RichContent } from '@/components/practice/RichContent';
import { isCorrect } from '@/lib/practice/grade';
import type { Answered } from '@/lib/practice/mistakes';
import { SUBJECT_LABEL } from '@/lib/practice/run';

import { AskLater } from './AskLater';
import { ReportIssue } from './ReportIssue';

// One question of a drill session, as the reference draws it: "QUESTION 1 ·
// 4 REMAINING" with Ask later and the flag, the question's number, the
// question (passage, stem and figures from that test's package), "YOUR
// RESPONSE", and the footer's "Skip for now" + "Check answer". A right
// answer shows "Resolved. This question is cleared." and "Next question →";
// a wrong one shakes, strikes the pick out and says to try again; after two
// misses the explanation is on offer. Keys: A–D choose, Enter checks.

const LETTERS = ['A', 'B', 'C', 'D'] as const;

/** Misses after which the explanation is offered. */
const HELP_AFTER = 2;

type Props = {
  item: Answered;
  number: number;
  remaining: number;
  last: boolean;
  /** Off while a dialog (the reference sheet) is open over the question. */
  keys: boolean;
  onCleared: () => void;
  onSkip: () => void;
  onNext: () => void;
};

export function DrillQuestion({ item, number, remaining, last, keys, onCleared, onSkip, onNext }: Props) {
  const q = item.question;
  const { package: p, images: links } = item.pkg;
  const [answer, setAnswer] = useState('');
  const [struck, setStruck] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [cleared, setCleared] = useState(false);
  const [why, setWhy] = useState(false);
  const response = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLDivElement>(null);

  // A new question: focus its top, so the keys work at once and a screen reader starts here.
  useEffect(() => {
    top.current?.focus({ preventScroll: true });
  }, []);

  const shake = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    response.current?.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }],
      { duration: 500, easing: 'cubic-bezier(.36,.07,.19,.97)' },
    );
  };

  const check = () => {
    if (cleared) return onNext();
    if (!answer.trim()) return shake();
    if (isCorrect(q, answer)) {
      setCleared(true);
      onCleared();
    } else {
      setMisses((n) => n + 1);
      if (q.type === 'mcq') {
        setStruck((s) => [...s, answer]);
        setAnswer('');
      }
      shake();
    }
    requestAnimationFrame(() => status.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (!keys || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) return; // Ask later, the report
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (e.key === 'Enter') {
      // A button does its own thing on Enter; a choice's Enter means "check".
      if (t?.closest('a, select, textarea') || (t instanceof HTMLButtonElement && t.getAttribute('role') !== 'radio')) return;
      e.preventDefault();
      check();
      return;
    }
    if (cleared || q.type !== 'mcq' || t?.closest('input, textarea, select, [contenteditable="true"]')) return;
    const letter = e.key.toUpperCase();
    if (e.key.length === 1 && (LETTERS as readonly string[]).includes(letter) && q.choices?.[letter] != null && !struck.includes(letter)) {
      e.preventDefault();
      setAnswer(letter);
    }
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  return (
    <>
      <main className="min-h-0 flex-1 overflow-y-auto bg-brand">
        <div className="mx-auto w-full max-w-[680px] px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
          <div ref={top} tabIndex={-1} className="flex items-center justify-between gap-3 outline-none">
            <p className="t-micro text-ink-3">
              Question {number} · {remaining} remaining
            </p>
            <div className="flex items-center gap-2">
              <AskLater item={item} />
              <ReportIssue item={item} />
            </div>
          </div>
          <h1 className="sr-only">
            {SUBJECT_LABEL[item.subject]}, {item.skill}: question {number}
          </h1>

          <p className="tabular mb-4 mt-10 text-[14px] font-bold text-ink" aria-hidden="true">
            {q.position}
          </p>
          {q.passage && (
            <div className="mb-5">
              <RichContent text={q.passage} images={p.images} links={links} className="rich rich-sm" />
            </div>
          )}
          <RichContent text={q.stem} images={p.images} links={links} className="rich rich-sm" />

          <p className="t-micro mb-2 mt-7 text-ink-3">Your response</p>
          <div ref={response}>
            {q.type === 'mcq' && q.choices ? (
              <div role="radiogroup" aria-label="Answer choices" className="flex flex-col gap-3">
                {LETTERS.filter((l) => q.choices![l] != null).map((l) => (
                  <AnswerChoice
                    key={l}
                    letter={l}
                    content={<RichContent text={q.choices![l]} images={p.images} links={links} displayMath />}
                    selected={cleared ? l === q.correct : answer === l}
                    eliminated={struck.includes(l)}
                    crossOut={false}
                    onSelect={() => !cleared && setAnswer(l)}
                    onToggleEliminate={() => {}}
                  />
                ))}
              </div>
            ) : (
              // A plain text keyboard, as in the test: a phone's number pad has
              // no "-" or "/"; a decimal comma becomes a point.
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value.replace(/,/g, '.'))}
                readOnly={cleared}
                placeholder="Type your answer"
                aria-label="Your response"
                autoComplete="off"
                spellCheck={false}
                maxLength={12}
                className="h-10 w-full max-w-[362px] rounded-[8px] border border-line bg-surface px-3.5 text-[14px] text-ink shadow-[0_1px_3px_rgba(16,19,26,0.06)] outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-accent"
              />
            )}
          </div>

          <div ref={status} aria-live="polite" className="scroll-mb-6">
            {cleared ? (
              <p className="pop mt-5 rounded-[8px] bg-good-tint px-4 py-3 text-[13px] font-medium text-good">Resolved. This question is cleared.</p>
            ) : misses > 0 ? (
              <div key={misses} className="pop mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[8px] bg-bad-tint px-4 py-2.5">
                <p className="py-0.5 text-[13px] font-medium text-bad">Not quite — try again.</p>
                {misses >= HELP_AFTER && !why && (
                  <button type="button" onClick={() => setWhy(true)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink transition-colors duration-150 hover:bg-surface-2">
                    <Lightbulb size={14} strokeWidth={2} aria-hidden="true" className="text-amber" />
                    Show explanation
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {why && (
            <section className="rise mt-5 rounded-[12px] border border-line bg-surface p-4 sm:p-5" aria-label="Explanation">
              <h2 className="t-micro mb-2 text-ink-3">Explanation</h2>
              <RichContent text={q.explanation} images={p.images} links={links} className="rich rich-sm" />
            </section>
          )}
        </div>
      </main>

      <footer className="shrink-0 border-t border-line bg-surface px-4 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex h-[68px] max-w-[680px] items-center justify-center gap-3 sm:gap-5">
          {!cleared && (
            <button type="button" onClick={onSkip} className="h-10 rounded-[10px] px-3 text-[14px] font-medium text-ink-3 transition-colors duration-150 hover:text-ink">
              Skip for now
            </button>
          )}
          <button
            type="button"
            onClick={check}
            className="lift inline-flex h-10 w-[200px] items-center justify-center gap-2 rounded-[10px] bg-primary px-5 text-[14px] font-semibold text-on-primary hover:bg-primary-hover">
            {cleared ? (last ? 'Finish' : 'Next question') : 'Check answer'}
            {cleared && <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />}
          </button>
        </div>
      </footer>
    </>
  );
}
