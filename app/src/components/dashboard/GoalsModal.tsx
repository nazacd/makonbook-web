import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';

import { describeError } from '@/api/errors';
import { useSaveGoals, type Goals } from '@/api/learning';
import { Notice } from '@/components/Notice';
import { Action, Modal } from '@/components/ui';
import { schoolDate } from '@/lib/schedule';

// The student's SAT goal: a target per section (200–800, in tens) and the
// exam date, for the dashboard's countdown.

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.max(200, Math.min(800, Math.round(v / 10) * 10)));
  return (
    <div className="rounded-card border border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="t-subhead font-semibold text-ink-2">{label}</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => set(value - 10)} aria-label={`${label}: 10 less`} className="flex size-9 items-center justify-center rounded-full border border-line-strong hover:bg-surface-2">
            <Minus size={16} />
          </button>
          <span className="t-number w-14 text-center text-[28px] text-ink" aria-live="polite">
            {value}
          </span>
          <button type="button" onClick={() => set(value + 10)} aria-label={`${label}: 10 more`} className="flex size-9 items-center justify-center rounded-full border border-line-strong hover:bg-surface-2">
            <Plus size={16} />
          </button>
        </div>
      </div>
      <input type="range" min={200} max={800} step={10} value={value} onChange={(e) => set(Number(e.target.value))} aria-label={label} className="mt-3 w-full accent-[var(--color-primary)]" />
    </div>
  );
}

export function GoalsModal({ goals, onClose }: { goals?: Goals; onClose: () => void }) {
  const save = useSaveGoals();
  const [math, setMath] = useState(goals?.target_math ?? 650);
  const [rw, setRw] = useState(goals?.target_rw ?? 650);
  const [date, setDate] = useState(goals?.exam_date ?? '');
  const [today] = useState(() => schoolDate(Date.now()));
  const submit = () => save.mutate({ target_math: math, target_rw: rw, exam_date: date || null }, { onSuccess: onClose });
  return (
    <Modal
      title="Your SAT goal"
      subtitle="Set a target and your exam date: the dashboard counts down and shows how far your mock tests are."
      onClose={onClose}
      footer={
        <>
          <Action variant="outline" onClick={onClose}>
            Cancel
          </Action>
          <Action onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Action>
        </>
      }>
      <div className="flex flex-col gap-3">
        <Stepper label="Math" value={math} onChange={setMath} />
        <Stepper label="Reading & Writing" value={rw} onChange={setRw} />
        <div className="flex items-center justify-between rounded-card bg-surface-2 px-4 py-3">
          <span className="t-subhead font-semibold text-ink-2">Total</span>
          <span className="t-number text-[26px] text-ink">{math + rw}</span>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="t-subhead font-semibold text-ink-2">Exam date</span>
          <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-control border border-line bg-surface-2 px-3 text-[15px] text-ink outline-none focus:border-primary" />
        </label>
        {save.isError && <Notice tone="error" message={describeError(save.error)} />}
      </div>
    </Modal>
  );
}
