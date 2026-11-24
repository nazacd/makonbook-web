import type { LucideIcon } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

import { Icon } from '@/components/Icon';
import { dragging } from '@/components/practice/Calculator';
import { useDialog } from '@/lib/dialog';

// The frame of a question screen, shared by the test (screens/PracticeRun)
// and by practice sets, homework and competitions (screens/roadmap/
// AssessmentRun): the header's tools, the menu under More, the docked
// calculator's pane and the navigator's popover over the footer.

/**
 * A header tool, as Bluebook's: the icon over its label. With `on` it is a
 * toggle (Calculator, Reference); with `menu` it opens a menu (More);
 * `accent` marks a state (Asked).
 */
export function Tool({ icon, label, ariaLabel, on, menu = false, accent = false, disabled = false, onClick }: { icon: LucideIcon; label: string; ariaLabel?: string; on?: boolean; menu?: boolean; accent?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={menu ? undefined : on}
      aria-haspopup={menu ? 'menu' : undefined}
      aria-expanded={menu ? !!on : undefined}
      aria-label={ariaLabel ?? label}
      title={ariaLabel}
      className={`flex h-14 min-w-11 flex-col items-center justify-center gap-0.5 rounded-chip px-2 disabled:opacity-40 sm:min-w-16 ${on ? 'bg-paper text-accent shadow-sm' : accent ? 'text-accent active:bg-paper' : 'text-ink active:bg-paper'}`}>
      <Icon as={icon} size={20} className="text-current" />
      <span className="t-caption hidden whitespace-nowrap font-medium sm:block">{label}</span>
    </button>
  );
}

// The ⋮ menu under More: the tools a narrow header has no room for. Escape,
// a press outside or choosing one closes it; arrow keys move between items.
export function MoreMenu({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const menu = useDialog<HTMLDivElement>(onClose);
  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])].filter((el) => el.offsetParent !== null);
  useEffect(() => {
    items()[0]?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    list[(at + step + list.length) % list.length]?.focus();
  };
  return (
    <>
      <div className="fixed inset-0 z-30" aria-hidden="true" onClick={onClose} />
      <div
        ref={menu}
        tabIndex={-1}
        role="menu"
        aria-label="More tools"
        onKeyDown={onKeyDown}
        className="pop absolute right-0 top-[calc(100%+6px)] z-40 flex w-60 flex-col rounded-control border border-line bg-paper p-1.5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.35)] outline-none">
        {children}
      </div>
    </>
  );
}

export function MenuItem({ icon, label, onClick, accent = false, className = '' }: { icon: LucideIcon; label: string; onClick: () => void; accent?: boolean; className?: string }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={`t-subhead flex min-h-11 w-full items-center gap-3 rounded-chip px-3 text-left font-semibold hover:bg-paper-2 focus-visible:bg-paper-2 active:bg-paper-2 ${accent ? 'text-accent' : 'text-ink'} ${className}`}>
      <Icon as={icon} size={18} className="shrink-0 text-current" />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

/** A laptop-sized window: the calculator docks beside the question. */
export function useWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}

const CALC_WIDTH_KEY = 'mb.calc.width';
const CALC_MIN = 300;
/** Keep room for the question beside the calculator. */
const calcMax = () => Math.max(CALC_MIN, window.innerWidth - 420);
const clampCalc = (w: number) => Math.round(Math.min(Math.max(w, CALC_MIN), calcMax()));

// The docked calculator's pane. Its right edge is a handle: drag it (or focus
// it and use the arrow keys) to make the calculator wider or narrower; the
// width is remembered in this browser.
export function CalcPane({ children, hidden }: { children: ReactNode; hidden: boolean }) {
  const [width, setWidth] = useState(() => {
    let saved = 0;
    try {
      saved = Number(localStorage.getItem(CALC_WIDTH_KEY)) || 0;
    } catch {
      // No storage: the default width.
    }
    return clampCalc(saved || window.innerWidth * 0.42);
  });
  useEffect(() => {
    const onResize = () => setWidth((w) => clampCalc(w));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const save = (w: number) => {
    try {
      localStorage.setItem(CALC_WIDTH_KEY, String(w));
    } catch {
      // Not remembered: fine.
    }
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const handle = e.currentTarget;
    const startX = e.clientX;
    const startW = width;
    let last = startW;
    handle.setPointerCapture(e.pointerId);
    dragging(true);
    const move = (ev: PointerEvent) => {
      last = clampCalc(startW + ev.clientX - startX);
      setWidth(last);
    };
    const up = () => {
      dragging(false);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      save(last);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowLeft' ? -24 : e.key === 'ArrowRight' ? 24 : 0;
    if (!step) return;
    e.preventDefault();
    const next = clampCalc(width + step);
    setWidth(next);
    save(next);
  };
  return (
    <aside className="relative shrink-0" style={{ width }} hidden={hidden}>
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the calculator"
        aria-valuenow={width}
        aria-valuemin={CALC_MIN}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className="group absolute -right-2 bottom-0 top-0 z-10 flex w-4 cursor-col-resize touch-none select-none items-center justify-center outline-none">
        <span className="h-full w-px bg-line-strong transition-colors group-hover:w-0.5 group-hover:bg-accent group-focus-visible:w-0.5 group-focus-visible:bg-accent" />
        <span className="absolute h-12 w-1.5 rounded-full bg-ink-3 transition-colors group-hover:bg-accent group-focus-visible:bg-accent" />
      </div>
    </aside>
  );
}

// The question navigator above the footer (Bluebook's popover).
export function Popover({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const dialog = useDialog<HTMLDivElement>(onClose);
  return (
    <div ref={dialog} tabIndex={-1} role="dialog" aria-label={label} className="absolute bottom-[calc(100%+10px)] left-1/2 z-30 w-[min(600px,calc(100vw-24px))] -translate-x-1/2 rounded-panel border border-line bg-paper p-5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.35)] outline-none">
      {children}
    </div>
  );
}
