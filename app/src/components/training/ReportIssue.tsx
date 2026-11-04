import { Flag } from 'lucide-react';
import { useState } from 'react';

import { describeError } from '@/api/errors';
import { REPORT_REASONS, useReportQuestion, type ReportReason } from '@/api/learning';
import { Action, Modal, Segmented } from '@/components/ui';
import { uuid } from '@/lib/device-id';
import type { Answered } from '@/lib/practice/mistakes';

// The flag on a drill question (the spec's "Report an issue" modal): a
// question issue with its reason, or a technical one, and a few words.

type Kind = 'question' | 'technical';

export function ReportIssue({ item }: { item: Answered }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={sent ? 'Issue reported' : 'Report an issue'}
        title={sent ? 'Reported. Thanks!' : 'Report an issue'}
        className={`flex size-8 items-center justify-center rounded-chip transition-colors duration-150 hover:bg-surface-2 ${sent ? 'text-accent' : 'text-ink'}`}>
        <Flag size={18} strokeWidth={1.9} fill={sent ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
      {open && (
        <ReportDialog
          item={item}
          onClose={() => setOpen(false)}
          onSent={() => {
            setSent(true);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function ReportDialog({ item, onClose, onSent }: { item: Answered; onClose: () => void; onSent: () => void }) {
  const report = useReportQuestion();
  const [id] = useState(uuid);
  const [kind, setKind] = useState<Kind>('question');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [text, setText] = useState('');
  const ready = kind === 'technical' ? text.trim().length > 0 : reason != null;

  const send = () =>
    report.mutate(
      {
        id,
        test: item.code,
        version: item.version,
        subject: item.subject,
        module: item.module as 1 | 2,
        position: item.position,
        question_id: item.id,
        kind,
        reason: kind === 'question' ? reason : null,
        text: text.trim(),
      },
      { onSuccess: onSent },
    );

  return (
    <Modal
      title="Report an issue"
      onClose={onClose}
      width={520}
      footer={
        <>
          <Action variant="outline" onClick={onClose}>
            Cancel
          </Action>
          <Action onClick={send} disabled={!ready || report.isPending}>
            Send report
          </Action>
        </>
      }>
      <Segmented
        label="Kind of issue"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'question', label: 'Question issue' },
          { value: 'technical', label: 'Technical issue' },
        ]}
      />
      {kind === 'question' && (
        <fieldset className="mt-4 flex flex-col gap-1">
          <legend className="sr-only">What is wrong?</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r.value} className="flex h-10 cursor-pointer items-center gap-3 rounded-chip px-2 text-[14px] font-medium text-ink hover:bg-surface-2">
              <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="size-4 accent-[var(--color-primary)]" />
              {r.label}
            </label>
          ))}
        </fieldset>
      )}
      <p className="t-micro mb-2 mt-4 text-ink-3">{kind === 'technical' ? 'What went wrong?' : 'Tell us more (optional)'}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={2000}
        aria-label={kind === 'technical' ? 'What went wrong' : 'Tell us more'}
        className="w-full resize-none rounded-control border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
      />
      {report.isError && <p className="mt-2 text-[13px] font-medium text-bad">{describeError(report.error)}</p>}
    </Modal>
  );
}
