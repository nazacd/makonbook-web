import { ArrowLeft, ChevronLeft, ChevronRight, Download, Maximize, Minimize, Minus, Plus } from 'lucide-react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode, type Ref } from 'react';
import { Link, useParams } from 'react-router';

import { describeError } from '@/api/errors';
import { downloadBook, useBookFile, useLibrary, useSaveProgress, type Book } from '@/api/library';
import { Spinner } from '@/components/Button';
import { BookCover } from '@/components/library/BookCover';
import { useTitle } from '@/lib/title';

// "/library/:id": the reader, full screen. The book's PDF is drawn page by
// page with pdf.js (loaded only here): an open book of two pages on wide
// screens (the cover alone first), one page on phones. Turn with the arrows,
// the keys, a swipe or a click at either side; zoom; go full screen. The page
// you stop at is remembered on the server (and counts you as a reader).

GlobalWorkerOptions.workerSrc = workerUrl;

const ZOOMS = [1, 1.25, 1.5, 2, 3];

export function LibraryReader() {
  const { id = '' } = useParams();
  const library = useLibrary();
  const book = library.data?.find((b) => b.id === id) ?? null;
  const file = useBookFile(id, !!book);
  useTitle(book?.title ?? 'Library');

  const error = library.error ?? file.error;
  if (error || (library.data && !book)) {
    return (
      <Shell>
        <div className="m-auto max-w-sm px-6 text-center">
          <h1 className="text-[22px] font-bold">{error ? 'Couldn’t open the book' : 'No such book'}</h1>
          <p className="mt-2 text-[15px] text-white/70">{error ? describeError(error) : 'It may have left the shelf.'}</p>
          <Link to="/library" className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14.5px] font-bold text-[#1b1230]">
            <ArrowLeft size={16} aria-hidden="true" /> Back to the Library
          </Link>
        </div>
      </Shell>
    );
  }
  if (!book || !file.data) {
    return (
      <Shell>
        <div className="m-auto flex flex-col items-center gap-5 text-center">
          {book && <BookCover book={book} width={150} flat />}
          <p className="flex items-center gap-2.5 text-[15px] font-semibold text-white/80">
            <Spinner className="size-5" /> Opening{book ? ` ${book.title}` : ''}…
          </p>
        </div>
      </Shell>
    );
  }
  return <Opened key={book.id} book={book} file={file.data} />;
}

function Shell({ children, ref }: { children: ReactNode; ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="flex h-dvh flex-col overflow-hidden text-white" style={{ background: 'radial-gradient(120% 80% at 50% 0%, #2a1c4a, #120c1f 70%)' }}>
      {children}
    </div>
  );
}

/** The pages shown together when `page` is among them: one, or an open book's two (the cover alone). */
function shownAt(page: number, total: number, spread: boolean): number[] {
  if (!spread || page <= 1) return [Math.max(1, Math.min(total, page))];
  const left = page % 2 === 0 ? page : page - 1;
  return left + 1 <= total ? [left, left + 1] : [left];
}

