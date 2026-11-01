import { memo, useEffect, useState, type ReactNode } from 'react';

import { useDialog } from '@/lib/dialog';
import { texToSvg } from '@/lib/mathjax';
import type { PackageImage } from '@/lib/practice/types';

// Draws the question content format (the API's spec 9.2; the phone's
// RichContent): paragraphs split by a blank line, \( \) and \[ \] math,
// *italic*, **bold**, <u>underline</u>, "- " lists, pipe tables,
// ![alt](r2:key) images. Only formulas go through MathJax; text is never
// parsed as TeX, so "$29" stays a price.

const INLINE =
  /(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|!\[[^\]]*\]\([^)\s]*\)|\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|<u>[\s\S]*?<\/u>|\*(?![\s*])(?:[^*]|\*\*[^*]+?\*\*)*?\*(?!\*)|\n)/;

type Style = { bold?: boolean; italic?: boolean; underline?: boolean };

type Atom =
  | { kind: 'word'; text: string; style: Style }
  | { kind: 'math'; tex: string; display: boolean }
  | { kind: 'image'; key: string; alt: string }
  | { kind: 'break' };

function atoms(src: string, style: Style = {}): Atom[] {
  const out: Atom[] = [];
  src.split(INLINE).forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 0) out.push({ kind: 'word', text: part, style });
    else if (part === '\n') out.push({ kind: 'break' });
    else if (part.startsWith('\\(')) out.push({ kind: 'math', tex: part.slice(2, -2), display: false });
    else if (part.startsWith('\\[')) out.push({ kind: 'math', tex: part.slice(2, -2), display: true });
    else if (part.startsWith('![')) {
      const m = /^!\[([^\]]*)\]\(([^)\s]*)\)$/.exec(part);
      if (m && m[2]!.startsWith('r2:')) out.push({ kind: 'image', key: m[2]!.slice(3), alt: m[1]! });
      else if (m) out.push({ kind: 'word', text: `[${m[1]}] `, style });
    } else if (part.startsWith('***')) out.push(...atoms(part.slice(3, -3), { ...style, bold: true, italic: true }));
    else if (part.startsWith('**')) out.push(...atoms(part.slice(2, -2), { ...style, bold: true }));
    else if (part.startsWith('<u>')) out.push(...atoms(part.slice(3, -4), { ...style, underline: true }));
    else out.push(...atoms(part.slice(1, -1), { ...style, italic: true }));
  });
  return out;
}

export const Formula = memo(function Formula({ tex, display }: { tex: string; display: boolean }) {
  const [svg, setSvg] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    texToSvg(tex, display).then(
      (s) => live && setSvg(s),
      () => live && setSvg(null),
    );
    return () => {
      live = false;
    };
  }, [tex, display]);
  // Until it is drawn (or when it can't be), the TeX itself, so nothing is lost.
  if (!svg) return <code className={`font-mono text-[0.9em] ${svg === undefined ? 'opacity-60' : ''}`}>{tex}</code>;
  return <span className={display ? 'mjx-display' : 'mjx-inline'} role="math" aria-label={tex} dangerouslySetInnerHTML={{ __html: svg }} />;
});

export type ImageLinks = Record<string, string>;

type Ctx = { images: Record<string, PackageImage>; links: ImageLinks; displayMath: boolean };

function Figure({ imageKey, alt, ctx }: { imageKey: string; alt: string; ctx: Ctx }) {
  const [open, setOpen] = useState(false);
  const img = ctx.images[imageKey];
  const src = img ? ctx.links[img.file] : undefined;
  if (!img || !src) return <span className="t-footnote text-ink-2">[{alt || 'image'}]</span>;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${alt || 'Figure'}. Opens the image full size`}
        className="block w-full max-w-[560px] overflow-hidden rounded-xl bg-white"
        style={{ aspectRatio: `${img.width} / ${img.height}`, maxHeight: 420 }}>
        <img src={src} alt={alt} width={img.width} height={img.height} className="h-full w-full object-contain" />
      </button>
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const dialog = useDialog<HTMLDivElement>(onClose);
  return (
    <div ref={dialog} tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 outline-none" onClick={onClose} role="dialog" aria-modal="true" aria-label={alt || 'Figure'}>
      <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg bg-white" />
      <button type="button" className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-black" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

function Inline({ src, ctx }: { src: string; ctx: Ctx }) {
  const out: ReactNode[] = [];
  atoms(src).forEach((a, i) => {
    if (a.kind === 'word') {
      let node: ReactNode = a.text;
      if (a.style.bold) node = <strong>{node}</strong>;
      if (a.style.italic) node = <em>{node}</em>;
      if (a.style.underline) node = <u>{node}</u>;
      out.push(<span key={i}>{node}</span>);
    } else if (a.kind === 'math' && !a.display) out.push(<Formula key={i} tex={a.tex} display={ctx.displayMath} />);
    else if (a.kind === 'math') {
      out.push(
        <span key={i} className="my-1.5 block text-center">
          <Formula tex={a.tex} display />
        </span>,
      );
    } else if (a.kind === 'image') {
      out.push(
        <span key={i} className="my-1.5 block">
          <Figure imageKey={a.key} alt={a.alt} ctx={ctx} />
        </span>,
      );
    } else out.push(<br key={i} />);
  });
  return <>{out}</>;
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

type RichContentProps = {
  text: string | null | undefined;
  images: Record<string, PackageImage>;
  /** Image file → link (from the package download). */
  links: ImageLinks;
  className?: string;
  /** Inline math at full size (answer choices). */
  displayMath?: boolean;
};

export const RichContent = memo(function RichContent({ text, images, links, className = 'rich', displayMath = false }: RichContentProps) {
  if (!text) return null;
  const ctx: Ctx = { images, links, displayMath };
  const blocks = text.trim().split(/\n[ \t]*\n/);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        if (block.trim() === '') return <div key={i} className="h-4" />;
        const lines = block.split('\n');
        if (lines.length > 1 && lines.every((l) => l.trim().startsWith('|'))) {
          const rows = lines.filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l)).map(cells);
          return (
            <table key={i} className="rich-table">
              <tbody>
                {rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((c, j) =>
                      r === 0 ? (
                        <th key={j}>
                          <Inline src={c} ctx={ctx} />
                        </th>
                      ) : (
                        <td key={j}>
                          <Inline src={c} ctx={ctx} />
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        if (lines.every((l) => l.startsWith('- '))) {
          return (
            <ul key={i} className="list-disc pl-5">
              {lines.map((l, j) => (
                <li key={j}>
                  <Inline src={l.slice(2)} ctx={ctx} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            <Inline src={block} ctx={ctx} />
          </p>
        );
      })}
    </div>
  );
});
