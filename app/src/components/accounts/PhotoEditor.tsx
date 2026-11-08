import { ImagePlus, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { useRemovePhoto, useSetPhoto } from '@/api/accounts';
import { describeError } from '@/api/errors';
import type { Profile } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { Notice } from '@/components/Notice';
import { Action, Modal } from '@/components/ui';

// Your profile photo: choose a picture, move and zoom it inside the circle,
// save. What's inside the square is sent as a 512×512 JPEG (the circle is
// how it's shown). Or remove the photo to go back to the illustrated avatar.

const STAGE = 280; // the square on screen, px
const OUT = 512; // the saved picture, px
const MAX_ZOOM = 4;
const MAX_FILE = 15 * 1024 * 1024;

type Picture = { img: HTMLImageElement; url: string };
type View = { zoom: number; x: number; y: number }; // x, y: the picture's top-left in the square, px

export function PhotoEditor({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const save = useSetPhoto();
  const remove = useRemovePhoto();
  const input = useRef<HTMLInputElement>(null);
  const [pic, setPic] = useState<Picture | null>(null);
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [problem, setProblem] = useState<string | null>(null);
  const drag = useRef<{ id: number; px: number; py: number; x: number; y: number } | null>(null);
  const busy = save.isPending || remove.isPending;

  // The chosen picture's object URL goes when it's replaced or the editor closes.
  useEffect(() => () => void (pic && URL.revokeObjectURL(pic.url)), [pic]);

  const base = pic ? STAGE / Math.min(pic.img.naturalWidth, pic.img.naturalHeight) : 1; // zoom 1 fills the square
  const scale = base * view.zoom;
  const w = pic ? pic.img.naturalWidth * scale : STAGE;
  const h = pic ? pic.img.naturalHeight * scale : STAGE;
  // The picture always covers the square.
  const clamp = (v: View, ww = w, hh = h): View => ({ zoom: v.zoom, x: Math.min(0, Math.max(STAGE - ww, v.x)), y: Math.min(0, Math.max(STAGE - hh, v.y)) });

  function choose(file: File | undefined) {
    setProblem(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) return setProblem('Choose a picture (JPEG, PNG or WebP).');
    if (file.size > MAX_FILE) return setProblem('That picture is too big. Choose one under 15 MB.');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const b = STAGE / Math.min(img.naturalWidth, img.naturalHeight);
      setPic({ img, url });
      setView({ zoom: 1, x: (STAGE - img.naturalWidth * b) / 2, y: (STAGE - img.naturalHeight * b) / 2 });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setProblem('This picture can’t be opened here. Try a JPEG or PNG.');
    };
    img.src = url;
  }

  /** Zoom around the square's centre. */
  function zoomTo(zoom: number) {
    if (!pic) return;
    const z = Math.min(MAX_ZOOM, Math.max(1, zoom));
    const cx = (STAGE / 2 - view.x) / scale; // the centre, in the picture's own pixels
    const cy = (STAGE / 2 - view.y) / scale;
    const s = base * z;
    setView(clamp({ zoom: z, x: STAGE / 2 - cx * s, y: STAGE / 2 - cy * s }, pic.img.naturalWidth * s, pic.img.naturalHeight * s));
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    if (!pic) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, px: e.clientX, py: e.clientY, x: view.x, y: view.y };
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setView(clamp({ zoom: view.zoom, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }));
  }
  function key(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      setView(clamp({ zoom: view.zoom, x: view.x + moves[e.key]![0], y: view.y + moves[e.key]![1] }));
    } else if (e.key === '+' || e.key === '=') zoomTo(view.zoom + 0.25);
    else if (e.key === '-') zoomTo(view.zoom - 0.25);
  }

  function submit() {
    if (!pic || busy) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return setProblem('This browser can’t prepare the picture.');
    ctx.fillStyle = '#ffffff'; // a transparent PNG gets a white background, not black
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pic.img, -view.x / scale, -view.y / scale, STAGE / scale, STAGE / scale, 0, 0, OUT, OUT);
    canvas.toBlob(
      (blob) => {
        if (!blob) return setProblem('This browser can’t prepare the picture.');
        save.mutate(blob, { onSuccess: onClose, onError: (err) => setProblem(describeError(err)) });
      },
      'image/jpeg',
      0.9,
    );
  }

  return (
    <Modal
      title="Profile photo"
      subtitle={pic ? 'Drag to move it, zoom to fit. The circle is what people see.' : 'A clear photo of your face helps teachers know you.'}
      onClose={onClose}
      width={440}
      footer={
        <>
          <Action variant="outline" onClick={onClose}>
            Cancel
          </Action>
          {pic && (
            <Action onClick={submit} disabled={busy}>
              {save.isPending ? 'Saving…' : 'Save photo'}
            </Action>
          )}
        </>
      }>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
      <div className="flex flex-col items-center gap-4">
        {pic ? (
          <>
            <div
              role="img"
              aria-label="Your photo. Drag, or use the arrow keys, to move it; plus and minus to zoom."
              tabIndex={0}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onWheel={(e) => zoomTo(view.zoom - e.deltaY / 400)}
              onKeyDown={key}
              className="relative cursor-grab touch-none select-none overflow-hidden rounded-card bg-surface-2 outline-offset-2 active:cursor-grabbing"
              style={{ width: STAGE, height: STAGE }}>
              <img src={pic.url} alt="" draggable={false} className="pointer-events-none absolute left-0 top-0 max-w-none" style={{ width: w, height: h, transform: `translate(${view.x}px, ${view.y}px)` }} />
              {/* Outside the circle is dimmed: that part shows only in square places. */}
              <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_200px_rgba(0,0,0,0.45)]" />
              <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/90" />
            </div>
            <div className="flex w-full max-w-[280px] items-center gap-3">
              <button type="button" onClick={() => zoomTo(view.zoom - 0.25)} aria-label="Zoom out" className="flex size-9 items-center justify-center rounded-chip text-ink-2 hover:bg-surface-2">
                <ZoomOut size={18} />
              </button>
              <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={view.zoom} onChange={(e) => zoomTo(Number(e.target.value))} aria-label="Zoom" className="flex-1 accent-[var(--color-primary)]" />
              <button type="button" onClick={() => zoomTo(view.zoom + 0.25)} aria-label="Zoom in" className="flex size-9 items-center justify-center rounded-chip text-ink-2 hover:bg-surface-2">
                <ZoomIn size={18} />
              </button>
            </div>
            <button type="button" onClick={() => input.current?.click()} className="t-subhead font-bold text-accent hover:underline">
              Choose another picture
            </button>
          </>
        ) : (
          <>
            <Avatar kind={profile.kind} firstName={profile.first_name} lastName={profile.last_name} id={profile.id} size={132} photo={profile.photo_url} />
            <div className="flex w-full flex-col gap-2.5">
              <button type="button" onClick={() => input.current?.click()} className="lift flex h-11 items-center justify-center gap-2 rounded-control bg-primary text-[15px] font-bold text-on-primary hover:bg-primary-hover">
                <ImagePlus size={18} aria-hidden="true" /> {profile.photo_url ? 'Choose a new photo' : 'Choose a photo'}
              </button>
              {profile.photo_url && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove.mutate(undefined, { onSuccess: onClose, onError: (err) => setProblem(describeError(err)) })}
                  className="flex h-11 items-center justify-center gap-2 rounded-control border border-line text-[15px] font-bold text-bad hover:bg-bad-tint disabled:opacity-60">
                  <Trash2 size={17} aria-hidden="true" /> {remove.isPending ? 'Removing…' : 'Remove photo'}
                </button>
              )}
            </div>
          </>
        )}
        {problem && (
          <div className="w-full">
            <Notice tone="error" message={problem} />
          </div>
        )}
      </div>
    </Modal>
  );
}
