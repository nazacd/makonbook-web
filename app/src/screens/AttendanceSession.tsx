import { Check, ChevronLeft, CircleDashed, Clock, Lock, Maximize2, Pencil, X, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { useAttendanceSession, useFinishSession, useSetMark, type AttendanceMark, type FetchedSession, type MarkState } from '@/api/attendance';
import { describeError } from '@/api/errors';
import { FullScreenQR } from '@/components/attendance/FullScreenQR';
import { MARK_LABEL, MarkSheet } from '@/components/attendance/MarkSheet';
import { RotatingQR } from '@/components/attendance/RotatingQR';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { ErrorState, Skeleton } from '@/components/States';
import { useNow } from '@/lib/clock';
import { confirm } from '@/lib/confirm';
import { normalCase, parseClassName } from '@/lib/groups';
import { formatDate, schoolClock, schoolDate } from '@/lib/schedule';
import { useTitle } from '@/lib/title';

// Order is information. While open: who hasn't checked in first, then the
// latest arrivals. Once finished: absent, late, then present.
const OPEN_ORDER: Record<MarkState, number> = { pending: 0, late: 1, present: 1, absent: 2 };
const DONE_ORDER: Record<MarkState, number> = { absent: 0, late: 1, present: 2, pending: 3 };

function ordered(marks: AttendanceMark[], open: boolean): AttendanceMark[] {
  const rank = open ? OPEN_ORDER : DONE_ORDER;
  return [...marks].sort((a, b) => {
    const r = rank[a.state] - rank[b.state];
    if (r !== 0 || !open) return r;
    return Date.parse(b.scanned_at ?? '') - Date.parse(a.scanned_at ?? '') || 0;
  });
}

// The teacher's attendance screen (the phone's attendance/[id]): while open,
// the live count, the rotating QR (full screen for the projector) and the
// class; once finished, the totals, correctable for 24 hours after the lesson.
export function AttendanceSession() {
  const { id = '' } = useParams();
  const session = useAttendanceSession(id);
  const finish = useFinishSession(id);
  const setMark = useSetMark(id);
  const now = useNow();
  const [editing, setEditing] = useState<AttendanceMark | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const s = session.data;
  const title = s ? parseClassName(s.group_name).title : 'Attendance';
  useTitle(`${title} · Attendance`);

  const back = (
    <Link to="/" className="t-subhead -ml-1 mb-4 inline-flex h-10 items-center gap-1 rounded-chip pr-2 text-accent">
      <Icon as={ChevronLeft} size={18} className="text-accent" />
      Today
    </Link>
  );
  if (!s) {
    return (
      <div className="mx-auto w-full max-w-xl">
        {back}
        {session.isError ? (
          <ErrorState title="Couldn’t load attendance" message={describeError(session.error)} onRetry={() => void session.refetch()} retrying={session.isFetching} />
        ) : (
          <div className="flex flex-col gap-4">
            <Skeleton width={140} height={44} />
            <div className="flex justify-center">
              <Skeleton width={260} height={260} radius={20} />
            </div>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={22} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const open = s.status === 'open';
  const editable = now < Date.parse(s.editable_until);
  // Late counts as attended, here and everywhere in the app.
  const attended = s.counts.present + s.counts.late;
  const clockOffsetMs = s.qr ? Date.parse(s.qr.server_time) - s.receivedAt : 0;

  function confirmFinish(session: FetchedSession) {
    const pending = session.counts.pending;
    confirm({
      title: 'Finish attendance?',
      message: (pending > 0 ? `${pending} student${pending === 1 ? ' who hasn’t' : 's who haven’t'} checked in will be marked absent. ` : '') + 'You can still correct marks for 24 hours.',
      onConfirm: () => {
        setFinishError(null);
        finish.mutate(undefined, { onError: (e) => setFinishError(describeError(e)) });
      },
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      {back}
      <h1 className="t-title mb-6 text-ink">{title}</h1>
      <div className={open && s.qr ? 'md:grid md:grid-cols-[auto_1fr] md:gap-10' : ''}>
        {open && s.qr ? (
          <div className="mb-6 flex flex-col items-center gap-4 md:mb-0">
            <RotatingQR sessionId={s.id} secret={s.qr.secret} clockOffsetMs={clockOffsetMs} size={300} onClick={() => setFullScreen(true)} />
            <button type="button" onClick={() => setFullScreen(true)} className="t-subhead flex h-11 items-center gap-2 rounded-chip px-3 font-medium text-accent active:bg-surface-2">
              <Icon as={Maximize2} size={16} className="text-accent" />
              Full screen for the projector
            </button>
          </div>
        ) : null}
        <div className="flex flex-col gap-6">
          {open && s.qr ? (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div aria-live="polite" aria-label={`${attended} of ${s.counts.total} checked in`}>
                <p className="t-subhead flex items-center gap-1.5 font-medium text-ink-2">
                  <span className="size-2 rounded-full bg-accent" />
                  Checked in
                </p>
                <p className="font-title tabular text-[44px] font-bold leading-[50px] text-ink">
                  {attended}
                  <span className="text-[24px] font-semibold text-ink-3"> / {s.counts.total}</span>
                </p>
              </div>
              <p className="t-subhead flex items-center gap-1.5 pb-2 text-ink-2">
                <Icon as={Clock} size={15} className="text-ink-2" />
                Late after {schoolClock(Date.parse(s.late_after))}
                {s.counts.late > 0 ? ` · ${s.counts.late} late` : ''}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="t-subhead text-ink-2">
                {formatDate(s.date)} · {schoolClock(Date.parse(s.starts_at))}–{schoolClock(Date.parse(s.ends_at))}
              </p>
              <p className="flex items-baseline gap-2" aria-label={`${attended} of ${s.counts.total} attended`}>
                <span className="font-title tabular text-[44px] font-bold leading-[50px] text-ink">
                  {attended}
                  <span className="text-[24px] font-semibold text-ink-3"> / {s.counts.total}</span>
                </span>
                <span className="t-subhead text-ink-2">attended</span>
              </p>
              {(s.counts.absent > 0 || s.counts.late > 0) && (
                <p className="t-callout font-semibold">
                  {s.counts.absent > 0 && <span className="text-bad">{s.counts.absent} absent</span>}
                  {s.counts.absent > 0 && s.counts.late > 0 && <span className="text-ink-3"> · </span>}
                  {s.counts.late > 0 && <span className="text-watch">{s.counts.late} late</span>}
                </p>
              )}
              <p className="t-footnote mt-1.5 flex items-center gap-2 text-ink-3">
                <Icon as={editable ? Pencil : Lock} size={15} className="text-ink-3" />
                {editable ? `Correctable until ${formatDate(schoolDate(Date.parse(s.editable_until)))} ${schoolClock(Date.parse(s.editable_until))}` : 'Final'}
              </p>
            </div>
          )}

          <section>
            {open && <h2 className="t-title3 mb-1 text-ink">Class</h2>}
            {s.marks.length === 0 ? (
              <p className="t-subhead text-ink-2">No students on this lesson’s list.</p>
            ) : (
              <ul>
                {ordered(s.marks, open).map((m, i) => (
                  <StudentRow key={m.client_id} mark={m} open={open} first={i === 0} onClick={editable && m.source !== 'admin' ? () => setEditing(m) : undefined} />
                ))}
              </ul>
            )}
          </section>

          {open && (
            <div className="flex flex-col gap-3 border-t border-line pt-4">
              {finishError && <Notice tone="error" title="Couldn’t finish" message={finishError} />}
              <Button label="Finish attendance" onClick={() => confirmFinish(s)} loading={finish.isPending} className="max-w-xs" />
            </div>
          )}
        </div>
      </div>

      {fullScreen && open && s.qr && <FullScreenQR onClose={() => setFullScreen(false)} sessionId={s.id} secret={s.qr.secret} clockOffsetMs={clockOffsetMs} />}

      {editing && (
        <MarkSheet
          mark={editing}
          busy={setMark.isPending}
          error={markError}
          onClose={() => {
            setEditing(null);
            setMarkError(null);
          }}
          onChoose={(state) =>
            setMark.mutate(
              { clientId: editing.client_id, state },
              {
                onSuccess: () => {
                  setMarkError(null);
                  setEditing(null);
                },
                onError: (e) => setMarkError(describeError(e)),
              },
            )
          }
        />
      )}
    </div>
  );
}

// While open every state is shown (grey "Not yet" for who's missing); once
// finished, present is silent and only Late and Absent are marked.
const SHOWN: Record<MarkState, { icon: LucideIcon; tone: string; strong: boolean }> = {
  pending: { icon: CircleDashed, tone: 'text-ink-3', strong: false },
  present: { icon: Check, tone: 'text-ink-3', strong: false },
  late: { icon: Clock, tone: 'text-watch', strong: true },
  absent: { icon: X, tone: 'text-bad', strong: true },
};

function StudentRow({ mark, open, first, onClick }: { mark: AttendanceMark; open: boolean; first: boolean; onClick?: () => void }) {
  const detail =
    mark.source === 'scan' && mark.scanned_at ? `Scanned ${schoolClock(Date.parse(mark.scanned_at))}` : mark.source === 'teacher' ? 'Marked by you' : mark.source === 'admin' ? 'Corrected by the office' : null;
  const shown = SHOWN[mark.state];
  const showState = open || mark.state !== 'present';
  const name = normalCase(`${mark.first_name} ${mark.last_name}`);
  const body = (
    <>
      <Avatar kind="student" firstName={mark.first_name} lastName={mark.last_name} id={mark.client_id} size={34} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="t-body truncate text-ink">{name}</span>
        {detail && <span className="t-caption text-ink-3">{detail}</span>}
      </span>
      {showState && (
        <span className="flex items-center gap-1.5">
          <Icon as={shown.icon} size={16} className={shown.tone} strokeWidth={shown.strong ? 2 : 1.75} />
          <span className={`t-subhead ${shown.strong ? `font-semibold ${shown.tone}` : 'text-ink-3'}`}>{MARK_LABEL[mark.state]}</span>
        </span>
      )}
    </>
  );
  const className = `-mx-2 flex min-h-14 w-[calc(100%+16px)] items-center gap-3 px-2 py-2 text-left ${first ? '' : 'border-t border-line'}`;
  return (
    <li>
      {onClick ? (
        <button type="button" onClick={onClick} aria-label={`${name}, ${MARK_LABEL[mark.state]}. Change this mark`} className={`${className} active:bg-surface-2`}>
          {body}
        </button>
      ) : (
        <div className={className} aria-label={`${name}, ${MARK_LABEL[mark.state]}`}>
          {body}
        </div>
      )}
    </li>
  );
}
