import { CalendarClock, Check, ClipboardCheck, Compass, Flame, LineChart, PlayCircle, Signpost, SlidersHorizontal, SpellCheck, Target, X, XCircle, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

// Hiding dashboard widgets, lightly (no dragging, no editor page): a small
// menu with a tick per widget, kept in this browser. Today's plan and Your
// SAT stay, the page is built around them. Hidden widgets gather in one
// quiet row at the bottom, so nothing feels deleted.

export type WidgetKey = 'class' | 'mistakes' | 'week' | 'due' | 'continue' | 'roadmap' | 'vocab' | 'scores';

export const WIDGETS: { key: WidgetKey; label: string; icon: LucideIcon }[] = [
  { key: 'class', label: 'Next class', icon: CalendarClock },
  { key: 'mistakes', label: 'Incorrect questions', icon: XCircle },
  { key: 'week', label: 'This week', icon: Flame },
  { key: 'due', label: 'Due work', icon: ClipboardCheck },
  { key: 'continue', label: 'Continue', icon: PlayCircle },
  { key: 'roadmap', label: 'Roadmap', icon: Signpost },
  { key: 'vocab', label: 'Vocabulary', icon: SpellCheck },
  { key: 'scores', label: 'Mock scores', icon: LineChart },
];
/** Always on the page. */
const FIXED: { label: string; icon: LucideIcon }[] = [
  { label: 'Today’s plan', icon: Compass },
  { label: 'Your SAT', icon: Target },
];

const KEY = 'mb.dashboard.hidden';
const EVENT = 'mb:dashboard-hidden';
const KEYS = new Set<string>(WIDGETS.map((w) => w.key));
let cache: { raw: string | null; set: Set<WidgetKey> } | null = null;

function read(): Set<WidgetKey> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (cache && cache.raw === raw) return cache.set;
  let list: unknown;
  try {
    list = raw ? JSON.parse(raw) : [];
  } catch {
    list = [];
  }
  const set = new Set<WidgetKey>(Array.isArray(list) ? (list.filter((k) => typeof k === 'string' && KEYS.has(k)) as WidgetKey[]) : []);
  cache = { raw, set };
  return set;
}
function write(set: Set<WidgetKey>) {
  try {
    if (set.size) localStorage.setItem(KEY, JSON.stringify([...set]));
    else localStorage.removeItem(KEY);
  } catch {
    // Not kept: lasts as long as the page.
    cache = { raw: null, set };
  }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(cb: () => void) {
  const storage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', storage);
  };
}
const EMPTY = new Set<WidgetKey>();

/** Which widgets this browser hides, and the ways to change that. */
export function useHiddenWidgets() {
  const hidden = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    hidden,
    shown: (key: WidgetKey) => !hidden.has(key),
    toggle(key: WidgetKey) {
      const next = new Set(hidden);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      write(next);
    },
    showAll: () => write(new Set()),
  };
}

/** The Customise button and its menu. */
export function CustomiseMenu() {
  const { hidden, toggle, showAll } = useHiddenWidgets();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-9 items-center gap-1.5 rounded-chip border border-line bg-surface px-2.5 text-[13px] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink md:px-3"
        title="Choose which widgets show">
        <SlidersHorizontal size={15} aria-hidden="true" />
        <span className="hidden md:inline">Customise</span>
        {hidden.size > 0 && <span className="rounded-full bg-accent-tint px-1.5 text-[11px] font-bold text-accent tabular">{hidden.size}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Dashboard widgets" className="pop absolute right-0 top-[calc(100%+6px)] z-30 w-64 rounded-card border border-line bg-surface p-2 shadow-[0_12px_32px_-8px_rgba(16,19,26,0.18)]">
          <div className="mb-1 flex items-center justify-between px-1.5 pt-1">
            <p className="t-micro text-ink-2">On your dashboard</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex size-7 items-center justify-center rounded-[8px] text-ink-2 hover:bg-surface-2">
              <X size={15} />
            </button>
          </div>
          <ul className="flex flex-col">
            {FIXED.map((w) => (
              <li key={w.label} className="flex h-9 items-center gap-2.5 px-1.5 text-[14px] text-ink-3" title="Always shown">
                <w.icon size={16} aria-hidden="true" />
                <span className="flex-1">{w.label}</span>
                <Check size={15} className="opacity-50" aria-label="Always shown" />
              </li>
            ))}
            {WIDGETS.map((w) => {
              const on = !hidden.has(w.key);
              return (
                <li key={w.key}>
                  <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(w.key)} className={`flex h-9 w-full items-center gap-2.5 rounded-chip px-1.5 text-left text-[14px] hover:bg-surface-2 ${on ? 'text-ink' : 'text-ink-3'}`}>
                    <w.icon size={16} aria-hidden="true" />
                    <span className="flex-1">{w.label}</span>
                    <span className={`flex size-[18px] items-center justify-center rounded-[5px] border ${on ? 'border-primary bg-primary text-on-primary' : 'border-line-strong'}`} aria-hidden="true">
                      {on && <Check size={13} strokeWidth={3} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {hidden.size > 0 && (
            <button type="button" onClick={showAll} className="mt-1 flex h-9 w-full items-center justify-center rounded-chip text-[13px] font-semibold text-accent hover:bg-accent-tint">
              Show all again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The quiet line at the bottom naming what's hidden. */
export function HiddenRow() {
  const { hidden, toggle, showAll } = useHiddenWidgets();
  if (!hidden.size) return null;
  const list = WIDGETS.filter((w) => hidden.has(w.key));
  return (
    <p className="t-footnote mt-5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-ink-3">
      <span>Hidden:</span>
      {list.map((w) => (
        <button key={w.key} type="button" onClick={() => toggle(w.key)} title={`Show ${w.label}`} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 font-semibold text-ink-2 hover:text-ink">
          <w.icon size={13} aria-hidden="true" />
          {w.label}
        </button>
      ))}
      {list.length > 1 && (
        <button type="button" onClick={showAll} className="font-semibold text-accent hover:underline">
          Show all
        </button>
      )}
    </p>
  );
}
