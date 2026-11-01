import { X } from 'lucide-react';
import { useState } from 'react';

import { Icon } from '@/components/Icon';

// The Desmos graphing calculator for the Math modules. Desmos runs in a page
// of its own (calculator.html, src/calculator-frame.ts) shown here in a
// frame, so the app keeps its strict security policy while Desmos gets what
// it needs; that page loads Desmos and says why when it can't.
//
// Docked (a laptop): a pane beside the question, as in Bluebook, its width
// set by the pane's right edge (PracticeRun's CalcPane). Otherwise it floats,
// dragged by its bar and resized from its corner. Either way it stays mounted
// while hidden, and the frame keeps the student's work for the run
// (lib/practice/calculator-state.ts), so it survives closing the panel,
// leaving the test, a reload or a switch between docked and floating.

const MIN_W = 300;
const MIN_H = 320;
const MARGIN = 8;

type Box = { x: number; y: number; w: number; h: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** While dragging, frames must not swallow the pointer (styles.css). */
export function dragging(on: boolean) {
  document.documentElement.classList.toggle('mb-dragging', on);
}

export function Calculator({ visible, onClose, docked = false, runId }: { visible: boolean; onClose: () => void; docked?: boolean; runId: string }) {
  const [box, setBox] = useState<Box>(() => {
    const w = Math.min(380, window.innerWidth - MARGIN * 2);
    const h = Math.min(460, window.innerHeight - MARGIN * 2);
    return { x: window.innerWidth - w - 24, y: 72, w, h };
  });

  // Drag from the bar, resize from the corner: pointer events with capture,
  // so the gesture carries on outside the panel.
  const gesture = (kind: 'move' | 'resize') => (e: React.PointerEvent) => {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, box };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    dragging(true);
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      const b = start.box;
      if (kind === 'move') {
        setBox({ ...b, x: clamp(b.x + dx, MARGIN, window.innerWidth - b.w - MARGIN), y: clamp(b.y + dy, MARGIN, window.innerHeight - b.h - MARGIN) });
      } else {
        setBox({ ...b, w: clamp(b.w + dx, MIN_W, window.innerWidth - b.x - MARGIN), h: clamp(b.h + dy, MIN_H, window.innerHeight - b.y - MARGIN) });
      }
    };
    const onUp = () => {
      dragging(false);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  };

  return (
    <section
      aria-label="Calculator"
      hidden={!visible}
      className={docked ? 'flex h-full w-full flex-col overflow-hidden bg-paper' : 'fixed z-40 flex flex-col overflow-hidden rounded-panel border border-line bg-paper shadow-[0_16px_48px_-12px_rgba(0,0,0,0.45)]'}
      style={docked ? undefined : { left: box.x, top: box.y, width: box.w, height: box.h }}>
      <div onPointerDown={docked ? undefined : gesture('move')} className={`flex h-10 shrink-0 items-center justify-between border-b border-line bg-ink px-3 select-none ${docked ? '' : 'cursor-move touch-none'}`}>
        <span className="t-subhead font-semibold text-paper">Calculator</span>
        <button type="button" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="Close the calculator" className="flex size-7 items-center justify-center rounded-full text-paper active:bg-ink-2">
          <Icon as={X} size={16} strokeWidth={2.25} className="text-current" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <iframe src={`/calculator.html?run=${encodeURIComponent(runId)}`} title="Desmos graphing calculator" className="absolute inset-0 h-full w-full border-0 bg-paper" />
      </div>
      {!docked && (
        <div onPointerDown={gesture('resize')} aria-hidden="true" className="absolute bottom-0 right-0 flex size-7 cursor-nwse-resize touch-none items-end justify-end bg-paper p-1.5">
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none" className="text-ink-3">
            <path d="M12 2 2 12M12 7l-5 5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </div>
      )}
    </section>
  );
}
