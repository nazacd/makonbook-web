import { Check, Plus, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { describeError } from '@/api/errors';
import { PARK_REASONS, useSaveParked, type ParkedInput, type ParkedQuestion, type ParkReason } from '@/api/learning';
import { Spinner } from '@/components/Button';
import { uuid } from '@/lib/device-id';
import { useDialog } from '@/lib/dialog';
import { SUBJECT_LABEL, SUBJECT_SHORT, testName } from '@/lib/practice/run';
import type { Subject } from '@/lib/practice/types';

// "Ask later" (the API's parked questions): from the test screen a student
// puts a question aside in a folder, with what went wrong and a note, and
// carries on; Problem questions is where they come back to it, and the
// teacher's group page shows what is still waiting.

/** The folder every question goes to unless the student picks another. */
export const UNSORTED = 'Unsorted';
/** The API's limit on a folder's name. */
const FOLDER_MAX = 40;

/** One question of one test version: what parked questions and reports point at. */
export type QuestionRef = {
  test: string;
  /** The test's title, for showing ("DAY12" → "Day 12"). */
  title: string;
  version: number;
  subject: Subject;
  module: 1 | 2;
  position: number;
  question_id: string;
};

/** "Day 12 · Math · Module 1 · Q14" (short: "Day 12 · Math · M1 · Q14"). */
export function questionPlace(q: { title: string; subject: Subject; module: number; position: number }, short = false): string {
  return short
    ? `${testName(q.title)} · ${SUBJECT_SHORT[q.subject]} · M${q.module} · Q${q.position}`
    : `${testName(q.title)} · ${SUBJECT_LABEL[q.subject]} · Module ${q.module} · Q${q.position}`;
}

/** Whether a parked question is about this question (same test version, section, module and place). */
export function sameQuestion(p: ParkedQuestion, q: QuestionRef): boolean {
  return p.test === q.test && p.version === q.version && p.subject === q.subject && p.module === q.module && p.position === q.position;
}

export const sameFolder = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Names without repeats (ignoring case), the first spelling kept. */
function distinct(names: string[]): string[] {
  const out: string[] = [];
  for (const n of names) if (n.trim() && !out.some((o) => sameFolder(o, n))) out.push(n.trim());
  return out;
}

/** The student's folders: Unsorted first, then the others, most recently used first. */
export function foldersOf(items: ParkedQuestion[]): string[] {
  return distinct([UNSORTED, ...items.map((p) => p.folder)]);
}

/** What the API takes back for a parked question, changed by `change`. */
export function parkedInput(p: ParkedQuestion, change: Partial<ParkedInput> = {}): ParkedInput & { id: string } {
  const { id, test, version, subject, module, position, question_id, folder, reason, note, fix, status } = p;
  return { id, test, version, subject, module, position, question_id, folder, reason, note, fix, status, ...change };
}

/**
 * A dialog over the dimmed, blurred page (the same overlay as ui's Modal),
 * with its insides left to the caller: Ask later's compact card, focus mode's
 * header strip and footer bar. Escape or a press outside closes it.
 */
export function Dialog({ label, onClose, width, children, className = '' }: { label: string; onClose: () => void; width: number; children: ReactNode; className?: string }) {
  const dialog = useDialog<HTMLDivElement>(onClose);
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
  }, []);
  return (
    <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-[8px] sm:items-center" onClick={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`pop flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden rounded-panel bg-surface outline-none ${className}`}
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/** The round × in a dialog's corner. */
export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Close" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink hover:bg-line">
      <X size={16} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}

