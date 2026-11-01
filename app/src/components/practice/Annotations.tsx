import { Highlighter, StickyNote, Trash2, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { uuid } from '@/lib/device-id';

// Bluebook's "Highlights & Notes" for Reading and Writing: with the tool on,
// selecting text in the passage or the question offers three colours and a
// note. Highlights are kept as character offsets into the block's text, so
// they survive a reload, and painted with the CSS Custom Highlight API: the
// text itself is never changed. A highlight with a note shows a small marker
// after it; clicking a highlight (or its marker) edits or removes it.

export type HighlightColor = 'yellow' | 'blue' | 'pink';
export type TextHighlight = { id: string; start: number; end: number; color: HighlightColor; note: string; text: string };

export const COLORS: { color: HighlightColor; label: string; swatch: string }[] = [
  { color: 'yellow', label: 'Yellow', swatch: '#f6d860' },
  { color: 'blue', label: 'Blue', swatch: '#a8d8f0' },
  { color: 'pink', label: 'Pink', swatch: '#f6b8d0' },
];

export const supported = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

// The registry is page-wide and a name holds one Highlight, so every block
// on the page contributes its ranges and the three colours are painted from
// all of them together (styles.css: ::highlight(mb-yellow) and so on).
const blocks = new Map<string, Map<HighlightColor, Range[]>>();
function paint() {
  for (const c of COLORS) {
    const ranges = [...blocks.values()].flatMap((b) => b.get(c.color) ?? []);
    if (ranges.length) CSS.highlights.set(`mb-${c.color}`, new Highlight(...ranges));
    else CSS.highlights.delete(`mb-${c.color}`);
  }
}

/** The text nodes of a block, in order, with the offset each starts at. */
function textNodes(root: HTMLElement): { node: Text; start: number }[] {
  const out: { node: Text; start: number }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let at = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    out.push({ node: t, start: at });
    at += t.data.length;
  }
  return out;
}

function pointOffset(nodes: { node: Text; start: number }[], node: Node, offset: number): number | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const hit = nodes.find((n) => n.node === node);
    return hit ? hit.start + offset : null;
  }
  // A point between elements: the start of the first text node at or after it.
  const child = node.childNodes[offset];
  if (child) {
    const r = document.createRange();
    r.setStart(child, 0);
    for (const n of nodes) if (r.comparePoint(n.node, 0) >= 0) return n.start;
    return nodes.reduce((sum, n) => sum + n.node.data.length, 0);
  }
  return nodes.reduce((sum, n) => sum + n.node.data.length, 0);
}

function rangeFromOffsets(nodes: { node: Text; start: number }[], start: number, end: number): Range | null {
  const range = document.createRange();
  let ok = 0;
  for (const n of nodes) {
    const len = n.node.data.length;
    if (!(ok & 1) && start >= n.start && start <= n.start + len) {
      range.setStart(n.node, start - n.start);
      ok |= 1;
    }
    if (end >= n.start && end <= n.start + len) {
      range.setEnd(n.node, end - n.start);
      ok |= 2;
    }
  }
  return ok === 3 ? range : null;
}

type Toolbar = { x: number; y: number; start: number; end: number; text: string; existing?: TextHighlight };

