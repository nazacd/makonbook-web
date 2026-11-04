import { Check, Flag, Send, Wrench, type LucideIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';

import { describeError } from '@/api/errors';
import { REPORT_REASONS, useReportQuestion, type ReportReason } from '@/api/learning';
import { Spinner } from '@/components/Button';
import { Modal } from '@/components/ui';
import { uuid } from '@/lib/device-id';
import { SUBJECT_LABEL, testName } from '@/lib/practice/run';

import type { QuestionRef } from './AskLater';

type Kind = 'question' | 'technical';

const KINDS: { value: Kind; icon: LucideIcon; title: string; text: string }[] = [
  { value: 'question', icon: Flag, title: 'Question issue', text: 'Something is wrong with this question' },
  { value: 'technical', icon: Wrench, title: 'Technical issue', text: 'The app or the test itself is not working' },
];

/** How long the thank-you stays before the dialog closes by itself. */
const THANKS_MS = 2600;

// The test screen's "Issue": a problem with this question (which kind) or
// with the app, and a few words; it goes to the teachers who check the
// content. Saved under one id per opening, so a retry never sends it twice.
export function ReportIssue({ question, onClose }: { question: QuestionRef; onClose: () => void }) {
  const report = useReportQuestion();
  const [id] = useState(uuid);
  const [kind, setKind] = useState<Kind>('question');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [text, setText] = useState('');
  // A question issue says what is wrong (or in words); a technical one needs the words.
  const canSend = kind === 'question' ? reason != null || text.trim() !== '' : text.trim() !== '';

  const close = useEffectEvent(onClose);
  useEffect(() => {
    if (!report.isSuccess) return;
    const t = setTimeout(close, THANKS_MS);
    return () => clearTimeout(t);
  }, [report.isSuccess]);

  if (report.isSuccess) {
    // Its own dialog (the key), so the focus moves into it as the form goes.
    return (
      <Modal key="thanks" title="Report an issue" onClose={onClose} width={440}>
        <div className="flex flex-col items-center gap-3 pb-3 pt-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-good-tint text-good">
            <Check size={24} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <p className="t-headline text-ink" role="status">
            Thanks — our teachers will check it.
          </p>
        </div>
      </Modal>
    );
  }

  const send = () => {
    if (!canSend || report.isPending) return;
    report.mutate({
      id,
      test: question.test,
      version: question.version,
      subject: question.subject,
      module: question.module,
      position: question.position,
      question_id: question.question_id,
      kind,
      reason: kind === 'question' ? reason : null,
      text: text.trim(),
    });
  };

  return (
    <Modal title="Report an issue" onClose={onClose} width={580}>
      <div className="flex flex-col">
        <p id="issue-kind" className="t-footnote font-bold text-ink">
          What kind of issue is it?
        </p>
        <div role="radiogroup" aria-labelledby="issue-kind" className="mt-2.5 grid grid-cols-2 gap-2.5">
          {KINDS.map((k) => {
            const on = kind === k.value;
            return (
              <label
                key={k.value}
                className={`flex cursor-pointer gap-2.5 rounded-control border p-3 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                  on ? 'border-fill-watch bg-watch-tint' : 'border-line bg-surface hover:border-line-strong'
                }`}>
                <input type="radio" name="issue-kind" value={k.value} checked={on} onChange={() => setKind(k.value)} className="sr-only" />
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-chip ${on ? 'bg-fill-watch/15 text-watch' : 'bg-accent-tint text-accent'}`}>
                  <k.icon size={16} strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={`t-footnote font-bold ${on ? 'text-watch' : 'text-ink'}`}>{k.title}</span>
                  <span className="t-caption font-medium text-ink-2">{k.text}</span>
                </span>
              </label>
            );
          })}
        </div>

        {kind === 'question' && (
          <>
            <p id="issue-reason" className="t-footnote mt-5 font-bold text-ink">
              What is wrong with this question?{' '}
              <span className="font-medium text-ink-3">
                Q{question.position} · {testName(question.title)} · {SUBJECT_LABEL[question.subject]} · Module {question.module}
              </span>
            </p>
            <div role="radiogroup" aria-labelledby="issue-reason" className="mt-2.5 flex flex-col gap-2">
              {REPORT_REASONS.map((r) => {
                const on = reason === r.value;
                return (
                  <label
                    key={r.value}
                    className={`t-footnote flex min-h-11 cursor-pointer items-center gap-3 rounded-control border px-3.5 py-2 text-ink transition-colors duration-150 ${
                      on ? 'border-ink-2 font-semibold' : 'border-line hover:border-ink-2'
                    }`}>
                    <input type="radio" name="issue-reason" value={r.value} checked={on} onChange={() => setReason(r.value)} className="size-4 shrink-0 accent-accent" />
                    {r.label}
                  </label>
                );
              })}
            </div>
          </>
        )}

        <label className="mt-5 flex flex-col gap-2.5">
          <span className="t-footnote font-bold text-ink">
            Tell us more{kind === 'question' && <span className="font-medium text-ink-3"> (optional)</span>}
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Tell us what happened, what you expected, and anything else that helps..."
            className="t-footnote resize-none rounded-control border border-line bg-surface px-3.5 py-3 text-ink outline-none placeholder:text-ink-3 focus:border-accent"
          />
        </label>

        {report.isError && (
          <p role="alert" className="t-footnote mt-3 text-bad">
            {describeError(report.error)}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={send}
            disabled={!canSend || report.isPending}
            className="lift t-subhead inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 font-semibold text-surface disabled:cursor-default disabled:opacity-40">
            {report.isPending ? <Spinner className="size-4" /> : <Send size={16} strokeWidth={2} aria-hidden="true" />}
            Send report
          </button>
        </div>
      </div>
    </Modal>
  );
}
