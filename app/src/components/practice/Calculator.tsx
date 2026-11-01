import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/Icon';
import { Spinner } from '@/components/Button';

// The Desmos graphing calculator in a panel that floats over the Math
// modules, dragged by its top bar and resized from its corner, as in
// Bluebook. The key comes from VITE_DESMOS_API_KEY (app/.env.example) and
// ends up in the bundle, like any Desmos key; it is restricted by domain.
// The calculator's state survives closing and reopening the panel: it stays
// mounted and is only hidden.

declare global {
  interface Window {
    Desmos?: { GraphingCalculator: (el: HTMLElement, options: Record<string, unknown>) => { resize: () => void; destroy: () => void } };
  }
}

const KEY = import.meta.env.VITE_DESMOS_API_KEY ?? '';
const SRC = 'https://www.desmos.com/api/v1.11/calculator.js?apiKey=';

let loading: Promise<void> | null = null;
function loadDesmos(): Promise<void> {
  if (window.Desmos) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC + encodeURIComponent(KEY);
    s.async = true;
    s.onload = () => (window.Desmos ? resolve() : reject(new Error('Desmos did not load')));
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error('Desmos failed to load'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

const MIN_W = 300;
const MIN_H = 320;
const MARGIN = 8;

type Box = { x: number; y: number; w: number; h: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

// Docked (a laptop): the calculator takes a pane beside the question, as in
// Bluebook; otherwise it floats, dragged by its bar and resized from its corner.
export function Calculator({ visible, onClose, docked = false }: { visible: boolean; onClose: () => void; docked?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const calc = useRef<{ resize: () => void; destroy: () => void } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed' | 'unconfigured'>(KEY ? 'loading' : 'unconfigured');
  const [box, setBox] = useState<Box>(() => {
    const w = Math.min(380, window.innerWidth - MARGIN * 2);
    const h = Math.min(460, window.innerHeight - MARGIN * 2);
    return { x: window.innerWidth - w - 24, y: 72, w, h };
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!KEY) return;
    let live = true;
    loadDesmos().then(
      () => {
        if (!live || !host.current || !window.Desmos) return;
        calc.current ??= window.Desmos.GraphingCalculator(host.current, { keypad: true, expressionsCollapsed: false, settingsMenu: false, zoomButtons: true, border: false });
        setState('ready');
      },
      () => live && setState('failed'),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  useEffect(() => () => calc.current?.destroy(), []);
  useEffect(() => {
    if (visible) calc.current?.resize();
  }, [visible, box, docked]);
  // A docked pane follows the window; tell the calculator when it moves.
  useEffect(() => {
    const el = host.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => calc.current?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Drag from the bar, resize from the corner: pointer events with capture,
  // so the gesture carries on outside the panel.
  const gesture = (kind: 'move' | 'resize') => (e: React.PointerEvent) => {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, box };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
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
      className={docked ? 'flex h-full w-full flex-col overflow-hidden border-r border-line bg-paper' : 'fixed z-40 flex flex-col overflow-hidden rounded-panel border border-line bg-paper shadow-[0_16px_48px_-12px_rgba(0,0,0,0.45)]'}
      style={docked ? undefined : { left: box.x, top: box.y, width: box.w, height: box.h }}>
      <div onPointerDown={docked ? undefined : gesture('move')} className={`flex h-10 shrink-0 items-center justify-between border-b border-line bg-ink px-3 select-none ${docked ? '' : 'cursor-move touch-none'}`}>
        <span className="t-subhead font-semibold text-paper">Calculator</span>
        <button type="button" onClick={onClose} aria-label="Close the calculator" className="flex size-7 items-center justify-center rounded-full text-paper active:bg-ink-2">
          <Icon as={X} size={16} strokeWidth={2.25} className="text-current" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={host} className="absolute inset-0" />
        {state !== 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper p-6 text-center">
            {state === 'loading' ? (
              <>
                <Spinner className="size-7 text-ink" />
                <p className="t-subhead text-ink-2">Loading the calculator…</p>
              </>
            ) : state === 'failed' ? (
              <>
                <p className="t-subhead text-ink-2">The calculator didn’t load. Check the connection.</p>
                <button type="button" onClick={() => {
                    setState('loading');
                    setAttempt((n) => n + 1);
                  }} className="t-headline h-11 rounded-control bg-primary px-5 text-on-primary">
                  Try again
                </button>
              </>
            ) : (
              <p className="t-subhead text-ink-2">The calculator isn’t set up on this site yet. Ask staff to set the Desmos key.</p>
            )}
          </div>
        )}
      </div>
      {!docked && (
      <div onPointerDown={gesture('resize')} aria-hidden="true" className="absolute bottom-0 right-0 flex size-7 cursor-nwse-resize touch-none items-end justify-end p-1.5">
        <svg width={14} height={14} viewBox="0 0 14 14" fill="none" className="text-ink-3">
          <path d="M12 2 2 12M12 7l-5 5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
      </div>
      )}
    </section>
  );
}
