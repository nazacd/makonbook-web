import { BellOff, X } from 'lucide-react';
import { useState } from 'react';

import { Segmented } from '@/components/ui';
import { useDialog } from '@/lib/dialog';

// The notifications drawer (right side). Nothing sends notifications yet, so
// it shows its empty state; the filters are ready for when they come.
type Filter = 'all' | 'unread' | 'questions';

export function NotificationsDrawer({ onClose }: { onClose: () => void }) {
  const dialog = useDialog<HTMLDivElement>(onClose);
  const [filter, setFilter] = useState<Filter>('all');
  return (
    <div className="fade fixed inset-0 z-50 bg-black/30 backdrop-blur-[4px]" onClick={onClose}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Notifications" className="absolute inset-y-0 right-0 flex w-full max-w-[380px] flex-col bg-surface outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between bg-primary px-5 pb-4 pt-5 text-on-primary">
          <div>
            <h2 className="text-[20px] font-bold">Notifications</h2>
            <p className="text-[13px] opacity-80">You’re all caught up</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-chip hover:bg-white/15">
            <X size={19} />
          </button>
        </div>
        <div className="border-b border-line px-4 py-3">
          <Segmented
            label="Filter notifications"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'unread', label: 'Unread' },
              { value: 'questions', label: 'Questions' },
            ]}
          />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
          <span className="mb-2 flex size-14 items-center justify-center rounded-full bg-surface-2">
            <BellOff size={24} className="text-ink-2" aria-hidden="true" />
          </span>
          <p className="t-headline text-ink">No notifications yet</p>
          <p className="t-subhead text-ink-2">Replies, mentions and messages will show up here.</p>
        </div>
      </div>
    </div>
  );
}