export function Annotated({
  enabled,
  highlights,
  onChange,
  children,
}: {
  enabled: boolean;
  highlights: TextHighlight[];
  onChange: (next: TextHighlight[]) => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<Toolbar | null>(null);
  const [editing, setEditing] = useState<TextHighlight | null>(null);
  const [markers, setMarkers] = useState<{ id: string; x: number; y: number }[]>([]);
  const blockId = useId();

  // Paint the highlights (and place the note markers) whenever they change.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !supported) return;
    const nodes = textNodes(el);
    const byColor = new Map<HighlightColor, Range[]>();
    const marks: { id: string; x: number; y: number }[] = [];
    const base = el.getBoundingClientRect();
    for (const h of highlights) {
      const r = rangeFromOffsets(nodes, h.start, h.end);
      if (!r) continue;
      byColor.set(h.color, [...(byColor.get(h.color) ?? []), r]);
      if (h.note) {
        // The last drawn piece of the range; a range that ends at a node
        // boundary also reports an empty rect on the next line.
        const rects = [...r.getClientRects()].filter((x) => x.width > 0);
        const last = rects[rects.length - 1];
        if (last) marks.push({ id: h.id, x: last.right - base.left, y: last.top - base.top });
      }
    }
    const id = blockId;
    blocks.set(id, byColor);
    paint();
    setMarkers(marks);
    return () => {
      blocks.delete(id);
      paint();
    };
  }, [highlights, children, blockId]);

  // A selection inside the block, with the tool on: offer the colours.
  useEffect(() => {
    if (!enabled || !supported) return;
    const onUp = () => {
      const el = root.current;
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) return;
      const nodes = textNodes(el);
      const base = el.getBoundingClientRect();
      if (sel.isCollapsed) {
        // A click: on a highlight, edit it.
        const at = pointOffset(nodes, range.startContainer, range.startOffset);
        const hit = at == null ? undefined : highlights.find((h) => at >= h.start && at < h.end);
        if (!hit) {
          setToolbar(null);
          return;
        }
        const rect = range.getBoundingClientRect();
        setToolbar({ x: rect.left - base.left, y: rect.bottom - base.top, start: hit.start, end: hit.end, text: hit.text, existing: hit });
        return;
      }
      const start = pointOffset(nodes, range.startContainer, range.startOffset);
      const end = pointOffset(nodes, range.endContainer, range.endOffset);
      if (start == null || end == null || end <= start) return;
      const rect = range.getBoundingClientRect();
      setToolbar({ x: rect.left - base.left, y: rect.bottom - base.top, start, end, text: range.toString() });
    };
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
    return () => {
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchend', onUp);
    };
  }, [enabled, highlights]);

  const add = (color: HighlightColor, withNote: boolean) => {
    if (!toolbar) return;
    const existing = toolbar.existing;
    const h: TextHighlight = existing ? { ...existing, color } : { id: uuid(), start: toolbar.start, end: toolbar.end, color, note: '', text: toolbar.text };
    // Overlapping highlights are replaced by the new one.
    const rest = highlights.filter((x) => x.id !== h.id && (x.end <= h.start || x.start >= h.end));
    onChange([...rest, h].sort((a, b) => a.start - b.start));
    window.getSelection()?.removeAllRanges();
    setToolbar(null);
    if (withNote) setEditing(h);
  };
  const remove = (id: string) => {
    onChange(highlights.filter((x) => x.id !== id));
    setToolbar(null);
    setEditing(null);
  };

  return (
    <div ref={root} className="relative">
      {children}
      {markers.map((m) => {
        const h = highlights.find((x) => x.id === m.id);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => h && setEditing(h)}
            aria-label={`Note: ${h?.note ?? ''}`}
            className="absolute flex size-5 -translate-y-1 items-center justify-center rounded-full bg-accent text-on-accent shadow-sm"
            style={{ left: m.x + 2, top: m.y }}>
            <StickyNote size={11} strokeWidth={2.25} aria-hidden="true" />
          </button>
        );
      })}
      {toolbar && (
        <div role="toolbar" aria-label="Highlight" className="absolute z-20 flex items-center gap-1 rounded-full border border-line bg-paper p-1 shadow-lg" style={{ left: Math.max(0, toolbar.x), top: toolbar.y + 6 }}>
          {COLORS.map((c) => (
            <button key={c.color} type="button" onClick={() => add(c.color, false)} aria-label={`Highlight in ${c.label.toLowerCase()}`} className={`size-7 rounded-full border-2 ${toolbar.existing?.color === c.color ? 'border-ink' : 'border-transparent'}`} style={{ backgroundColor: c.swatch }} />
          ))}
          <button type="button" onClick={() => add(toolbar.existing?.color ?? 'yellow', true)} className="t-footnote flex h-7 items-center gap-1 rounded-full px-2 font-semibold text-ink active:bg-paper-2">
            <StickyNote size={14} strokeWidth={2} aria-hidden="true" />
            {toolbar.existing?.note ? 'Edit note' : 'Note'}
          </button>
          {toolbar.existing && (
            <button type="button" onClick={() => remove(toolbar.existing!.id)} aria-label="Remove the highlight" className="flex size-7 items-center justify-center rounded-full text-bad active:bg-paper-2">
              <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={() => setToolbar(null)} aria-label="Close" className="flex size-7 items-center justify-center rounded-full text-ink-3 active:bg-paper-2">
            <X size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}
      {editing && (
        <NoteEditor
          highlight={editing}
          onSave={(note) => {
            onChange(highlights.map((x) => (x.id === editing.id ? { ...x, note } : x)));
            setEditing(null);
          }}
          onRemove={() => remove(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function NoteEditor({ highlight, onSave, onRemove, onClose }: { highlight: TextHighlight; onSave: (note: string) => void; onRemove: () => void; onClose: () => void }) {
  const [note, setNote] = useState(highlight.note);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label="Note" className="flex w-full max-w-md flex-col gap-3 rounded-panel bg-paper p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="t-footnote line-clamp-3 border-l-4 pl-3 text-ink-2" style={{ borderColor: COLORS.find((c) => c.color === highlight.color)?.swatch }}>
          {highlight.text}
        </p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} autoFocus rows={4} placeholder="Your note" aria-label="Note" className="t-body w-full resize-none rounded-control border border-line-strong bg-paper p-3 text-ink outline-none placeholder:text-ink-3 focus:border-accent" />
        <div className="flex items-center gap-2">
          <button type="button" onClick={onRemove} className="t-subhead flex h-10 items-center gap-1.5 rounded-full px-3 font-medium text-bad active:bg-paper-2">
            <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
            Remove
          </button>
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="t-subhead h-10 rounded-full border border-accent px-4 font-semibold text-accent">
            Cancel
          </button>
          <button type="button" onClick={() => onSave(note.trim())} className="t-subhead h-10 rounded-full bg-accent px-4 font-semibold text-on-accent">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/** The header's toggle, like Bluebook's: an icon over its label. */
export function HighlightsToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      disabled={!supported}
      title={supported ? undefined : 'Needs a newer browser'}
      className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-chip px-2 disabled:opacity-40 ${on ? 'bg-accent-tint text-accent' : 'text-ink active:bg-paper-2'}`}>
      <Highlighter size={20} strokeWidth={1.75} aria-hidden="true" className="text-current" />
      <span className="t-caption hidden whitespace-nowrap font-medium sm:block">Highlights & Notes</span>
      <span className="sr-only sm:hidden">Highlights & Notes</span>
    </button>
  );
}