/** A choice chip (a folder or a reason): picked, it turns blue and shows a dot. */
export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors duration-150 ${
        on ? 'border-info/60 bg-info-tint font-bold text-ink' : 'border-line bg-surface font-medium text-ink-2 hover:border-accent/45 hover:text-ink'
      }`}>
      {on && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-info" />}
      {children}
    </button>
  );
}

type AskLaterProps = {
  question: QuestionRef;
  /** The parked question already there for it: the dialog edits that one. */
  existing?: ParkedQuestion;
  /** The student's folders (foldersOf). */
  folders: string[];
  onClose: () => void;
  /** Parked (or changed): the folder it went to. */
  onSaved: (folder: string) => void;
};

// The test screen's "Ask later": which folder, what happened (optional), a
// note (optional), then park it. Saved on the server at once, so it needs a
// connection; a failure says so here and nothing is lost from the test.
export function AskLater({ question, existing, folders, onClose, onSaved }: AskLaterProps) {
  const save = useSaveParked();
  // One id per opening: pressing Park again after a failure stores the same question once.
  const [id] = useState(() => existing?.id ?? uuid());
  const [folder, setFolder] = useState(existing?.folder ?? UNSORTED);
  const [added, setAdded] = useState<string[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [reason, setReason] = useState<ParkReason | null>(existing?.reason ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const chips = distinct([...folders, ...added, folder]);

  const commitName = () => {
    const typed = name.trim().slice(0, FOLDER_MAX);
    setNaming(false);
    setName('');
    if (!typed) return;
    const known = chips.find((c) => sameFolder(c, typed));
    if (known) setFolder(known);
    else {
      setAdded((a) => [...a, typed]);
      setFolder(typed);
    }
  };

  const park = () => {
    if (save.isPending) return;
    save.mutate(
      {
        id,
        test: question.test,
        version: question.version,
        subject: question.subject,
        module: question.module,
        position: question.position,
        question_id: question.question_id,
        folder,
        reason,
        note: note.trim(),
        fix: existing?.fix ?? '',
        // Asked about again: it waits again, even if it was sorted out before.
        status: 'waiting',
      },
      { onSuccess: () => onSaved(folder) },
    );
  };

  return (
    <Dialog label="Ask about this later" onClose={onClose} width={500} className="overflow-y-auto">
      <div className="flex flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="t-title3 text-ink">Ask about this later</h2>
            <p className="t-footnote mt-1 text-ink-3">{questionPlace(question)}</p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <p id="ask-where" className="t-footnote mt-5 font-semibold text-ink-2">
          Where does it go?
        </p>
        <div role="group" aria-labelledby="ask-where" className="mt-2 flex flex-wrap gap-2">
          {chips.map((c) => (
            <Chip key={c} on={sameFolder(c, folder)} onClick={() => setFolder(c)}>
              <span className="truncate">{c}</span>
            </Chip>
          ))}
          {naming ? (
            <input
              // Opened by the student's own press, so the focus follows it.
              autoFocus
              value={name}
              maxLength={FOLDER_MAX}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitName();
                } else if (e.key === 'Escape') {
                  // Only the new name goes; the dialog stays.
                  e.stopPropagation();
                  setNaming(false);
                  setName('');
                }
              }}
              aria-label="New folder"
              placeholder="Folder name"
              className="h-9 w-44 rounded-full border border-info/60 bg-surface px-3.5 text-[13px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-ink-3"
            />
          ) : (
            <button
              type="button"
              onClick={() => setNaming(true)}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-line bg-surface px-3.5 text-[13px] font-medium text-ink-2 transition-colors duration-150 hover:border-accent/45 hover:text-ink">
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              New
            </button>
          )}
        </div>

        <p id="ask-what" className="t-footnote mt-5 font-semibold text-ink-2">
          What happened? <span className="font-medium text-ink-3">optional</span>
        </p>
        <div role="group" aria-labelledby="ask-what" className="mt-2 flex flex-wrap gap-2">
          {PARK_REASONS.map((r) => (
            <Chip key={r.value} on={reason === r.value} onClick={() => setReason(reason === r.value ? null : r.value)}>
              {r.label}
            </Chip>
          ))}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={3}
          aria-label="Note"
          placeholder="Anything you want to remember about it (optional)"
          className="t-subhead mt-5 resize-none rounded-control border border-line bg-surface-2 px-3.5 py-2.5 text-ink outline-none placeholder:text-ink-3 focus:border-accent"
        />

        {save.isError && (
          <p role="alert" className="t-footnote mt-3 text-bad">
            {describeError(save.error)}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="t-subhead h-10 rounded-full px-3 font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
            Cancel
          </button>
          <button
            type="button"
            onClick={park}
            disabled={save.isPending}
            className="lift t-subhead inline-flex h-10 min-w-0 items-center gap-2 rounded-full bg-primary px-5 font-bold text-on-primary hover:bg-primary-hover disabled:opacity-60">
            {save.isPending ? <Spinner className="size-4" /> : <Check size={16} strokeWidth={2.4} aria-hidden="true" />}
            <span className="max-w-[240px] truncate">Park in {folder}</span>
          </button>
        </div>
      </div>
    </Dialog>
  );
}
