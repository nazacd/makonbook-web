import { CornerDownLeft, FileText, Search } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router';

import { useDialog } from '@/lib/dialog';

// Ctrl K: jump to a page by typing part of its name.
export type Page = { to: string; label: string; icon: ComponentType<{ size?: number; className?: string }> };

export function CommandSearch({ pages, onClose }: { pages: Page[]; onClose: () => void }) {
  const dialog = useDialog<HTMLDivElement>(onClose);
  const input = useRef<HTMLInputElement>(null);
  // After useDialog has focused the dialog: typing goes straight into the box.
  useEffect(() => {
    input.current?.focus();
  }, []);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const found = pages.filter((p) => p.label.toLowerCase().includes(q.trim().toLowerCase()));
  const open = (p: Page | undefined) => {
    if (!p) return;
    onClose();
    void navigate(p.to);
  };
  return (
    <div className="fade fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 pt-[12vh] backdrop-blur-[8px]" onClick={onClose}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Search" className="pop w-full max-w-[600px] overflow-hidden rounded-panel bg-surface outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="text-ink-2" aria-hidden="true" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setAt(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setAt((i) => Math.min(found.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setAt((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                open(found[at]);
              }
            }}
            placeholder="Search pages…"
            aria-label="Search pages"
            className="h-14 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
          />
          <kbd className="rounded-[6px] border border-line-strong px-1.5 text-[10px] font-semibold text-ink-2">Esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          <p className="t-micro px-2.5 pb-1.5 pt-2 text-ink-3">{q ? 'Pages' : 'Jump to'}</p>
          {found.length === 0 ? (
            <p className="t-subhead px-2.5 py-6 text-center text-ink-2">Nothing matches “{q}”.</p>
          ) : (
            <ul role="listbox" aria-label="Pages">
              {found.map((p, i) => (
                <li key={p.to} role="option" aria-selected={i === at}>
                  <button
                    type="button"
                    onMouseEnter={() => setAt(i)}
                    onClick={() => open(p)}
                    className={`flex h-11 w-full items-center gap-3 rounded-control px-2.5 text-left text-[15px] ${i === at ? 'bg-accent-tint text-accent' : 'text-ink'}`}>
                    <p.icon size={17} aria-hidden="true" />
                    <span className="flex-1">{p.label}</span>
                    <span className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-2">Page</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[12px] text-ink-2">
          <span>↑↓ to move</span>
          <span className="flex items-center gap-1">
            <CornerDownLeft size={12} aria-hidden="true" /> to open
          </span>
          <span>Esc to close</span>
          <FileText size={12} className="ml-auto opacity-0" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
