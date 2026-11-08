import { BellOff, BookOpenCheck, CheckCheck, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useNotifications, useReadNotifications, type Notification } from '@/api/assignments';
import { Skeleton } from '@/components/States';
import { Segmented } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { useDialog } from '@/lib/dialog';
import { relativeDay, schoolClock, schoolDate } from '@/lib/schedule';

// The notifications drawer (right side): new homework, level checks and
// exams from the teachers so far (spec 23.5). Opening one marks it read and
// goes where it points; ✓✓ marks them all read.
type Filter = 'all' | 'unread';

function when(iso: string, now: number): string {
  const t = Date.parse(iso);
  return schoolDate(t) === schoolDate(now) ? schoolClock(t) : relativeDay(t, now);
}

export function NotificationsDrawer({ onClose }: { onClose: () => void }) {
  const dialog = useDialog<HTMLDivElement>(onClose);
  const navigate = useNavigate();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('all');
  const list = useNotifications();
  const read = useReadNotifications();
  const items = (list.data?.items ?? []).filter((n) => filter === 'all' || !n.read_at);
  const unread = list.data?.unread ?? 0;
  const open = (n: Notification) => {
    if (!n.read_at) read.mutate({ ids: [n.id] });
    if (n.link) {
      onClose();
      void navigate(n.link);
    }
  };
  return (
    <div className="fade fixed inset-0 z-50 bg-black/30 backdrop-blur-[4px]" onClick={onClose}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Notifications" className="absolute inset-y-0 right-0 flex w-full max-w-[380px] flex-col bg-surface outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 bg-primary px-5 pb-4 pt-5 text-on-primary">
          <div>
            <h2 className="text-[20px] font-bold">Notifications</h2>
            <p className="text-[13px] opacity-80">{unread ? `${unread} unread` : 'You’re all caught up'}</p>
          </div>
          <div className="flex items-center">
            {unread > 0 && (
              <button type="button" onClick={() => read.mutate({ all: true })} aria-label="Mark all as read" title="Mark all as read" className="flex size-9 items-center justify-center rounded-chip hover:bg-white/15">
                <CheckCheck size={19} />
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-chip hover:bg-white/15">
              <X size={19} />
            </button>
          </div>
        </div>
        <div className="border-b border-line px-4 py-3">
          <Segmented
            label="Filter notifications"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'unread', label: 'Unread', count: unread || undefined },
            ]}
          />
        </div>
        {list.isPending ? (
          <div className="flex flex-col gap-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={64} radius={12} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
            <span className="mb-2 flex size-14 items-center justify-center rounded-full bg-surface-2">
              <BellOff size={24} className="text-ink-2" aria-hidden="true" />
            </span>
            <p className="t-headline text-ink">{filter === 'unread' ? 'Nothing unread' : 'No notifications yet'}</p>
            <p className="t-subhead text-ink-2">New homework, level checks and exams from your teachers show up here.</p>
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto p-2">
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => open(n)} className={`flex w-full gap-3 rounded-control px-3 py-3 text-left transition-colors hover:bg-surface-2 ${n.read_at ? '' : 'bg-accent-tint/50'}`}>
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-primary">
                    <BookOpenCheck size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`t-subhead min-w-0 ${n.read_at ? 'text-ink' : 'font-bold text-ink'}`}>{n.title}</span>
                      <span className="t-caption shrink-0 font-medium text-ink-3">{when(n.created_at, now)}</span>
                    </span>
                    {n.body && <span className="t-footnote mt-0.5 block text-ink-2">{n.body}</span>}
                  </span>
                  {!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
