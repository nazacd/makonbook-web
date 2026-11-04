import { Flag, Send, Wrench, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { describeError } from '@/api/errors';
import { REPORT_REASONS, useReportQuestion, type ReportReason } from '@/api/learning';
import { Modal } from '@/components/ui';
import { uuid } from '@/lib/device-id';

import type { ResultRow } from './model';

// "Report an issue" from the results table's flag (the reference's report
// modal): a question issue with its reason, or a technical one, and a note.

type Kind = 'question' | 'technical';

export function ReportModal({ row, code, version, testTitle, onClose }: { row: ResultRow; code: string; version: number; testTitle: string; onClose: () => void }) {
  const report = useReportQuestion();
  const [kind, setKind] = useState<Kind>('question');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [text, setText] = useState('');
  const ready = kind === 'question' ? reason != null : text.trim() !== '';

  const send = () =>
    report.mutate({
      id: uuid(),
      test: code,
      version,
      subject: row.subject,
      module: row.module as 1 | 2,
      position: row.position,
      question_id: row.q.id,
      kind,
      reason: kind === 'question' ? reason : null,
      text: text.trim(),
    });

  if (report.isSuccess) {
    return (
      <Modal title="Thanks for telling us" onClose={onClose} width={440} footer={<FooterButton onClick={onClose}>Close</FooterButton>}>
        <p className="t-subhead text-ink-2">We got your report on question {row.position}. Someone will look at it soon.</p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Report an issue"
      onClose={onClose}
      width={520}
      footer={
        <FooterButton onClick={send} disabled={!ready || report.isPending}>
          <Send size={15} strokeWidth={2} aria-hidden="true" />
          {report.isPending ? 'Sending…' : 'Send report'}
        </FooterButton>
      }>
      <div className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-ink">What kind of issue is it?</legend>
          <div className="grid grid-cols-2 gap-2.5">
            <KindCard icon={Flag} title="Question issue" text="Something is wrong with this question" on={kind === 'question'} onClick={() => setKind('question')} />
            <KindCard icon={Wrench} title="Technical issue" text="The app or the test itself is not working" on={kind === 'technical'} onClick={() => setKind('technical')} />
          </div>
        </fieldset>
        {kind === 'question' && (
          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold text-ink">
              What is wrong with this question?{' '}
              <span className="font-medium text-ink-3">
                Q{row.position} · {testTitle}
              </span>
            </legend>
            <div className="flex flex-col gap-2">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex h-10 cursor-pointer items-center gap-3 rounded-[8px] border px-3 text-[13px] transition-colors duration-150 ${reason === r.value ? 'border-primary bg-accent-tint text-ink' : 'border-line text-ink-2 hover:border-line-strong'}`}>
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="size-3.5 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-line-strong checked:border-[4px] checked:border-primary"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink">
            Tell us more <span className="font-medium text-ink-3">(optional)</span>
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Tell us what happened, what you expected, and anything else that helps…"
            className="resize-none rounded-[8px] border border-line bg-surface px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
          />
        </label>
        {report.isError && (
          <p className="t-footnote text-bad" role="alert">
            {describeError(report.error)}
          </p>
        )}
      </div>
    </Modal>
  );
}

function KindCard({ icon: I, title, text, on, onClick }: { icon: LucideIcon; title: string; text: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-start gap-2.5 rounded-[10px] border p-3 text-left transition-colors duration-150 ${on ? 'border-primary bg-accent-tint' : 'border-line hover:border-line-strong'}`}>
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-[8px] ${on ? 'bg-primary text-on-primary' : 'bg-surface-2 text-ink-2'}`}>
        <I size={14} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className={`text-[13px] font-semibold ${on ? 'text-accent' : 'text-ink'}`}>{title}</span>
        <span className="text-[11.5px] leading-4 text-ink-2">{text}</span>
      </span>
    </button>
  );
}

function FooterButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="lift inline-flex h-9 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-semibold text-surface disabled:cursor-default disabled:opacity-40">
      {children}
    </button>
  );
}
