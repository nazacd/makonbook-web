import { Undo2 } from 'lucide-react';
import { useId, type ReactNode } from 'react';

type AnswerChoiceProps = {
  letter: string;
  content: ReactNode;
  selected: boolean;
  eliminated: boolean;
  /** The ABC cross-out tool is on: each choice gets its strike button. */
  crossOut: boolean;
  onSelect: () => void;
  onToggleEliminate: () => void;
};

// The whole card selects the choice (Bluebook's rounded card with the
// circled letter); with the cross-out tool on, a strike button sits on the
// right, and a struck choice shows an undo in its place.
export function AnswerChoice({ letter, content, selected, eliminated, crossOut, onSelect, onToggleEliminate }: AnswerChoiceProps) {
  const struckId = useId();
  return (
    <div className="flex items-center gap-3">
      <div className={`relative flex min-w-0 flex-1 items-stretch rounded-control border bg-paper ${selected ? 'border-2 border-accent' : 'border-ink-3'} ${eliminated ? 'opacity-50' : ''}`}>
        {/* Named by its letter and text (the content), so a screen reader reads the answer. */}
        <button type="button" role="radio" aria-checked={selected} aria-describedby={eliminated ? struckId : undefined} onClick={eliminated ? undefined : onSelect} className={`flex min-h-[52px] flex-1 items-center gap-3 px-3 py-2 text-left ${eliminated ? 'cursor-default' : 'active:bg-paper-2'}`}>
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-full border t-footnote font-bold ${selected ? 'border-accent bg-accent text-on-accent' : 'border-ink-3 text-ink'}`}>{letter}</span>
          <span className="min-w-0 flex-1">{content}</span>
        </button>
        {eliminated && (
          <>
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 top-1/2 h-0.5 bg-ink" />
            <span id={struckId} className="sr-only">
              Struck out
            </span>
          </>
        )}
      </div>
      {crossOut &&
        (eliminated ? (
          <button type="button" onClick={onToggleEliminate} aria-label={`Bring back choice ${letter}`} className="t-footnote flex h-8 items-center gap-1 px-1 font-semibold text-accent underline">
            <Undo2 size={14} strokeWidth={2} aria-hidden="true" />
            Undo
          </button>
        ) : (
          <button type="button" onClick={onToggleEliminate} aria-label={`Strike out choice ${letter}`} className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-ink-3 t-footnote font-bold text-ink">
            {letter}
            <span aria-hidden="true" className="absolute inset-x-0.5 top-1/2 h-px bg-ink" />
          </button>
        ))}
    </div>
  );
}
