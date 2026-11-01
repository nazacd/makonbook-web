import { Undo2, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { Icon } from '@/components/Icon';

type AnswerChoiceProps = {
  letter: string;
  content: ReactNode;
  selected: boolean;
  eliminated: boolean;
  onSelect: () => void;
  onToggleEliminate: () => void;
};

// The whole card selects the choice; the strike-out control on the right is
// its own target (Bluebook's "cross out" tool).
export function AnswerChoice({ letter, content, selected, eliminated, onSelect, onToggleEliminate }: AnswerChoiceProps) {
  return (
    <div className={`relative flex items-stretch gap-1 rounded-control border bg-surface ${selected ? 'border-accent bg-accent-tint' : 'border-line'}`}>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={eliminated ? `Choice ${letter}, struck out` : `Choice ${letter}`}
        onClick={eliminated ? undefined : onSelect}
        className={`flex min-h-[52px] flex-1 items-center gap-3 p-3 text-left ${eliminated ? 'cursor-default opacity-40' : 'active:scale-[0.99]'}`}>
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border t-subhead font-semibold ${selected ? 'border-accent bg-accent text-on-accent' : 'border-line-strong text-ink'}`}>
          {letter}
        </span>
        <span className="min-w-0 flex-1">{content}</span>
      </button>
      {eliminated && <span aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-1/2 h-0.5 bg-ink-3" />}
      <button
        type="button"
        onClick={onToggleEliminate}
        aria-label={eliminated ? `Bring back choice ${letter}` : `Strike out choice ${letter}`}
        className="flex w-11 shrink-0 items-center justify-center text-ink-3">
        {eliminated ? (
          <span className="rounded-full bg-surface p-1.5">
            <Icon as={Undo2} size={16} className="text-ink-3" />
          </span>
        ) : (
          <Icon as={X} size={16} className="text-ink-3" />
        )}
      </button>
    </div>
  );
}
