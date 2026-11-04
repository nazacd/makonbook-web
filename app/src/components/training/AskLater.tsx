import { Check, CircleHelp, Hand, Plus } from 'lucide-react';
import { useState } from 'react';

import { describeError } from '@/api/errors';
import { PARK_REASONS, useParked, useSaveParked, type ParkReason } from '@/api/learning';
import { Action, Modal } from '@/components/ui';
import { uuid } from '@/lib/device-id';
import type { Answered } from '@/lib/practice/mistakes';
import { testName } from '@/lib/practice/run';

import { SUBJECT_NAME } from './DomainCard';

// "Ask later" on a drill question (the spec's Ask later modal): park it in a
// folder, say what happened, add a note. Once parked the pill reads "Asked";
// pressing it again edits the same parked question.

const UNSORTED = 'Unsorted';

export function AskLater({ item }: { item: Answered }) {
  const parked = useParked();
  const mine = parked.data?.find((p) => p.question_id === item.id);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-pressed={!!mine}
        className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors duration-150 ${
          mine ? 'border-accent bg-accent-tint text-accent' : 'border-line bg-surface text-ink-2 hover:border-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] hover:text-ink'
        }`}>
        {mine ? <Hand size={14} strokeWidth={2} aria-hidden="true" /> : <CircleHelp size={14} strokeWidth={2} aria-hidden="true" />}
        {mine ? 'Asked' : 'Ask later'}
      </button>
      {open && <AskLaterDialog item={item} folders={[...new Set((parked.data ?? []).map((p) => p.folder))]} current={mine} onClose={() => setOpen(false)} />}
    </>
  );
}

type Current = NonNullable<ReturnType<typeof useParked>['data']>[number] | undefined;

function AskLaterDialog({ item, folders, current, onClose }: { item: Answered; folders: string[]; current: Current; onClose: () => void }) {
  const save = useSaveParked();
  const [folder, setFolder] = useState(current?.folder ?? UNSORTED);
  const [adding, setAdding] = useState(false);
  const [newFolder, setNewFolder] = useState('');
  const [reason, setReason] = useState<ParkReason | null>(current?.reason ?? null);
  const [note, setNote] = useState(current?.note ?? '');
  const chips = [UNSORTED, ...folders.filter((f) => f !== UNSORTED)];
  if (!chips.includes(folder)) chips.push(folder);
  const target = (adding ? newFolder.trim() : folder).slice(0, 40) || UNSORTED;

  const park = () =>
    save.mutate(
      {
        id: current?.id ?? uuid(),
        test: item.code,
        version: item.version,
        subject: item.subject,
        module: item.module as 1 | 2,
        position: item.position,
        question_id: item.id,
        folder: target,
        reason,
        note: note.trim(),
        fix: current?.fix ?? '',
        status: current?.status ?? 'waiting',
      },
      { onSuccess: onClose },
    );

  const chip = (on: boolean) =>
    `inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px] font-medium transition-colors duration-150 ${on ? 'border-accent bg-accent-tint text-accent' : 'border-line-strong text-ink-2 hover:text-ink'}`;

  return (
    <Modal
      title="Ask about this later"
      subtitle={`${testName(item.title)} · ${SUBJECT_NAME[item.subject]} · Q${item.position}`}
      onClose={onClose}
      width={520}
      footer={
        <>
          <Action variant="outline" onClick={onClose}>
            Cancel
          </Action>
          <Action onClick={park} disabled={save.isPending}>
            <Check size={16} strokeWidth={2.4} aria-hidden="true" />
            Park in {target}
          </Action>
        </>
      }>
      <p className="t-micro mb-2 text-ink-3">Where does it go?</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={!adding && folder === f}
            onClick={() => {
              setFolder(f);
              setAdding(false);
            }}
            className={chip(!adding && folder === f)}>
            {f}
          </button>
        ))}
        {adding ? (
          <input
            autoFocus
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            maxLength={40}
            placeholder="Folder name"
            aria-label="New folder name"
            className="h-8 w-40 rounded-full border border-accent bg-surface px-3 text-[13px] text-ink outline-none"
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className={chip(false)}>
            <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
            New
          </button>
        )}
      </div>

      <p className="t-micro mb-2 mt-5 text-ink-3">What happened? (optional)</p>
      <div className="flex flex-wrap gap-2">
        {PARK_REASONS.map((r) => (
          <button key={r.value} type="button" aria-pressed={reason === r.value} onClick={() => setReason(reason === r.value ? null : r.value)} className={chip(reason === r.value)}>
            {r.label}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="A note for later (optional)"
        aria-label="Note"
        className="mt-5 w-full resize-none rounded-control border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
      />
      {save.isError && <p className="mt-2 text-[13px] font-medium text-bad">{describeError(save.error)}</p>}
    </Modal>
  );
}