function Opened({ book, file }: { book: Book; file: ArrayBuffer }) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const save = useSaveProgress(book.id);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [ratio, setRatio] = useState(1 / Math.SQRT2); // a page's width / height (A4 until the first page says)
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [page, setPage] = useState(() => Math.min(book.pages, Math.max(1, book.progress?.page ?? 1)));
  const [turn, setTurn] = useState<'next' | 'prev'>('next');
  const [zoom, setZoom] = useState(0);
  const [full, setFull] = useState(false);
  const [saving, setSaving] = useState(false);

  // Open the PDF (a copy: pdf.js hands the bytes it is given to its worker).
  useEffect(() => {
    const task = getDocument({ data: new Uint8Array(file).slice(), useWasm: false });
    let gone = false;
    task.promise.then(
      async (d) => {
        if (gone) return; // the cleanup below destroys the task, and the document with it
        const first = await d.getPage(1);
        const v = first.getViewport({ scale: 1 });
        if (gone) return;
        setRatio(v.width / v.height);
        setDoc(d);
      },
      () => !gone && setFailed(true),
    );
    return () => {
      gone = true;
      void task.destroy();
    };
  }, [file]);

  // The room there is for pages.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const on = () => setFull(document.fullscreenElement != null);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  const total = doc?.numPages ?? book.pages;
  const spread = box.w >= 900 && box.w > box.h * 1.15;
  const shown = shownAt(page, total, spread);
  const first = shown[0]!;
  const last = shown[shown.length - 1]!;

  // Each page as large as fits: the height, or the width shared by the pages shown.
  const pad = box.w < 640 ? 12 : 28;
  const fitH = Math.max(120, box.h - pad * 2);
  const fitW = Math.max(120, (box.w - pad * 2) / (spread ? 2 : 1));
  const pageW = Math.floor(Math.min(fitW, fitH * ratio) * ZOOMS[zoom]!);
  const pageH = Math.floor(pageW / ratio);

  const go = useCallback(
    (to: number, dir?: 'next' | 'prev') => {
      const target = Math.max(1, Math.min(total, to));
      setTurn(dir ?? (target >= page ? 'next' : 'prev'));
      setPage(target);
    },
    [page, total],
  );
  const next = useCallback(() => last < total && go(last + 1, 'next'), [go, last, total]);
  const prev = useCallback(() => first > 1 && go(first - 1, 'prev'), [first, go]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const act: Record<string, () => void> = {
        ArrowRight: next,
        PageDown: next,
        ' ': next,
        ArrowLeft: prev,
        PageUp: prev,
        Home: () => go(1),
        End: () => go(total),
        '+': () => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1)),
        '=': () => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1)),
        '-': () => setZoom((z) => Math.max(0, z - 1)),
      };
      const f = act[e.key];
      if (!f) return;
      e.preventDefault();
      f();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, next, prev, total]);

  // Remember the furthest page in view, a moment after the turning stops.
  const stored = useRef<number | null>(null);
  const { mutate } = save;
  useEffect(() => {
    if (!doc || stored.current === last) return;
    const t = setTimeout(
      () => {
        stored.current = last;
        mutate(last);
      },
      stored.current == null ? 0 : 700,
    );
    return () => clearTimeout(t);
  }, [doc, last, mutate]);

  // A swipe turns the page (when not zoomed in: then a drag scrolls).
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const down = (e: PointerEvent) => {
    swipe.current = zoom === 0 ? { x: e.clientX, y: e.clientY } : null;
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) return void (dx < 0 ? next() : prev());
    // A click at either side turns too.
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      const r = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      if (x < 0.28) prev();
      else if (x > 0.72) next();
    }
  };

  async function download() {
    setSaving(true);
    try {
      await downloadBook(book, file);
    } finally {
      setSaving(false);
    }
  }
  const fullscreen = () => void (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen?.());

  const round = 'flex size-10 shrink-0 items-center justify-center rounded-full text-white/85 hover:bg-white/10 disabled:opacity-35 disabled:hover:bg-transparent';
  return (
    <Shell ref={root}>
      <header className="flex h-14 shrink-0 items-center gap-2 px-2 sm:px-4">
        <Link to="/library" aria-label="Back to the Library" className={round}>
          <ArrowLeft size={19} aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-bold sm:text-[16px]">{book.title}</h1>
        <p className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold tabular" aria-live="polite">
          {shown.join('–')} <span className="text-white/55">of {total}</span>
        </p>
        <button type="button" onClick={() => void download()} disabled={saving} aria-label="Download the PDF" title="Download the PDF" className={round}>
          <Download size={18} className={saving ? 'animate-pulse' : ''} aria-hidden="true" />
        </button>
        <button type="button" onClick={fullscreen} aria-label={full ? 'Leave full screen' : 'Full screen'} title={full ? 'Leave full screen' : 'Full screen'} className={`${round} hidden sm:flex`}>
          {full ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
        </button>
      </header>

      <div ref={stage} onPointerDown={down} onPointerUp={up} className={`relative min-h-0 flex-1 ${zoom ? 'overflow-auto' : 'overflow-hidden'}`} style={{ touchAction: zoom ? 'auto' : 'pan-y' }}>
        {failed ? (
          <p className="absolute inset-0 m-auto h-fit text-center text-[15px] text-white/75">This file couldn’t be opened here. Download it to read it.</p>
        ) : !doc || !box.w ? (
          <Spinner className="absolute inset-0 m-auto size-7 text-white/70" />
        ) : (
          <div className="flex min-h-full min-w-full items-center justify-center" style={{ padding: pad, width: zoom ? 'max-content' : undefined }}>
            <div key={first} className={`flex shadow-[0_30px_70px_-20px_rgba(0,0,0,0.75)] ${turn === 'next' ? 'page-next' : 'page-prev'}`}>
              {shown.map((n, i) => (
                <PageCanvas key={n} doc={doc} n={n} width={pageW} height={pageH} side={shown.length === 2 ? (i === 0 ? 'left' : 'right') : 'single'} />
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center gap-1 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 sm:gap-2 sm:px-4">
        <button type="button" onClick={prev} disabled={first <= 1} aria-label="Previous page" className={round}>
          <ChevronLeft size={21} aria-hidden="true" />
        </button>
        <input
          type="range"
          min={1}
          max={total}
          value={first}
          onChange={(e) => go(Number(e.target.value))}
          aria-label="Page"
          className="h-10 min-w-0 flex-1 accent-[#b69cff]"
        />
        <button type="button" onClick={next} disabled={last >= total} aria-label="Next page" className={round}>
          <ChevronRight size={21} aria-hidden="true" />
        </button>
        <span className="mx-1 hidden h-6 w-px bg-white/15 sm:block" aria-hidden="true" />
        <button type="button" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label="Zoom out" className={round}>
          <Minus size={18} aria-hidden="true" />
        </button>
        <span className="w-11 text-center text-[12.5px] font-semibold tabular text-white/70">{Math.round(ZOOMS[zoom]! * 100)}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1} aria-label="Zoom in" className={round}>
          <Plus size={18} aria-hidden="true" />
        </button>
      </footer>
    </Shell>
  );
}

/** One page, drawn at the screen's own sharpness. */
function PageCanvas({ doc, n, width, height, side }: { doc: PDFDocumentProxy; n: number; width: number; height: number; side: 'left' | 'right' | 'single' }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    let task: RenderTask | null = null;
    let gone = false;
    void doc.getPage(n).then((page) => {
      const el = canvas.current;
      if (gone || !el) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const viewport = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * dpr });
      el.width = Math.floor(viewport.width);
      el.height = Math.floor(viewport.height);
      task = page.render({ canvas: el, viewport });
      task.promise.then(
        () => !gone && setDrawn(true),
        () => undefined, // cancelled: another size or page took over
      );
    });
    return () => {
      gone = true;
      task?.cancel();
    };
  }, [doc, n, width]);

  return (
    <div className="relative bg-white" style={{ width, height }}>
      <canvas ref={canvas} role="img" aria-label={`Page ${n}`} className={`block size-full transition-opacity duration-200 ${drawn ? 'opacity-100' : 'opacity-0'}`} />
      {/* The gutter of an open book. */}
      {side !== 'single' && <span className="pointer-events-none absolute inset-y-0 w-10" style={side === 'left' ? { right: 0, background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.13))' } : { left: 0, background: 'linear-gradient(270deg, transparent, rgba(0,0,0,0.13))' }} />}
    </div>
  );
}
