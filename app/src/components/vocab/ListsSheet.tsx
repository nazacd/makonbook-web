import { CircleMinus, Plus } from 'lucide-react';
import { useState } from 'react';

import { Icon } from '@/components/Icon';
import { NEW_PER_DAY, type Settings } from '@/lib/vocab/local';
import { listName } from '@/lib/vocab/progress';
import type { Deck } from '@/lib/vocab/types';

type ListsSheetProps = {
  deck: Deck;
  settings: Settings;
  /** Called once, as the sheet closes, with what was chosen in it. */
  onClose: (next: Settings) => void;
};

// "Lists & pace": the setup kept off the Words tab. New words a day, the
// lists being studied (each with a minus to stop it), and the other lists as
// chips to add. Changes apply when the sheet closes, not on every click.
export function ListsSheet({ deck, settings, onClose }: ListsSheetProps) {
  const [draft, setDraft] = useState(settings);
  const studying = deck.lists.filter((l) => draft.active.includes(l.slug));
  const others = deck.lists.filter((l) => !draft.active.includes(l.slug));
  const toggle = (slug: string, on: boolean) => setDraft((d) => ({ ...d, active: on ? [...d.active, slug] : d.active.filter((s) => s !== slug) }));
  const close = () => onClose(draft);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center" onClick={close}>
      <div role="dialog" aria-label="Lists and pace" className="flex max-h-[85dvh] w-full max-w-xl flex-col rounded-t-panel bg-surface pt-2.5 sm:rounded-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1 w-9 rounded-full bg-line-strong sm:hidden" />
        <div className="mt-1.5 flex items-center justify-between px-5">
          <h2 className="t-title2 text-ink">Lists & pace</h2>
          <button type="button" onClick={close} className="t-headline min-h-11 text-accent">
            Done
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3.5">
          <p className="t-subhead mb-2 text-ink-2">New words a day</p>
          <div role="radiogroup" aria-label="New words a day" className="flex rounded-control bg-surface-2 p-1">
            {NEW_PER_DAY.map((n) => {
              const on = draft.newPerDay === n;
              return (
                <button key={n} type="button" role="radio" aria-checked={on} onClick={() => setDraft((d) => ({ ...d, newPerDay: n }))} className={`t-subhead tabular h-10 flex-1 rounded-[11px] ${on ? 'bg-surface font-medium text-ink shadow-sm' : 'text-ink-2'}`}>
                  {n}
                </button>
              );
            })}
          </div>
          {studying.length > 0 && (
            <>
              <h3 className="t-title3 mb-1.5 mt-7 text-ink">Studying</h3>
              <ul>
                {studying.map((l, i) => (
                  <li key={l.slug} className={`flex min-h-14 items-center gap-3 ${i ? 'border-t border-line' : ''}`}>
                    <span className="flex flex-1 flex-col">
                      <span className="t-title3 text-[17px] leading-[22px] text-ink">{listName(l.title)}</span>
                      <span className="t-footnote text-ink-3">{l.words.length} words</span>
                    </span>
                    <button type="button" onClick={() => toggle(l.slug, false)} aria-label={`Stop studying ${listName(l.title)}`} className="-mr-2.5 flex size-11 items-center justify-center active:opacity-60">
                      <Icon as={CircleMinus} size={22} className="text-ink-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {others.length > 0 && (
            <>
              <h3 className="t-title3 mb-3.5 mt-7 text-ink">Add a list</h3>
              <UnitChips lists={others} onAdd={(slug) => toggle(slug, true)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Lists as chips in a three-column grid, each one click to start it. */
export function UnitChips({ lists, onAdd }: { lists: Deck['lists']; onAdd: (slug: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {lists.map((l) => (
        <button key={l.slug} type="button" onClick={() => onAdd(l.slug)} aria-label={`Start ${listName(l.title)}, ${l.words.length} words`} className="t-subhead flex h-11 items-center justify-center gap-1.5 rounded-[12px] border border-line-strong font-medium text-ink active:bg-surface-2">
          <Icon as={Plus} size={15} className="text-ink-3" />
          {listName(l.title)}
        </button>
      ))}
    </div>
  );
}
